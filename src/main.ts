import { GalleryBuilderModal } from './ui/GalleryBuilderModal';
import { Logger } from "./utils/Logger";
import { Plugin, App, MarkdownPostProcessorContext } from 'obsidian';
import { ContentScanner } from './services/ContentScanner';
import { ViewFactory } from './views/ViewFactory';
import { GalleryProcessor } from './processors/GalleryProcessor';
import { VaultWatcher } from './utils/VaultWatcher';
import { LazyLoader } from './utils/LazyLoader';
import { ShowcaseGenerator } from './generators/ShowcaseGenerator';
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
        Logger.setDebugEnabled(true);

        await this.loadSettings();

        // Initialize core services
        this.contentScanner = new ContentScanner(this.app.vault);
        this.viewFactory = new ViewFactory();
        this.galleryProcessor = new GalleryProcessor(this.contentScanner, this.viewFactory, () => this.settings.immichConnections);

        // Initialize lazy loader
        this.lazyLoader = new LazyLoader({
            rootMargin: '100px',
            threshold: 0.1,
            retryAttempts: 3,
            retryDelay: 1000
        });

        // Initialize vault watcher for automatic gallery updates
        this.vaultWatcher = new VaultWatcher(
            this.app.vault,
            {
                onFileAdded: () => this.refreshGalleries(),
                onFileDeleted: () => this.refreshGalleries(),
                onFileRenamed: () => this.refreshGalleries(),
                onFileModified: () => this.refreshGalleries()
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
                await new ShowcaseGenerator(this.app).generateShowcase();
            }
        });

        this.addCommand({
            id: 'insert-gallery',
            name: 'Insert gallery',
            editorCallback: (editor, ctx) => {
                new GalleryBuilderModal(this.app, this, editor).open();
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
    }

    async saveSettings() {
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
     * Refresh all active galleries when vault files change (professional version)
     */
    private refreshGalleries(): void {
        if (!this.galleryProcessor) {
            return;
        }

        this.galleryProcessor.refreshAllGalleries().catch(error => {
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
                el.createEl('div', {
                    text: '⚠️ gallery: processor not initialized',
                    cls: 'gallery-error-compact'
                });
            }
            return;
        }

        try {
            // Use the comprehensive gallery processor with professional features
            const result = await this.galleryProcessor.processCodeBlock(source, el, ctx, {
                errorDisplayMode: this.settings.errorDisplayMode,
                showLoadingFeedback: true,
                enableValidation: true,
                maxRetries: 3,
                    timeoutMs: this.settings.remoteLoadTimeoutMs || 30000,
                    allowRemoteImages: !!this.settings.allowRemoteImages,
                    validateRemoteContentType: !!this.settings.validateRemoteContentType
            ,gracePeriodMs: this.settings.gracePeriodMs || DEFAULT_SETTINGS.gracePeriodMs
            ,enableLifecycleLogging: !!this.settings.enableLifecycleLogging
            });

            if (!result.success) {
                console.error('Gallery processing failed:', result.errors);
            }

        } catch (error) {
            console.error('Unexpected error in gallery processing:', error);
            if (this.settings.errorDisplayMode !== 'hidden') {
                el.createEl('div', {
                    text: `⚠️ gallery: ${error instanceof Error ? error.message : String(error)}`,
                    cls: 'gallery-error-compact'
                });
            }
        }
    }
}