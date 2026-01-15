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
    validateRemoteContentType?: boolean;
    // How long (ms) to wait before finally destroying a detached gallery
    gracePeriodMs?: number;
    // Enable verbose lifecycle logging to help debug detach/reattach behavior
    enableLifecycleLogging?: boolean;
    // Enable Templater plugin integration for dynamic variable expansion
    enableTemplaterIntegration?: boolean;
}

const DEFAULT_SETTINGS: GalleryPluginSettings = {
    allowRemoteImages: false,
    remoteLoadTimeoutMs: 30000
    ,validateRemoteContentType: false
    ,gracePeriodMs: 30000
    ,enableLifecycleLogging: false
    ,enableTemplaterIntegration: false
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

        new Setting(containerEl)
            .setName('Validate remote content type')
            .setDesc('When enabled, the plugin will perform a lightweight HEAD request to verify the Content-Type of remote URLs is an image before attempting to load them. This may add a small network request per URL.')
            .addToggle(toggle => toggle
                .setValue(!!this.plugin.settings.validateRemoteContentType)
                .onChange(async (value) => {
                    this.plugin.settings.validateRemoteContentType = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Detached gallery grace period (ms)')
            .setDesc('How long (ms) to retain a detached gallery before final destruction. Useful to avoid losing galleries during editor/preview toggles.')
            .addText(text => text
                .setValue(String(this.plugin.settings.gracePeriodMs ?? DEFAULT_SETTINGS.gracePeriodMs))
                .onChange(async (value) => {
                    const n = parseInt(value, 10);
                    this.plugin.settings.gracePeriodMs = isNaN(n) ? DEFAULT_SETTINGS.gracePeriodMs : n;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable lifecycle logging')
            .setDesc('Enable verbose lifecycle logs (debug) for gallery attach/detach events. Useful for troubleshooting mode toggles.')
            .addToggle(toggle => toggle
                .setValue(!!this.plugin.settings.enableLifecycleLogging)
                .onChange(async (value) => {
                    this.plugin.settings.enableLifecycleLogging = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Templater integration')
            .setDesc('Allow Templater variables in gallery code blocks (e.g., <% tp.frontmatter.coverImage %>). Requires Templater plugin to be installed.')
            .addToggle(toggle => toggle
                .setValue(!!this.plugin.settings.enableTemplaterIntegration)
                .onChange(async (value) => {
                    this.plugin.settings.enableTemplaterIntegration = value;
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
    private _onOpenSettingsRequested: ((e?: Event) => void) | null = null;
    
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

        // Listen for requests from views/processors to open Settings
        this._onOpenSettingsRequested = () => {
            try {
                (this.app as any).commands.executeCommandById('app:open-settings');
            } catch (e) {
                console.warn('Failed to open settings via command', e);
            }
        };
        document.addEventListener('gallery-open-settings', this._onOpenSettingsRequested as EventListener);

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

        // Remove document listener
        try {
            document.removeEventListener('gallery-open-settings', this._onOpenSettingsRequested as EventListener);
        } catch {}
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
     * Expand Templater variables in gallery code block content
     * @param source - Raw code block content
     * @param ctx - Markdown post processor context
     * @returns Expanded content or original if Templater unavailable
     */
    private async expandTemplaterVariables(
        source: string,
        ctx: any
    ): Promise<string> {
        // Check if Templater integration is enabled in settings
        if (!this.settings.enableTemplaterIntegration) {
            if (this.settings.enableLifecycleLogging) {
                console.log('Templater integration disabled in settings');
            }
            return source;
        }

        try {
            // Check if Templater plugin is installed and enabled
            const templater = (this.app as any).plugins?.getPlugin('templater-obsidian');
            if (!templater) {
                if (this.settings.enableLifecycleLogging) {
                    console.log('Templater plugin not found or not enabled');
                }
                return source;
            }

            // Get the current file from context if available
            const file = ctx?.sourcePath ? this.app.vault.getAbstractFileByPath(ctx.sourcePath) : null;
            
            if (!file || !(file instanceof TFile)) {
                if (this.settings.enableLifecycleLogging) {
                    console.log('No valid file context for Templater expansion');
                }
                return source;
            }

            // Use Templater's internal functions to parse template content
            // IMPORTANT: Use read_and_parse_template with run_mode to avoid file modification
            // Templater's API has different methods:
            // - parse_template(content, file) - may modify file
            // - read_and_parse_template(file) - reads and parses but shouldn't modify
            // We need to use the functions object directly for inline parsing
            
            if (templater.templater?.functions_generator) {
                // Create a functions object for the current file context
                const functions = await templater.templater.functions_generator.generate_object(
                    file,
                    templater.templater.functions_generator.internal_functions.modules_array
                );
                
                // Parse the template content without modifying the file
                // This uses Templater's parser directly on the string
                if (templater.templater.parser?.parse_commands) {
                    const expanded = await templater.templater.parser.parse_commands(source, functions);
                    
                    if (this.settings.enableLifecycleLogging) {
                        console.log('Templater expansion completed (non-destructive)');
                        if (expanded !== source) {
                            console.log('Template variables were expanded');
                        }
                    }
                    
                    return expanded;
                } else {
                    if (this.settings.enableLifecycleLogging) {
                        console.warn('Templater parser not available');
                    }
                    return source;
                }
            } else {
                if (this.settings.enableLifecycleLogging) {
                    console.warn('Templater API not available (functions_generator not found)');
                }
                return source;
            }

        } catch (error) {
            console.warn('Templater expansion failed, using original source:', error);
            return source; // Graceful fallback
        }
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
            // Expand Templater variables first (if enabled)
            const expandedSource = await this.expandTemplaterVariables(source, ctx);
            
            // Use the comprehensive gallery processor with professional features
            const result = await this.galleryProcessor.processCodeBlock(expandedSource, el, ctx, {
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