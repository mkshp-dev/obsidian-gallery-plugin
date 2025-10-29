import { Plugin, TFile, PluginSettingTab, Setting, App } from 'obsidian';
import { ContentScanner } from './src/services/ContentScanner';
import { ViewFactory } from './src/views/ViewFactory';
import { GalleryProcessor } from './src/processors/GalleryProcessor';
import { VaultWatcher } from './src/utils/VaultWatcher';
import { LazyLoader } from './src/utils/LazyLoader';

/**
 * Plugin settings
 */
interface GalleryPluginSettings {
    allowRemoteImages: boolean;
    remoteLoadTimeoutMs: number;
}

const DEFAULT_SETTINGS: GalleryPluginSettings = {
    allowRemoteImages: false,
    remoteLoadTimeoutMs: 30000
};

class GallerySettingsTab extends PluginSettingTab {
    plugin: GalleryPlugin;
    constructor(app: App, plugin: GalleryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Gallery Plugin Settings' });

        new Setting(containerEl)
            .setName('Allow remote images')
            .setDesc('Enable loading images from external URLs listed in the `urls:` field of the gallery config. This is opt-in to protect privacy.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.allowRemoteImages)
                .onChange(async (value) => {
                    this.plugin.settings.allowRemoteImages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Remote load timeout (ms)')
            .setDesc('Timeout in milliseconds for loading remote images')
            .addText(text => text
                .setValue(String(this.plugin.settings.remoteLoadTimeoutMs))
                .onChange(async (value) => {
                    const n = parseInt(value, 10) || DEFAULT_SETTINGS.remoteLoadTimeoutMs;
                    this.plugin.settings.remoteLoadTimeoutMs = n;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class GalleryPlugin extends Plugin {
    private vaultWatcher: VaultWatcher | null = null;
    private lazyLoader: LazyLoader | null = null;
    private contentScanner: ContentScanner | null = null;
    private viewFactory: ViewFactory | null = null;
    private galleryProcessor: GalleryProcessor | null = null;
    public settings: GalleryPluginSettings = DEFAULT_SETTINGS;
    
    async onload() {
        console.log('Loading Gallery Plugin');

        await this.loadSettings();

        // Initialize core services
        this.contentScanner = new ContentScanner(this.app.vault);
        this.viewFactory = new ViewFactory();
        this.galleryProcessor = new GalleryProcessor(this.contentScanner, this.viewFactory);

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
        this.registerMarkdownCodeBlockProcessor(
            'obs-gallery',
            async (source: string, el: HTMLElement, ctx) => {
                await this.processGalleryProfessional(source, el, ctx);
            }
        );

        // Register settings tab
        this.addSettingTab(new GallerySettingsTab(this.app, this));

        console.log('Gallery Plugin loaded successfully');
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log('Unloading Gallery Plugin');
        
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
    }

    /**
     * Refresh all active galleries when vault files change (professional version)
     */
    private refreshGalleries(): void {
        if (!this.galleryProcessor) {
            console.warn('Gallery processor not available for refresh');
            return;
        }

        console.log('Refreshing galleries due to vault changes');
        
        // Use the gallery processor's refresh functionality
        this.galleryProcessor.refreshAllGalleries().then(() => {
            console.log('All galleries refreshed successfully');
        }).catch(error => {
            console.error('Error refreshing galleries:', error);
        });
    }

    /**
     * Process gallery using professional pipeline
     */
    private async processGalleryProfessional(
        source: string, 
        el: HTMLElement, 
        ctx: any
    ): Promise<void> {
        if (!this.galleryProcessor) {
            el.createEl('div', {
                text: 'Gallery processor not initialized',
                cls: 'gallery-error'
            });
            return;
        }

        try {
            // Use the comprehensive gallery processor with professional features
            const result = await this.galleryProcessor.processCodeBlock(source, el, ctx, {
                showLoadingFeedback: true,
                enableValidation: true,
                maxRetries: 3,
                timeoutMs: this.settings.remoteLoadTimeoutMs || 30000,
                allowRemoteImages: !!this.settings.allowRemoteImages
            });

            if (!result.success) {
                console.error('Gallery processing failed:', result.errors);
                // Error handling is already done by the processor
            } else {
                console.log(`Gallery processed successfully: ${result.imagesLoaded}/${result.imagesFound} images loaded`);
            }

        } catch (error) {
            console.error('Unexpected error in gallery processing:', error);
            el.createEl('div', {
                text: `Gallery Error: ${error instanceof Error ? error.message : String(error)}`,
                cls: 'gallery-error'
            });
        }
    }
}