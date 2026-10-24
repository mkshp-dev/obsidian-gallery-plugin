import { App, PluginSettingTab, Setting, Notice, setIcon, type SettingDefinitionItem } from 'obsidian';
import { ImmichClient } from '../services/immich/ImmichClient';
import { NextcloudClient } from '../services/nextcloud/NextcloudClient';
import type GalleryPlugin from '../main';
import { DEFAULT_SETTINGS } from '../models/settings';
import { IImmichConnection, INextcloudConnection } from '../models/interfaces';
import { ConnectionBase, connectionHost, connectionProblems } from './providerConnections';

/** A provider-specific field shown on a connection card, after the shared connection key */
interface FieldSpec<T> {
    prop: keyof T & string;
    name: string;
    desc: string;
    placeholder: string;
    /** Masked, with a show/hide button */
    secret?: boolean;
    /** When set, the field must be filled in; the value names it in the warning */
    required?: string;
}

/** Everything the Providers tab needs to render and manage one provider's connections */
interface ProviderSpec<T extends ConnectionBase> {
    id: 'immich' | 'nextcloud';
    label: string;
    icon: string;
    connections: () => T[];
    create: () => T;
    fields: FieldSpec<T>[];
    test: (conn: T) => Promise<{ success: boolean; message: string }>;
    /** Drop cached listings for a connection key, so edited credentials take effect */
    invalidate: (key: string) => void;
}

type ConnectionStatus = { state: 'untested' | 'testing' | 'ok' | 'error'; message?: string };

