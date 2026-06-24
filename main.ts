import { GalleryBuilderModal } from './src/ui/GalleryBuilderModal';
import { Logger } from "./src/utils/Logger";
import { Plugin, PluginSettingTab, Setting, App, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { ContentScanner } from './src/services/ContentScanner';
import { ImmichClient } from './src/services/immich/ImmichClient';
import { ViewFactory } from './src/views/ViewFactory';
import { GalleryProcessor } from './src/processors/GalleryProcessor';
import { VaultWatcher } from './src/utils/VaultWatcher';
import { LazyLoader } from './src/utils/LazyLoader';
import { ShowcaseGenerator } from './src/generators/ShowcaseGenerator';
import { IImmichConnection } from './src/models/interfaces';

interface AppWithCommands extends App {
    commands: {
        executeCommandById(id: string): boolean;
    };
}

/**
 * Plugin settings
 */
interface GalleryPluginSettings {
    errorDisplayMode?: 'full' | 'text' | 'hidden';
    allowRemoteImages: boolean;
    remoteLoadTimeoutMs: number;
    validateRemoteContentType?: boolean;
    // How long (ms) to wait before finally destroying a detached gallery
    gracePeriodMs?: number;
    // Enable verbose lifecycle logging to help debug detach/reattach behavior
    enableLifecycleLogging?: boolean;
    immichConnections: IImmichConnection[];
}

const DEFAULT_SETTINGS: GalleryPluginSettings = {
    errorDisplayMode: 'full',
    allowRemoteImages: false,
    remoteLoadTimeoutMs: 30000
    ,validateRemoteContentType: false
    ,gracePeriodMs: 30000
    ,enableLifecycleLogging: false
    ,immichConnections: []
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

        new Setting(containerEl)
            .setName('Plugin preferences')
            .setHeading();

        new Setting(containerEl)
            .setName('Error display mode')
            .setDesc('How to display errors when the block processor encounters them.')
            .addDropdown(dropdown => dropdown
                .addOption('full', 'Full')
                .addOption('text', 'Text only')
                .addOption('hidden', 'Hidden')
                .setValue(this.plugin.settings.errorDisplayMode || 'full')
                .onChange(async (value) => {
                    this.plugin.settings.errorDisplayMode = value as 'full' | 'text' | 'hidden';
                    await this.plugin.saveSettings();
                }));


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
            .setName('Immich authenticated providers')
            .setHeading()
            .setDesc('Configure authenticated access to your personal immich library. Note: Public immich-share links do not require configuration here.');

        const immichContainer = containerEl.createDiv('immich-connections-container');

        this.plugin.settings.immichConnections.forEach((conn, index) => {
            const connDiv = immichContainer.createDiv('immich-connection-item');
            // Replaced style properties with setCssStyles
            connDiv.setCssStyles({
                border: '1px solid var(--background-modifier-border)',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px'
            });

            new Setting(connDiv)
                .setName('Connection key')
                .setDesc('A stable reference used in gallery blocks (e.g. Home).')
                .addText(text => text
                    .setPlaceholder('Home')
                    .setValue(conn.key || '')
                    .onChange(async (value) => {
                        this.plugin.settings.immichConnections[index].key = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(connDiv)
                .setName('Base URL')
                .setDesc('The base URL of your immich server (e.g. Https://immich.example.com).')
                .addText(text => text
                    .setPlaceholder('https://immich.example.com')
                    .setValue(conn.baseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.immichConnections[index].baseUrl = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(connDiv)
                .setName('Api key')
                .setDesc('Your personal immich api key.')
                .addText(text => text
                    .setPlaceholder('Your api key')
                    .setValue(conn.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.immichConnections[index].apiKey = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(connDiv)
                .addButton(btn => btn
                    .setButtonText('Test connection')
                    .onClick(async () => {
                        const client = new ImmichClient(conn);
                        const result = await client.validateConnection();
                        new Notice(result.message);
                    })
                )
                .addButton(btn => btn
                    .setButtonText('Remove connection')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.immichConnections.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // Refresh UI
                    })
                );
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('Add immich connection')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.immichConnections.push({
                        key: '',
                        baseUrl: '',
                        apiKey: ''
                    });
                    await this.plugin.saveSettings();
                    this.display(); // Refresh UI
                })
            );
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
            if (this.settings.errorDisplayMode === 'hidden') {
                return;
            } else if (this.settings.errorDisplayMode === 'text') {
                el.createEl('div', {
                    text: 'Gallery processor not initialized',
                    cls: 'gallery-error-text'
                });
            } else {
                el.createEl('div', {
                    text: 'Gallery processor not initialized',
                    cls: 'gallery-error'
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
            if (this.settings.errorDisplayMode === 'hidden') {
                return;
            } else if (this.settings.errorDisplayMode === 'text') {
                el.createEl('div', {
                    text: `Gallery Error: ${error instanceof Error ? error.message : String(error)}`,
                    cls: 'gallery-error-text'
                });
            } else {
                el.createEl('div', {
                    text: `Gallery Error: ${error instanceof Error ? error.message : String(error)}`,
                    cls: 'gallery-error'
                });
            }
        }
    }
}