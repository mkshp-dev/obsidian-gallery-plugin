import { GalleryBuilderModal } from './ui/GalleryBuilderModal';
import { Logger } from "./utils/Logger";
import { Plugin, App, Component, MarkdownPostProcessorContext, MarkdownView, Notice, TFile, Menu, Platform } from 'obsidian';
import { ContentScanner } from './services/ContentScanner';
import { ViewFactory } from './views/ViewFactory';
import { GalleryProcessor, RefreshSources } from './processors/GalleryProcessor';
import { VaultWatcher } from './utils/VaultWatcher';
import { LazyLoader } from './utils/LazyLoader';
import { ShowcaseGenerator, ShowcaseOptions } from './generators/ShowcaseGenerator';
import { UseCaseGenerator } from './generators/UseCaseGenerator';
import { addDemoConnections, DemoConnectionConflict, hasDemoImmichConnection } from './generators/DemoServers';
import { DemoConnectionsModal } from './ui/DemoConnectionsModal';
import { GallerySettingsTab } from './ui/GallerySettingsTab';
import { GalleryPluginSettings, DEFAULT_SETTINGS } from './models/settings';
import { MosaicBuilderModal } from './ui/MosaicBuilderModal';
import { patternProblem, type SavedMosaicPattern } from './models/mosaicPattern';
import type { IImageSource } from './models/interfaces';
import { remoteImageLink, sourceServiceName } from './models/sourceLinks';
import { GalleryBurner, type AcquiredGallery } from './services/burn/GalleryBurner';
import { burnTimestamp, findGalleryBlocks, locateGalleryBlock } from './services/burn/burnText';
import { BurnConfirmModal } from './ui/BurnConfirmModal';
import type { GalleryInstance } from './models/GalleryInstance';

interface AppWithCommands extends App {
    commands: {
        executeCommandById(id: string): boolean;
    };
}

export default class GalleryPlugin extends Plugin {
    private vaultWatcher: VaultWatcher | null = null;
    private lazyLoader: LazyLoader | null = null;
    private contentScanner: ContentScanner | null = null;
    private viewFactory: ViewFactory | null = null;
    private galleryProcessor: GalleryProcessor | null = null;
    public settings: GalleryPluginSettings = DEFAULT_SETTINGS;
    private _onOpenSettingsRequested: ((e?: Event) => void) | null = null;
    /** Each rendered gallery's code block source and context, for burning it into its note */
    private galleryBlocks = new WeakMap<HTMLElement, { source: string; ctx: MarkdownPostProcessorContext }>();
    private burning = false;
    /** A vault change asked for a refresh during a burn; it runs when the burn ends */
    private refreshAfterBurn = false;
    
