import { GalleryBuilderModal } from './ui/GalleryBuilderModal';
import { Logger } from "./utils/Logger";
import { Plugin, App, MarkdownPostProcessorContext, MarkdownView, Notice } from 'obsidian';
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
            showFrame: this.settings.showFrame ?? DEFAULT_SETTINGS.showFrame,
            pagination: this.settings.defaultPagination ?? DEFAULT_SETTINGS.defaultPagination,
            itemsPerPage: this.settings.defaultItemsPerPage ?? DEFAULT_SETTINGS.defaultItemsPerPage
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

        this.galleryProcessor.refreshAllGalleries(refreshSources).catch(error => {
            console.error('Error refreshing galleries:', error);
        });
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

        try {
            // Use the comprehensive gallery processor with professional features
            const result = await this.galleryProcessor.processCodeBlock(source, el, ctx, this.getProcessingOptions());

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