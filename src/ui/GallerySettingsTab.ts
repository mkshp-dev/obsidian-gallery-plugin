import { App, PluginSettingTab, Setting, Notice, type SettingDefinitionItem, type SettingGroup } from 'obsidian';
import { ImmichClient } from '../services/immich/ImmichClient';
import type GalleryPlugin from '../main';
import { DEFAULT_SETTINGS } from '../models/settings';

export class GallerySettingsTab extends PluginSettingTab {
    plugin: GalleryPlugin;
    private activeTab: 'general' | 'providers' = 'general';

    constructor(app: App, plugin: GalleryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: '',
                items: [
                    {
                        name: '',
                        render: (setting: Setting) => {
                            setting.settingEl.empty();
                            setting.settingEl.addClass('gallery-settings-tab-header-setting');
                            const tabHeader = setting.settingEl.createDiv({ cls: 'gallery-settings-tab-header' });

                            const generalBtn = tabHeader.createEl('button', {
                                cls: `gallery-settings-tab-btn ${this.activeTab === 'general' ? 'is-active' : ''}`
                            });
                            generalBtn.createSpan({ cls: 'gallery-settings-tab-icon', text: '⚙️' });
                            generalBtn.createSpan({ cls: 'gallery-settings-tab-title', text: 'General' });
                            generalBtn.addEventListener('click', () => {
                                this.activeTab = 'general';
                                this.update();
                            });

                            const providersBtn = tabHeader.createEl('button', {
                                cls: `gallery-settings-tab-btn ${this.activeTab === 'providers' ? 'is-active' : ''}`
                            });
                            providersBtn.createSpan({ cls: 'gallery-settings-tab-icon', text: '🔌' });
                            providersBtn.createSpan({ cls: 'gallery-settings-tab-title', text: 'Providers' });
                            providersBtn.addEventListener('click', () => {
                                this.activeTab = 'providers';
                                this.update();
                            });
                        }
                    }
                ]
            },
            ...(this.activeTab === 'general' ? this.getGeneralDefinitions() : this.getProvidersDefinitions())
        ];
    }

    private getGeneralDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: 'Plugin preferences',
                items: [
                    {
                        name: 'Error display mode',
                        desc: 'How to display errors when the block processor encounters them.',
                        control: { type: 'dropdown', key: 'errorDisplayMode', options: { full: 'Full', text: 'Text only', hidden: 'Hidden' }, defaultValue: 'full' }
                    },
                    {
                        name: 'Allow remote images',
                        desc: 'Enable loading images from external URLs listed in the urls: field of the gallery config. This is opt-in to protect privacy.',
                        control: { type: 'toggle', key: 'allowRemoteImages', defaultValue: false }
                    },
                    {
                        name: 'Remote load timeout (ms)',
                        desc: 'Timeout in milliseconds for loading remote images.',
                        control: { type: 'number', key: 'remoteLoadTimeoutMs', defaultValue: DEFAULT_SETTINGS.remoteLoadTimeoutMs, min: 0 }
                    },
                    {
                        name: 'Validate remote content type',
                        desc: 'Perform a lightweight HEAD request to verify the Content-Type of remote URLs before loading them.',
                        control: { type: 'toggle', key: 'validateRemoteContentType', defaultValue: false }
                    },
                    {
                        name: 'Detached gallery grace period (ms)',
                        desc: 'How long (ms) to retain a detached gallery before final destruction. Useful to avoid losing galleries during editor/preview toggles.',
                        control: { type: 'number', key: 'gracePeriodMs', defaultValue: DEFAULT_SETTINGS.gracePeriodMs, min: 0 }
                    },
                    {
                        name: 'Enable lifecycle logging',
                        desc: 'Enable verbose lifecycle logs (debug) for gallery attach/detach events. Useful for troubleshooting mode toggles.',
                        control: { type: 'toggle', key: 'enableLifecycleLogging', defaultValue: false }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Captions',
                items: [
                    {
                        name: 'Show captions',
                        desc: 'Display image captions below gallery images.',
                        control: { type: 'toggle', key: 'showCaptions', defaultValue: true }
                    },
                    {
                        name: 'Caption max lines',
                        desc: 'Maximum number of lines to display before truncating with ellipsis.',
                        control: { type: 'number', key: 'captionMaxLines', defaultValue: DEFAULT_SETTINGS.captionMaxLines, min: 1, max: 10 }
                    }
                ]
            }
        ];
    }

    private getProvidersDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: 'Immich authenticated providers',
                desc: 'Configure authenticated access to your personal immich library. Note: Public immich-share links do not require configuration here.',
                items: [
                    {
                        name: 'Connections',
                        render: (setting: Setting, group: SettingGroup) => this.renderImmichConnections(setting, group)
                    }
                ]
            }
        ];
    }

    private renderImmichConnections(setting: Setting, group: SettingGroup): void {
        setting.settingEl.empty();
        setting.settingEl.addClass('gallery-immich-connections-setting');
        const containerEl = setting.settingEl.createDiv('immich-connections-container');

        this.plugin.settings.immichConnections.forEach((conn, index) => {
            const connDetails = containerEl.createEl('details', {
                cls: 'immich-connection-item'
            });

            if (!conn.key && !conn.baseUrl && !conn.apiKey) {
                connDetails.setAttribute('open', 'true');
            }

            const summary = connDetails.createEl('summary', { cls: 'immich-connection-summary' });

            const titleSpan = summary.createSpan({ cls: 'immich-connection-title' });
            const getTitle = (key: string) => key ? `Immich: ${key}` : 'New Immich connection';
            titleSpan.setText(getTitle(conn.key));

            const contentDiv = connDetails.createDiv('immich-connection-content');

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
                        new Notice(result.message);
                    })
                )
                .addButton(btn => btn
                    .setButtonText('Remove connection')
                    .setDestructive()
                    .onClick(async () => {
                        this.plugin.settings.immichConnections.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.plugin.refreshGalleries();
                        this.update();
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
                    this.plugin.refreshGalleries();
                    this.update();
                })
            );
    }

    getControlValue(key: string): unknown {
        return (this.plugin.settings as unknown as Record<string, unknown>)[key];
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
    }
}