    async onload() {
        await this.loadSettings();

        // Initialize core services
        this.contentScanner = new ContentScanner(this.app.vault);
        this.viewFactory = new ViewFactory();
        this.galleryProcessor = new GalleryProcessor(
            this.contentScanner,
            this.viewFactory,
            () => this.settings.immichConnections,
            () => this.settings.nextcloudConnections,
            () => this.getProcessingOptions()
        );

        // Initialize lazy loader
        this.lazyLoader = new LazyLoader({
            rootMargin: '100px',
            threshold: 0.1,
            retryAttempts: 3,
            retryDelay: 1000
        });

        // Initialize vault watcher for automatic gallery updates. Vault image changes only
        // affect local sources, so remote sources are not fetched again.
        this.vaultWatcher = new VaultWatcher(
            this.app.vault,
            {
                onFileAdded: () => this.refreshGalleries(['local']),
                onFileDeleted: () => this.refreshGalleries(['local']),
                onFileRenamed: () => this.refreshGalleries(['local']),
                onFileModified: () => this.refreshGalleries(['local'])
            },
            {
                debounceMs: 1000,
                enableLogging: false
            }
        );
        this.vaultWatcher.start();

        // Register the obs-gallery code block processor with professional pipeline
        // Register showcase generator command
        this.addCommand({
            id: 'create-showcase-notes',
            name: 'Create showcase notes',
            callback: async () => {
                await this.createShowcase();
            }
        });

        this.addCommand({
            id: 'create-use-case-notes',
            name: 'Create use-case notes',
            callback: async () => {
                await this.createUseCases();
            }
        });

        this.addCommand({
            id: 'build-custom-mosaic',
            name: 'Build custom mosaic',
            callback: () => new MosaicBuilderModal(this.app, this).open()
        });

        this.addCommand({
            id: 'burn-galleries',
            name: 'Burn galleries in this note (experimental)',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!view?.file) return false;
                if (!checking) void this.burnGalleriesIn(view, view.file);
                return true;
            }
        });

        this.addCommand({
            id: 'insert-gallery',
            name: 'Insert gallery',
            callback: () => {
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView && markdownView.editor) {
                    new GalleryBuilderModal(this.app, this, markdownView.editor).open();
                } else {
                    new Notice('Please open a note to insert a gallery.');
                }
            }
        });

        this.registerMarkdownCodeBlockProcessor(
            'obs-gallery',
            async (source: string, el: HTMLElement, ctx) => {
                await this.processGalleryProfessional(source, el, ctx);
            }
        );

        // Register settings tab
        this.addSettingTab(new GallerySettingsTab(this.app, this));

        // Listen for requests from views/processors to open Settings
        this._onOpenSettingsRequested = () => {
            try {
                (this.app as unknown as AppWithCommands).commands.executeCommandById('app:open-settings');
            } catch (e) {
                console.warn('Failed to open settings via command', e);
            }
        };
        activeDocument.addEventListener('gallery-open-settings', this._onOpenSettingsRequested);
    }

    async loadSettings() {
        const data = (await this.loadData()) as Partial<GalleryPluginSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});

        // 'Text only' error display looked the same as 'Full' and was removed
        if ((this.settings.errorDisplayMode as string) === 'text') {
            this.settings.errorDisplayMode = 'full';
        }

        // A fresh array (never the shared default one), with only well-formed patterns
        const patterns: unknown = this.settings.mosaicPatterns;
        this.settings.mosaicPatterns = Array.isArray(patterns)
            ? patterns.filter((p): p is SavedMosaicPattern =>
                typeof (p as Partial<SavedMosaicPattern> | null)?.name === 'string' && patternProblem(p) === undefined)
            : [];

        // Migrate old Immich connection settings
        if (this.settings.immichConnections && Array.isArray(this.settings.immichConnections)) {
            this.settings.immichConnections = this.settings.immichConnections.map((connRaw) => {
                const conn = connRaw as unknown as Record<string, string | undefined>;
                // Remove internal ID and display name, ensure key is present
                return {
                    key: conn.key || conn.name || conn.id || `conn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    baseUrl: conn.baseUrl || '',
                    apiKey: conn.apiKey || ''
                };
            });
        }

        if (this.settings.nextcloudConnections && Array.isArray(this.settings.nextcloudConnections)) {
            this.settings.nextcloudConnections = this.settings.nextcloudConnections.map((connRaw) => {
                const conn = connRaw as unknown as Record<string, string | undefined>;
                return {
                    key: conn.key || conn.name || conn.id || `conn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    baseUrl: conn.baseUrl || '',
                    username: conn.username || '',
                    appPassword: conn.appPassword || ''
                };
            });
        } else {
            this.settings.nextcloudConnections = [];
        }

        Logger.setDebugEnabled(!!this.settings.enableLifecycleLogging);
    }

    async saveSettings() {
        Logger.setDebugEnabled(!!this.settings.enableLifecycleLogging);
        await this.saveData(this.settings);
    }

    onunload() {

        // Clean up gallery processor
        if (this.galleryProcessor) {
            this.galleryProcessor.destroy();
            this.galleryProcessor = null;
        }
        
        // Clean up vault watcher
        if (this.vaultWatcher) {
            this.vaultWatcher.stop();
            this.vaultWatcher = null;
        }
        
        // Clean up lazy loader
        if (this.lazyLoader) {
            this.lazyLoader.disconnect();
            this.lazyLoader = null;
        }
        
        // Clean up content scanner
        if (this.contentScanner) {
            this.contentScanner.destroy();
            this.contentScanner = null;
        }
        
        // Clean up view factory
        if (this.viewFactory) {
            // ViewFactory doesn't have destroy method yet, just null it
            this.viewFactory = null;
        }

        // Remove document listener
        try {
            activeDocument.removeEventListener('gallery-open-settings', this._onOpenSettingsRequested as EventListener);
        } catch (error) {
            console.debug('Error removing document listener:', error);
        }
    }

    /**
     * Get current processing options derived from plugin settings
     */
    public getProcessingOptions() {
        return {
            errorDisplayMode: this.settings.errorDisplayMode,
            showLoadingFeedback: true,
            enableValidation: true,
            maxRetries: 3,
            timeoutMs: this.settings.remoteLoadTimeoutMs || 30000,
            allowRemoteImages: !!this.settings.allowRemoteImages,
            validateRemoteContentType: !!this.settings.validateRemoteContentType,
            gracePeriodMs: this.settings.gracePeriodMs || DEFAULT_SETTINGS.gracePeriodMs,
            enableLifecycleLogging: !!this.settings.enableLifecycleLogging,
            showCaptions: this.settings.showCaptions ?? DEFAULT_SETTINGS.showCaptions,
            captionMaxLines: this.settings.captionMaxLines ?? DEFAULT_SETTINGS.captionMaxLines,
            slideshowInterval: this.settings.slideshowInterval ?? DEFAULT_SETTINGS.slideshowInterval,
            maxRemoteVideoMb: this.settings.maxRemoteVideoMb ?? DEFAULT_SETTINGS.maxRemoteVideoMb,
            showFrame: this.settings.showFrame ?? DEFAULT_SETTINGS.showFrame,
            pagination: this.settings.defaultPagination ?? DEFAULT_SETTINGS.defaultPagination,
            itemsPerPage: this.settings.defaultItemsPerPage ?? DEFAULT_SETTINGS.defaultItemsPerPage,
            paginationPosition: this.settings.defaultPaginationPosition ?? DEFAULT_SETTINGS.defaultPaginationPosition,
            mosaicPatterns: this.settings.mosaicPatterns ?? []
        };
    }

    /**
     * Create the showcase notes, first offering to add the demo server connections they use
     */
    private async createShowcase(): Promise<void> {
        const generator = new ShowcaseGenerator(this.app);
        if (generator.showcaseExists()) {
            // Let the generator report it, without asking about connections first
            await generator.generateShowcase();
            return;
        }

        const options = await this.askForDemoSetup();
        if (options) await generator.generateShowcase(options);
    }

    /**
     * Create only the use-case notes, for vaults that already have the showcase. Does nothing if
     * the use-case folder exists.
     */
    private async createUseCases(): Promise<void> {
        const generator = new UseCaseGenerator(this.app);
        if (generator.exists()) {
            new Notice(`${UseCaseGenerator.folder} already exists. Delete or rename it if you want to create the use-case notes again.`);
            return;
        }

        const options = await this.askForDemoSetup();
        if (!options) return;
        // Skipping the connections here doesn't mean they are missing: an earlier showcase may have added them
        if (options.demoConnections === 'declined' && hasDemoImmichConnection(this.settings)) {
            options.demoConnections = 'added';
        }
        try {
            await generator.generate(options);
            new Notice(`Use-case notes created in ${UseCaseGenerator.folder}`);
        } catch (error) {
            console.error('Failed to create the use-case notes:', error);
            new Notice('Failed to create the use-case notes. Check console for details.');
        }
    }

    /**
     * Ask about the demo connections and sample photos, and add the connections if the user agrees.
     * Returns null when the user cancels.
     */
    private async askForDemoSetup(): Promise<ShowcaseOptions | null> {
        const { choice, downloadPhotos } = await new DemoConnectionsModal(this.app).ask();
        if (choice === 'cancel') return null;

        let conflicts: DemoConnectionConflict[] = [];
        if (choice === 'add') {
            const result = addDemoConnections(this.settings);
            conflicts = result.conflicts;
            if (result.added.length > 0) {
                await this.saveSettings();
                this.refreshGalleries(['immich', 'nextcloud']);
            }
            for (const conflict of conflicts) {
                new Notice(`Gallery View: a connection named "${conflict.key}" already exists and points to ${conflict.baseUrl}, so it was not changed. The showcase notes that use it will not reach the demo server; see the welcome note.`, 10000);
            }
        }

        return { demoConnections: choice === 'add' ? 'added' : 'declined', conflicts, downloadPhotos };
    }

    /**
     * Refresh all active galleries. `refreshSources` picks which sources are re-resolved
     * (fetched again); see RefreshSources.
     */
    public refreshGalleries(refreshSources: RefreshSources = 'all'): void {
        if (!this.galleryProcessor) {
            return;
        }
        // Saving burned images would re-render the galleries being drawn; wait until the burn ends
        if (this.burning) {
            this.refreshAfterBurn = true;
            return;
        }

        this.galleryProcessor.refreshAllGalleries(refreshSources).catch(error => {
            console.error('Error refreshing galleries:', error);
        });
    }

    /**
     * The right-click menu for a photo or video from the vault: the same open, rename and delete
     * items as elsewhere in Obsidian, plus whatever core and other plugins add to the `file-menu`
     * event (open in new window, copy path, reveal in navigation, open in default app, ...), so
     * those are not added here a second time. Photos from Immich, Nextcloud or a URL get a short
     * menu of their own instead.
     */
    private showImageMenu(image: IImageSource, event: MouseEvent): void {
        if (image.type !== 'local') {
            this.showRemoteImageMenu(image, event);
            return;
        }
        const file = this.app.vault.getFileByPath(image.path);
        if (!file) return;
        // Stopped here too: in Live Preview the editor's own menu would otherwise open over this one
        event.preventDefault();
        event.stopPropagation();

        const workspace = this.app.workspace;
        const menu = new Menu();
        menu.addItem(item => item.setSection('open').setTitle('Open in new tab').setIcon('lucide-file-plus')
            .onClick(() => { void workspace.getLeaf('tab').openFile(file); }));
        if (!Platform.isPhone) {
            menu.addItem(item => item.setSection('open').setTitle('Open to the right').setIcon('lucide-separator-vertical')
                .onClick(() => { void workspace.getLeaf('split').openFile(file); }));
        }
        // Not in the typings, but what Obsidian's own menus call; left out if a version lacks it
        const rename = (this.app.fileManager as unknown as { promptForFileRename?: (file: TFile) => void }).promptForFileRename;
        if (rename) {
            menu.addItem(item => item.setSection('action').setTitle('Rename').setIcon('lucide-edit-3')
                .onClick(() => rename.call(this.app.fileManager, file)));
        }

        workspace.trigger('file-menu', menu, file, 'gallery-view');

        menu.addItem(item => item.setSection('danger').setTitle('Delete').setIcon('lucide-trash-2').setWarning(true)
            .onClick(() => { void this.app.fileManager.promptForDeletion(file); }));
        menu.showAtMouseEvent(event);
    }

    /**
     * The right-click menu for a photo from Immich, Nextcloud or a URL: open its page in the
     * browser, or copy the link. A photo with no page to link to keeps the default menu.
     */
    private showRemoteImageMenu(image: IImageSource, event: MouseEvent): void {
        const link = remoteImageLink(image);
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();

        const service = sourceServiceName(image.type);
        const menu = new Menu();
        menu.addItem(item => item.setSection('open').setTitle(service ? `Open in ${service}` : 'Open in browser').setIcon('lucide-external-link')
            .onClick(() => { window.open(link, '_blank'); }));
        menu.addItem(item => item.setSection('action').setTitle('Copy link').setIcon('lucide-link')
            .onClick(() => {
                navigator.clipboard.writeText(link).then(
                    () => { new Notice('Link copied'); },
                    () => { new Notice('Could not copy the link'); }
                );
            }));
        menu.showAtMouseEvent(event);
    }

    /** The note's galleries showing in its open view (in whichever mode it's in), not ones from embedded notes */
    private galleriesShownIn(view: MarkdownView, note: TFile): GalleryInstance[] {
        return (this.galleryProcessor?.getActiveGalleries() ?? []).filter(g =>
            g.container.isConnected &&
            view.containerEl.contains(g.container) &&
            g.container.getClientRects().length > 0 &&
            this.galleryBlocks.get(g.container)?.ctx.sourcePath === note.path);
    }

    /**
     * Replace every gallery in a note with a still image of it, for places that don't run plugins
     * (Obsidian Publish). Asks first, since the code blocks are deleted. See GalleryBurner.
     *
     * Obsidian only renders the part of a note near the screen, so galleries further down may not
     * exist yet. Those are rendered off-screen, at the note's width, just for the burn; galleries
     * already showing are burned as they are (keeping the carousel slide or page on screen).
     */
    private async burnGalleriesIn(view: MarkdownView, note: TFile): Promise<void> {
        if (this.burning) {
            new Notice('Already burning galleries. Try again when it finishes.');
            return;
        }
        if (!this.galleryProcessor) return;
        const lines = (await this.app.vault.cachedRead(note)).split('\n');
        const blocks = findGalleryBlocks(lines);
        if (blocks.length === 0) {
            new Notice('This note has no galleries to burn.');
            return;
        }

        const folder = (this.settings.burnFolder ?? '').trim();
        // Checked before asking, so nobody confirms a burn that can't happen
        if (GalleryBurner.resolveFolder(this.app, folder) === null) {
            new Notice(`The folder "${folder}" set for burned galleries doesn't exist anymore. Pick another one in the Gallery View settings, or leave it empty for the vault root.`, 10000);
            return;
        }
        const confirmed = await new BurnConfirmModal(this.app, { noteName: note.basename, count: blocks.length, folder }).ask();
        if (!confirmed) return;

        // The galleries already showing, by the line their block starts on
        const shown = this.galleriesShownIn(view, note);
        const shownByStart = new Map<number, GalleryInstance>();
        for (const gallery of shown) {
            const info = this.galleryBlocks.get(gallery.container);
            if (!info) continue;
            const hint = info.ctx.getSectionInfo(gallery.container)?.lineStart;
            const sameBody = blocks.filter(block => block.body.trim() === info.source.trim()).length;
            // Without a line to tell identical blocks apart, render them off-screen instead
            if (hint === undefined && sameBody > 1) continue;
            const block = locateGalleryBlock(lines, info.source, hint);
            if (block) shownByStart.set(block.start, gallery);
        }

        // Off-screen galleries are laid out at the width the note's galleries have on screen
        const width = shown[0]?.container.clientWidth
            || view.containerEl.querySelector<HTMLElement>('.markdown-preview-sizer, .cm-contentContainer')?.clientWidth
            || 700;
        const stage = view.containerEl.createDiv({ cls: 'gallery-burn-stage markdown-rendered' });
        stage.style.setProperty('--gallery-burn-width', `${width}px`);

        this.burning = true;
        const progress = new Notice(blocks.length === 1 ? 'Burning gallery…' : `Burning ${blocks.length} galleries…`, 0);
        try {
            const report = await new GalleryBurner(this.app).burnNote(note, blocks.map(block => ({
                source: block.body,
                start: block.start,
                acquire: () => {
                    const gallery = shownByStart.get(block.start);
                    return gallery && gallery.container.isConnected
                        ? Promise.resolve({ view: gallery.view, release: () => undefined })
                        : this.renderGalleryOffscreen(block.body, note, stage);
                }
            })), {
                folder,
                pluginName: this.manifest.name,
                timestamp: burnTimestamp(new Date()),
                onProgress: (current, total) => {
                    if (total > 1) progress.setMessage(`Burning gallery ${current} of ${total}…`);
                }
            });

            progress.hide();
            if (report.burned.length > 0) {
                const what = report.burned.length === 1 ? `Gallery burned to ${report.burned[0].path}` : `${report.burned.length} galleries burned into ${folder || 'the vault root'}`;
                const missing = report.missingImages;
                const note = missing > 0 ? `. ${missing} ${missing === 1 ? "photo couldn't be drawn and was" : "photos couldn't be drawn and were"} left empty` : '';
                new Notice(`${what}${note}.`, 8000);
            }
            if (report.orphaned.length > 0) {
                new Notice(`The note changed while drawing, so ${report.orphaned.length === 1 ? 'an image was' : `${report.orphaned.length} images were`} saved but not put in the note: ${report.orphaned.map(f => f.path).join(', ')}`, 0);
            }
            if (report.failed.length > 0) {
                new Notice(`Couldn't burn ${report.failed.length === 1 ? 'a gallery' : `${report.failed.length} galleries`}, so ${report.failed.length === 1 ? 'its code block was' : 'their code blocks were'} kept: ${report.failed[0]}`, 10000);
            }
        } catch (error) {
            progress.hide();
            console.error('Gallery burn failed:', error);
            new Notice(`Couldn't burn the galleries: ${error instanceof Error ? error.message : String(error)}`, 10000);
        } finally {
            stage.remove();
            this.burning = false;
            // Saving the images changed the vault; refresh the galleries that waited for the burn
            if (this.refreshAfterBurn) {
                this.refreshAfterBurn = false;
                this.refreshGalleries(['local']);
            }
        }
    }

    /**
     * Render a gallery block outside the screen for the burn, the way Obsidian would render it
     * in the note. `release` removes it again.
     */
    private async renderGalleryOffscreen(source: string, note: TFile, stage: HTMLElement): Promise<AcquiredGallery> {
        if (!this.galleryProcessor) throw new Error('The gallery processor is not running');
        const el = stage.createDiv({ cls: 'block-language-obs-gallery' });
        const children: Component[] = [];
        const ctx = {
            sourcePath: note.path,
            docId: '',
            frontmatter: undefined,
            addChild: (child: Component) => { children.push(child); child.load(); },
            getSectionInfo: () => null
        } as unknown as MarkdownPostProcessorContext;
        const release = () => {
            children.forEach(child => child.unload());
            el.remove();
        };

        const result = await this.galleryProcessor.processCodeBlock(source, el, ctx, this.getProcessingOptions());
        if (!result.success || !result.galleryInstance) {
            release();
            throw new Error(result.errors[0] ?? 'The gallery could not be rendered');
        }
        return { view: result.galleryInstance.view, release };
    }

    /**
     * Process gallery using professional pipeline
     */
    private async processGalleryProfessional(
        source: string, 
        el: HTMLElement, 
        ctx: MarkdownPostProcessorContext
    ): Promise<void> {
        if (!this.galleryProcessor) {
            if (this.settings.errorDisplayMode !== 'hidden') {
                el.createDiv({
                    text: '⚠️ gallery: processor not initialized',
                    cls: 'gallery-error-compact'
                });
            }
            return;
        }

        this.galleryBlocks.set(el, { source, ctx });
        try {
            // Use the comprehensive gallery processor with professional features
            const result = await this.galleryProcessor.processCodeBlock(source, el, ctx, {
                ...this.getProcessingOptions(),
                onImageMenu: (image, event) => this.showImageMenu(image, event)
            });

            if (!result.success) {
                console.error('Gallery processing failed:', result.errors);
            }

        } catch (error) {
            console.error('Unexpected error in gallery processing:', error);
            if (this.settings.errorDisplayMode !== 'hidden') {
                el.createDiv({
                    text: `⚠️ gallery: ${error instanceof Error ? error.message : String(error)}`,
                    cls: 'gallery-error-compact'
                });
            }
        }
    }
}