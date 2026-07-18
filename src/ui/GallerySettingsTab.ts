import { posthog } from '../analytics';
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { ImmichClient } from '../services/immich/ImmichClient';
import type GalleryPlugin from '../main';
import { DEFAULT_SETTINGS } from '../models/settings';

export class GallerySettingsTab extends PluginSettingTab {
    plugin: GalleryPlugin;
    activeTab: 'general' | 'providers' = 'general';

    constructor(app: App, plugin: GalleryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Render Tabs Navigation
        const tabsContainer = containerEl.createDiv('gallery-settings-tabs');
        tabsContainer.setCssStyles({
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            borderBottom: '1px solid var(--background-modifier-border)'
        });

        const generalTab = tabsContainer.createDiv('gallery-settings-tab');
        generalTab.setText('General');
        generalTab.setCssStyles({
            padding: '5px 10px',
            cursor: 'pointer',
            borderBottom: this.activeTab === 'general' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
            fontWeight: this.activeTab === 'general' ? 'bold' : 'normal',
            color: this.activeTab === 'general' ? 'var(--text-normal)' : 'var(--text-muted)'
        });
        generalTab.onclick = () => {
            this.activeTab = 'general';
            this.display();
        };

        const providersTab = tabsContainer.createDiv('gallery-settings-tab');
        providersTab.setText('Providers');
        providersTab.setCssStyles({
            padding: '5px 10px',
            cursor: 'pointer',
            borderBottom: this.activeTab === 'providers' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
            fontWeight: this.activeTab === 'providers' ? 'bold' : 'normal',
            color: this.activeTab === 'providers' ? 'var(--text-normal)' : 'var(--text-muted)'
        });
        providersTab.onclick = () => {
            this.activeTab = 'providers';
            this.display();
        };

        if (this.activeTab === 'general') {
            this.displayGeneral(containerEl);
        } else if (this.activeTab === 'providers') {
            this.displayProviders(containerEl);
        }
    }

    private displayGeneral(containerEl: HTMLElement): void {
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
                    posthog.capture('setting_changed', { setting_name: 'error_display_mode', setting_value: value });
                }));

        new Setting(containerEl)
            .setName('Allow remote images')
            .setDesc('Enable loading images from external URLs listed in the `urls:` field of the gallery config. This is opt-in to protect privacy.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.allowRemoteImages)
                .onChange(async (value) => {
                    this.plugin.settings.allowRemoteImages = value;
                    await this.plugin.saveSettings();
                    posthog.capture('setting_changed', { setting_name: 'allow_remote_images', setting_value: value });
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
                    posthog.capture('setting_changed', { setting_name: 'validate_remote_content_type', setting_value: value });
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
                    posthog.capture('setting_changed', { setting_name: 'enable_lifecycle_logging', setting_value: value });
                }));
    }

    private displayProviders(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Immich authenticated providers')
            .setHeading()
            .setDesc('Configure authenticated access to your personal immich library. Note: Public immich-share links do not require configuration here.');

        const immichContainer = containerEl.createDiv('immich-connections-container');

        this.plugin.settings.immichConnections.forEach((conn, index) => {
            const connDetails = immichContainer.createEl('details', {
                cls: 'immich-connection-item'
            });
            connDetails.setCssStyles({
                border: '1px solid var(--background-modifier-border)',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '5px'
            });

            // Expand by default if it's a new / empty connection
            if (!conn.key && !conn.baseUrl && !conn.apiKey) {
                connDetails.setAttribute('open', 'true');
            }

            const summary = connDetails.createEl('summary');
            summary.setCssStyles({
                cursor: 'pointer',
                fontWeight: 'bold',
                outline: 'none',
                userSelect: 'none',
                padding: '4px 0'
            });

            const titleSpan = summary.createEl('span');
            const getTitle = (key: string) => key ? `Immich: ${key}` : 'New Immich connection';
            titleSpan.setText(getTitle(conn.key));
            titleSpan.setCssStyles({
                marginLeft: '8px'
            });

            const contentDiv = connDetails.createDiv();
            contentDiv.setCssStyles({
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--background-modifier-border)'
            });

            new Setting(contentDiv)
                .setName('Connection key')
                .setDesc('A stable reference used in gallery blocks (e.g. Home).')
                .addText(text => text
                    .setPlaceholder('Home')
                    .setValue(conn.key || '')
                    .onChange(async (value) => {
                        this.plugin.settings.immichConnections[index].key = value;
                        await this.plugin.saveSettings();
                        titleSpan.setText(getTitle(value));
                    })
                );

            new Setting(contentDiv)
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

            new Setting(contentDiv)
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

            new Setting(contentDiv)
                .addButton(btn => btn
                    .setButtonText('Test connection')
                    .onClick(async () => {
                        const client = new ImmichClient(conn);
                        const result = await client.validateConnection();
                        posthog.capture('immich_connection_tested', { success: result.success });
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
                    posthog.capture('immich_connection_added');
                    this.display(); // Refresh UI
                })
            );
    }
}