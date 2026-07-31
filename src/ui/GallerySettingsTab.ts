import { App, PluginSettingTab, Setting, Notice, type SettingDefinitionItem, type SettingGroup } from 'obsidian';
import { ImmichClient } from '../services/immich/ImmichClient';
import type GalleryPlugin from '../main';
import { DEFAULT_SETTINGS } from '../models/settings';

export class GallerySettingsTab extends PluginSettingTab {
    plugin: GalleryPlugin;

    constructor(app: App, plugin: GalleryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
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
            },
            {
                type: 'group',
                heading: 'Immich authenticated providers',
                desc: 'Configure authenticated access to your personal Immich library. Note: Public immich-share links do not require configuration here.',
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
        const containerEl = setting.settingEl.createDiv('immich-connections-container');

        this.plugin.settings.immichConnections.forEach((conn, index) => {
            const connDetails = containerEl.createEl('details', {
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

            const titleSpan = summary.createSpan();
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
                        new Notice(result.message);
                    })
                )
                .addButton(btn => btn
                    .setButtonText('Remove connection')
                    .setDestructive()
                    .onClick(async () => {
                        this.plugin.settings.immichConnections.splice(index, 1);
                        await this.plugin.saveSettings();
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