export class GallerySettingsTab extends PluginSettingTab {
    plugin: GalleryPlugin;
    private activeTab: 'general' | 'providers' = 'general';
    /** Expanded connection cards and last test results, kept while the settings window is open */
    private openCards = new Set<string>();
    private connectionStatus = new Map<string, ConnectionStatus>();

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
                        name: 'Enable debug logging',
                        desc: 'Write verbose debug logs to the developer console. Useful for troubleshooting.',
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
                heading: 'Pagination',
                desc: 'Split large galleries into pages instead of lazy-loading everything in one continuous scroll. Can be overridden per-gallery via the "pagination" and "itemsPerPage" keys in the view: config.',
                items: [
                    {
                        name: 'Enable pagination by default',
                        desc: 'Show Prev/Next page controls instead of lazy-loading the full image list. Off by default to preserve existing gallery behavior.',
                        control: { type: 'toggle', key: 'defaultPagination', defaultValue: DEFAULT_SETTINGS.defaultPagination }
                    },
                    {
                        name: 'Images per page',
                        desc: 'Number of images to display per page when pagination is enabled.',
                        control: { type: 'number', key: 'defaultItemsPerPage', defaultValue: DEFAULT_SETTINGS.defaultItemsPerPage, min: 1 }
                    }
                ]
            }
        ];
    }

    private getProvidersDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'group',
                heading: 'Immich',
                desc: 'Connections to your Immich servers, for immich sources. Share links (immich-share) need no connection.',
                items: [
                    {
                        name: 'Connections',
                        render: (setting: Setting) => this.renderProvider(setting, this.immichSpec())
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Nextcloud',
                desc: 'Connections to your Nextcloud servers, for nextcloud sources. Share links (nextcloud-share) need no connection.',
                items: [
                    {
                        name: 'Connections',
                        render: (setting: Setting) => this.renderProvider(setting, this.nextcloudSpec())
                    }
                ]
            }
        ];
    }

    private immichSpec(): ProviderSpec<IImmichConnection> {
        return {
            id: 'immich',
            label: 'Immich',
            icon: 'image',
            connections: () => this.plugin.settings.immichConnections,
            create: () => ({ key: '', baseUrl: '', apiKey: '' }),
            fields: [
                { prop: 'baseUrl', name: 'Server URL', desc: 'For example https://photos.example.com', placeholder: 'https://photos.example.com' },
                { prop: 'apiKey', name: 'API key', desc: 'Create one in Immich under Account settings → API keys. Read access is enough.', placeholder: 'API key', secret: true, required: 'API key' }
            ],
            test: conn => new ImmichClient(conn).validateConnection(),
            invalidate: key => ImmichClient.invalidateCache(key)
        };
    }

    private nextcloudSpec(): ProviderSpec<INextcloudConnection> {
        return {
            id: 'nextcloud',
            label: 'Nextcloud',
            icon: 'cloud',
            connections: () => this.plugin.settings.nextcloudConnections,
            create: () => ({ key: '', baseUrl: '', username: '', appPassword: '' }),
            fields: [
                { prop: 'baseUrl', name: 'Server URL', desc: 'For example https://cloud.example.com', placeholder: 'https://cloud.example.com' },
                { prop: 'username', name: 'Username', desc: 'Your login name, not your display name.', placeholder: 'Username', required: 'username' },
                { prop: 'appPassword', name: 'App password', desc: 'Create one in Nextcloud under Personal settings → Security.', placeholder: 'App password', secret: true, required: 'app password' }
            ],
            test: conn => new NextcloudClient(conn).validateConnection(),
            invalidate: key => NextcloudClient.invalidateCache(key)
        };
    }

    /** One provider section: a card per connection, an empty state, and an add button */
    private renderProvider<T extends ConnectionBase>(setting: Setting, spec: ProviderSpec<T>): void {
        setting.settingEl.empty();
        setting.settingEl.addClass('gallery-provider-setting');
        const listEl = setting.settingEl.createDiv('gallery-provider-list');
        const connections = spec.connections();

        if (connections.length === 0) {
            const empty = listEl.createDiv('gallery-provider-empty');
            empty.createSpan({ text: `No ${spec.label} connections yet.` });
            empty.createSpan({
                cls: 'gallery-provider-empty-hint',
                text: 'Run "Create showcase notes" to try the plugin with the read-only demo servers.'
            });
        }

        connections.forEach((conn, index) => this.renderConnectionCard(listEl, spec, conn, index));

        new Setting(listEl)
            .setClass('gallery-provider-add')
            .addButton(btn => btn
                .setButtonText(`Add ${spec.label} connection`)
                .onClick(async () => {
                    connections.push(spec.create());
                    this.openCards.add(`${spec.id}:${connections.length - 1}`);
                    await this.plugin.saveSettings();
                    this.update();
                })
            );
    }

    private renderConnectionCard<T extends ConnectionBase>(listEl: HTMLElement, spec: ProviderSpec<T>, conn: T, index: number): void {
        const cardId = `${spec.id}:${index}`;
        const isNew = !conn.key && !conn.baseUrl;
        const card = listEl.createDiv('gallery-provider-card');
        if (this.openCards.has(cardId) || isNew) card.addClass('is-open');

        // Header: always visible, toggles the body
        const header = card.createDiv({ cls: 'gallery-provider-card-header', attr: { role: 'button', tabindex: '0' } });
        setIcon(header.createSpan('gallery-provider-card-icon'), spec.icon);
        const titles = header.createDiv('gallery-provider-card-titles');
        const keyEl = titles.createSpan('gallery-provider-card-key');
        const hostEl = titles.createSpan('gallery-provider-card-host');
        const statusEl = header.createSpan('gallery-provider-status');
        setIcon(header.createSpan('gallery-provider-card-chevron'), 'chevron-right');

        const problemsEl = card.createDiv('gallery-provider-card-problems');

        const refreshHeader = () => {
            keyEl.setText(conn.key.trim() || 'Unnamed connection');
            keyEl.toggleClass('is-unnamed', !conn.key.trim());
            hostEl.setText(connectionHost(conn.baseUrl) || 'No server URL');

            const status = this.connectionStatus.get(cardId) ?? { state: 'untested' as const };
            statusEl.className = `gallery-provider-status is-${status.state}`;
            statusEl.setText({ untested: 'Not tested', testing: 'Testing…', ok: 'Connected', error: 'Failed' }[status.state]);
            statusEl.setAttr('title', status.message ?? '');

            const credentials: Record<string, string> = {};
            for (const field of spec.fields) {
                if (field.required) credentials[field.required] = String(conn[field.prop] ?? '');
            }
            problemsEl.empty();
            for (const problem of connectionProblems(conn, spec.connections(), credentials)) {
                const row = problemsEl.createDiv('gallery-provider-problem');
                setIcon(row.createSpan('gallery-provider-problem-icon'), 'alert-triangle');
                row.createSpan({ text: problem });
            }
            usageCode.setText(`connection: ${conn.key.trim() || '<key>'}`);
        };

        const toggle = () => {
            const open = !card.hasClass('is-open');
            card.toggleClass('is-open', open);
            header.setAttr('aria-expanded', String(open));
            if (open) this.openCards.add(cardId); else this.openCards.delete(cardId);
        };
        header.setAttr('aria-expanded', String(card.hasClass('is-open')));
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        // Body
        const body = card.createDiv('gallery-provider-card-body');

        // Changing a field forgets the last test result; leaving it re-fetches only galleries using this provider
        let keyOnFocus = conn.key;
        const onEdited = async () => {
            this.connectionStatus.delete(cardId);
            await this.plugin.saveSettings();
            refreshHeader();
        };
        const onCommitted = () => {
            spec.invalidate(keyOnFocus);
            spec.invalidate(conn.key);
            keyOnFocus = conn.key;
            this.plugin.refreshGalleries([spec.id]);
        };

        new Setting(body)
            .setName('Connection key')
            .setDesc('The name gallery blocks use for this connection.')
            .addText(text => {
                text.setPlaceholder('Home')
                    .setValue(conn.key)
                    .onChange(async value => {
                        conn.key = value;
                        await onEdited();
                    });
                text.inputEl.addEventListener('focus', () => { keyOnFocus = conn.key; });
                text.inputEl.addEventListener('change', onCommitted);
            });

        for (const field of spec.fields) {
            new Setting(body)
                .setName(field.name)
                .setDesc(field.desc)
                .addText(text => {
                    text.setPlaceholder(field.placeholder)
                        .setValue(String(conn[field.prop] ?? ''))
                        .onChange(async value => {
                            (conn as Record<string, unknown>)[field.prop] = value;
                            await onEdited();
                        });
                    text.inputEl.addEventListener('change', onCommitted);
                    if (field.secret) {
                        text.inputEl.type = 'password';
                        text.inputEl.addClass('gallery-provider-secret');
                    }
                })
                .then(row => {
                    if (!field.secret) return;
                    row.addExtraButton(btn => btn
                        .setIcon('eye')
                        .setTooltip('Show')
                        .onClick(() => {
                            const input = row.controlEl.querySelector('input');
                            if (!input) return;
                            const reveal = input.type === 'password';
                            input.type = reveal ? 'text' : 'password';
                            btn.setIcon(reveal ? 'eye-off' : 'eye').setTooltip(reveal ? 'Hide' : 'Show');
                        }));
                });
        }

        // How to use it in a gallery block
        const usage = body.createDiv('gallery-provider-usage');
        usage.createSpan({ cls: 'gallery-provider-usage-label', text: 'Use in gallery blocks:' });
        const usageCode = usage.createEl('code');
        const copyBtn = usage.createEl('button', { cls: 'clickable-icon gallery-provider-copy', attr: { 'aria-label': 'Copy' } });
        setIcon(copyBtn, 'copy');
        copyBtn.addEventListener('click', () => {
            void navigator.clipboard.writeText(usageCode.getText()).then(() => new Notice('Copied'));
        });

        // Actions
        const actions = new Setting(body).setClass('gallery-provider-actions');
        actions.addButton(btn => btn
            .setButtonText('Test connection')
            .onClick(async () => {
                btn.setDisabled(true);
                this.connectionStatus.set(cardId, { state: 'testing' });
                refreshHeader();
                try {
                    const result = await spec.test(conn);
                    this.connectionStatus.set(cardId, { state: result.success ? 'ok' : 'error', message: result.message });
                    if (!result.success) new Notice(result.message);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.connectionStatus.set(cardId, { state: 'error', message });
                    new Notice(message);
                } finally {
                    btn.setDisabled(false);
                    refreshHeader();
                }
            }));
        actions.addButton(btn => {
            let armed = false;
            let disarm: number | undefined;
            btn.setButtonText('Remove')
                .setDestructive()
                .onClick(async () => {
                    if (!armed) {
                        // First click arms the button; removing needs a second click within a few seconds
                        armed = true;
                        btn.setButtonText('Click again to remove');
                        disarm = window.setTimeout(() => {
                            armed = false;
                            btn.setButtonText('Remove');
                        }, 4000);
                        return;
                    }
                    window.clearTimeout(disarm);
                    spec.connections().splice(index, 1);
                    spec.invalidate(conn.key);
                    this.forgetCards(spec.id);
                    await this.plugin.saveSettings();
                    this.plugin.refreshGalleries([spec.id]);
                    this.update();
                });
        });

        refreshHeader();
    }

    /** Card state is keyed by position, so drop a provider's state when its list changes */
    private forgetCards(providerId: string): void {
        for (const id of [...this.openCards]) if (id.startsWith(`${providerId}:`)) this.openCards.delete(id);
        for (const id of [...this.connectionStatus.keys()]) if (id.startsWith(`${providerId}:`)) this.connectionStatus.delete(id);
    }

    getControlValue(key: string): unknown {
        return (this.plugin.settings as unknown as Record<string, unknown>)[key];
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();
        // Only the remote-image settings change which external images a gallery gets; every
        // other general setting is a view option, so re-render without fetching anything again.
        const affectsExternalSources = key === 'allowRemoteImages' || key === 'validateRemoteContentType';
        this.plugin.refreshGalleries(affectsExternalSources ? ['external'] : 'none');
    }
}