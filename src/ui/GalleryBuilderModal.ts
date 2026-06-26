import { App, Modal, Setting, Editor, Notice } from 'obsidian';
import type GalleryPlugin from '../../main';
import { ISourceConfig } from '../models/interfaces';
import { ImmichClient } from '../services/immich/ImmichClient';
import { GalleryYamlGenerator } from '../utils/GalleryYamlGenerator';

export class GalleryBuilderModal extends Modal {
    private plugin: GalleryPlugin;
    private editor: Editor;

    private viewType: string = 'grid';
    private sources: Partial<ISourceConfig>[] = [];

    constructor(app: App, plugin: GalleryPlugin, editor: Editor) {
        super(app);
        this.plugin = plugin;
        this.editor = editor;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('gallery-builder-modal');

        contentEl.createEl('h2', { text: 'Gallery view builder' });

        // View selector
        new Setting(contentEl)
            .setName('View type')
            .setDesc('Select the layout for your gallery.')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'grid': 'Grid',
                    'thumbnail': 'Thumbnail',
                    'carousel': 'Carousel'
                })
                .setValue(this.viewType)
                .onChange(value => {
                    this.viewType = value;
                })
            );

        // Sources container
        contentEl.createEl('h3', { text: 'Sources' });
        const sourcesContainer = contentEl.createDiv('gallery-builder-sources');

        this.renderSources(sourcesContainer);

        // Add source Dropdown
        new Setting(contentEl)
            .setName('Add source')
            .setDesc('Add a new source to the gallery.')
            .addDropdown(dropdown => {
                dropdown.addOptions({
                    '': 'Select source type...',
                    'local': 'Local Vault',
                    'external': 'External URLs',
                    'immich-share': 'Immich Share Link',
                    'immich': 'Immich Authenticated'
                });
                dropdown.onChange(async value => {
                    if (value) {
                        this.addSource(value as ISourceConfig['type'], sourcesContainer);
                        dropdown.setValue('');
                    }
                });
            });

        // Insert Button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Insert gallery')
                .setCta()
                .onClick(() => {
                    this.insertGallery();
                })
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private renderSources(container: HTMLElement) {
        container.empty();

        if (this.sources.length === 0) {
            container.createEl('p', { text: 'No sources added yet.', cls: 'setting-item-description' });
            return;
        }

        this.sources.forEach((source, index) => {
            const sourceCard = container.createDiv('gallery-builder-source-card');
            // Basic styling for the card
            sourceCard.setCssStyles({ border: '1px solid var(--background-modifier-border)', padding: '10px', marginBottom: '10px', borderRadius: '5px' });

            const headerRow = sourceCard.createDiv('gallery-builder-source-header');
            headerRow.setCssStyles({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });

            headerRow.createEl('strong', { text: `${index + 1}. ${source.type}` });

            const removeBtn = headerRow.createEl('button', { text: 'Remove' });
            removeBtn.addEventListener('click', () => {
                this.sources.splice(index, 1);
                this.renderSources(container);
            });

            this.renderSourceConfig(sourceCard, source, index, container);
        });
    }

    private addSource(type: ISourceConfig['type'], container: HTMLElement) {
        let newSource: Partial<ISourceConfig> = { type };
        switch (type) {
            case 'local':
                newSource = { type: 'local', path: '', recursive: true };
                break;
            case 'external':
                newSource = { type: 'external', urls: [''] };
                break;
            case 'immich-share':
                newSource = { type: 'immich-share', url: '' };
                break;
            case 'immich':
                newSource = { type: 'immich', connection: '' };
                break;
        }

        this.sources.push(newSource);
        this.renderSources(container);
    }

    private renderSourceConfig(container: HTMLElement, source: Partial<ISourceConfig>, index: number, rootContainer: HTMLElement) {
        if (source.type === 'local') {
            new Setting(container)
                .setName('Path')
                .setDesc('Folder path relative to vault root.')
                .addText(text => text
                    .setValue(source.path || '')
                    .onChange(value => {
                        source.path = value;
                    })
                );

            new Setting(container)
                .setName('Recursive')
                .setDesc('Include subfolders.')
                .addToggle(toggle => toggle
                    .setValue(source.recursive !== false)
                    .onChange(value => {
                        source.recursive = value;
                    })
                );
        } else if (source.type === 'external') {
            const urlsContainer = container.createDiv('gallery-builder-urls');

            const renderUrls = () => {
                urlsContainer.empty();

                if (!source.urls) source.urls = [''];

                source.urls.forEach((url, urlIndex) => {
                    new Setting(urlsContainer)
                        .setName(`URL ${urlIndex + 1}`)
                        .addText(text => text
                            .setValue(url)
                            .onChange(value => {
                                source.urls![urlIndex] = value;
                            })
                        )
                        .addButton(btn => btn
                            .setButtonText('Remove')
                            .onClick(() => {
                                source.urls!.splice(urlIndex, 1);
                                if (source.urls!.length === 0) source.urls = [''];
                                renderUrls();
                            })
                        );
                });

                new Setting(urlsContainer)
                    .addButton(btn => btn
                        .setButtonText('Add URL')
                        .onClick(() => {
                            source.urls!.push('');
                            renderUrls();
                        })
                    );
            };

            renderUrls();
        } else if (source.type === 'immich-share') {
            new Setting(container)
                .setName('Share URL')
                .setDesc('Immich public share link.')
                .addText(text => text
                    .setValue(source.url || '')
                    .onChange(value => {
                        source.url = value;
                    })
                );

            new Setting(container)
                .setName('Password')
                .setDesc('(Optional) password if the share link is protected.')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setValue(source.password || '')
                        .onChange(value => {
                            source.password = value;
                        });
                });
        } else if (source.type === 'immich') {
            const connections = this.plugin.settings.immichConnections || [];

            if (connections.length === 0) {
                container.createEl('p', {
                    text: 'No immich connections configured. Please add one in the plugin settings.',
                    cls: 'gallery-error-text'
                });
                return;
            }

            const connectionOptions: Record<string, string> = {};
            connections.forEach(conn => {
                connectionOptions[conn.key] = conn.key;
            });

            // Infer mode from current source state, default to 'album'
            let mode = 'album';
            if (source.sort?.by === 'createdAt' && source.limit) {
                mode = 'recent';
            } else if (source.filters?.isFavorite) {
                mode = 'favorites';
            } else if (source.filters?.tagIds) {
                mode = 'tags';
            }

            // Ensure source structure is initialized based on mode
            if (mode === 'album' && (!source.filters || !source.filters.albumIds)) {
                source.filters = { ...source.filters, albumIds: [] };
            }

            const connSetting = new Setting(container)
                .setName('Connection')
                .setDesc('Select an immich connection.');

            const modeSetting = new Setting(container)
                .setName('Mode')
                .setDesc('Select what to display from immich.');

            const dynamicContainer = container.createDiv('gallery-builder-immich-dynamic');

            const renderDynamicContent = async (connectionKey: string, currentMode: string) => {
                dynamicContainer.empty();

                if (!connectionKey) return;

                if (currentMode === 'album') {
                    const connection = connections.find(c => c.key === connectionKey);
                    if (!connection) return;

                    dynamicContainer.createEl('p', { text: 'Loading albums...' });

                    try {
                        const client = new ImmichClient(connection);
                        const albums = await client.getAlbums();

                        dynamicContainer.empty();

                        if (albums.length === 0) {
                            dynamicContainer.createEl('p', { text: 'No albums found on this connection.' });
                            return;
                        }

                        const albumOptions: Record<string, string> = {};
                        albums.forEach(album => {
                            albumOptions[album.id] = album.albumName || 'Untitled Album';
                        });

                        const albumIds = source.filters?.albumIds || [];
                        let selectedId = albumIds[0] || '';

                        // Ensure selected album is valid, or select the first one
                        if (!selectedId || !albumOptions[selectedId]) {
                            selectedId = albums[0].id;
                            source.filters = { albumIds: [selectedId] };
                            delete source.limit;
                            delete source.sort;
                        }

                        new Setting(dynamicContainer)
                            .setName('Album')
                            .setDesc('Select an album to display.')
                            .addDropdown(dropdown => dropdown
                                .addOptions(albumOptions)
                                .setValue(selectedId || '')
                                .onChange(value => {
                                    source.filters = { albumIds: [value] };
                                    delete source.limit;
                                    delete source.sort;
                                })
                            );
                    } catch (e) {
                        dynamicContainer.empty();
                        dynamicContainer.createEl('p', {
                            text: `Failed to load albums: ${e instanceof Error ? e.message : String(e)}`,
                            cls: 'gallery-error-text'
                        });
                    }
                } else if (currentMode === 'tags') {
                    const connection = connections.find(c => c.key === connectionKey);
                    if (!connection) return;

                    dynamicContainer.createEl('p', { text: 'Loading tags...' });

                    try {
                        const client = new ImmichClient(connection);
                        const tags = await client.getTags();

                        dynamicContainer.empty();

                        if (tags.length === 0) {
                            dynamicContainer.createEl('p', { text: 'No tags found on this connection.' });
                            return;
                        }

                        // Initialize tags filter if not present
                        source.filters = { ...source.filters };
                        if (!source.filters.tagIds) {
                            source.filters.tagIds = [];
                        }
                        // Remove incompatible global parameters
                        delete source.limit;
                        delete source.sort;

                        // Create a container with custom class for tags grid/list
                        const tagsContainer = dynamicContainer.createDiv('gallery-builder-tags-container');

                        tags.forEach(tag => {
                            const tagName = String(tag.name || tag.value || tag.id);
                            const isChecked = source.filters!.tagIds!.includes(tag.id);

                            new Setting(tagsContainer)
                                .setName(tagName)
                                .addToggle(toggle => toggle
                                    .setValue(isChecked)
                                    .onChange(checked => {
                                        if (checked) {
                                            if (!source.filters!.tagIds!.includes(tag.id)) {
                                                source.filters!.tagIds!.push(tag.id);
                                            }
                                        } else {
                                            source.filters!.tagIds = source.filters!.tagIds!.filter(id => id !== tag.id);
                                        }
                                        if (source.filters!.tagIds!.length === 0) {
                                            delete source.filters!.tagIds;
                                        }
                                    })
                                );
                        });

                    } catch (e) {
                        dynamicContainer.empty();
                        dynamicContainer.createEl('p', {
                            text: `Failed to load tags: ${e instanceof Error ? e.message : String(e)}`,
                            cls: 'gallery-error-text'
                        });
                    }
                } else if (currentMode === 'favorites') {
                    source.filters = { isFavorite: true };
                    delete source.limit;
                    delete source.sort;

                    dynamicContainer.createEl('p', {
                        text: 'This will display your favorite items from immich.',
                        cls: 'setting-item-description'
                    });
                } else if (currentMode === 'recent') {
                    // Initialize if missing
                    if (!source.limit) source.limit = 50;
                    if (!source.sort) source.sort = { by: 'createdAt', order: 'desc' };
                    delete source.filters;

                    new Setting(dynamicContainer)
                        .setName('Limit')
                        .setDesc('Maximum number of recent items to display.')
                        .addText(text => text
                            .setValue(source.limit?.toString() || '50')
                            .onChange(value => {
                                const parsed = parseInt(value, 10);
                                if (!isNaN(parsed) && parsed > 0) {
                                    source.limit = parsed;
                                }
                            })
                        );
                }
            };

            // Set initial connection or first available
            if (!source.connection || !connectionOptions[source.connection]) {
                source.connection = connections[0].key;
            }

            connSetting.addDropdown(dropdown => dropdown
                .addOptions(connectionOptions)
                .setValue(source.connection!)
                .onChange(async value => {
                    source.connection = value;
                    await renderDynamicContent(value, mode);
                })
            );

            modeSetting.addDropdown(dropdown => dropdown
                .addOptions({
                    'album': 'Album',
                    'favorites': 'Favorites',
                    'recent': 'Recent',
                    'tags': 'Tags'
                })
                .setValue(mode)
                .onChange(async value => {
                    mode = value;
                    await renderDynamicContent(source.connection!, mode);
                })
            );

            // Fetch initially
            renderDynamicContent(source.connection, mode).catch(e => console.error(e));
        }
    }

    private insertGallery() {
        try {
            const yaml = GalleryYamlGenerator.generateYaml(this.sources, this.viewType);
            this.editor.replaceSelection(yaml);
            this.close();
        } catch (e) {
            new Notice(`Failed to generate gallery: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
