import { App, Modal, Setting, Editor, Notice, TFolder } from 'obsidian';
import type GalleryPlugin from '../main';
import { ISourceConfig, ILocalSourceConfig, INextcloudSourceConfig, INextcloudShareSourceConfig } from '../models/interfaces';
import { ImmichClient } from '../services/immich/ImmichClient';
import { GalleryYamlGenerator } from '../utils/GalleryYamlGenerator';
import { NotePathResolver } from '../utils/NotePathResolver';

export class GalleryBuilderModal extends Modal {
    private plugin: GalleryPlugin;
    private editor: Editor;

    private viewType: string = 'grid';
    private sources: Partial<ISourceConfig>[] = [];
    private livePreviewContainer!: HTMLElement;

    constructor(app: App, plugin: GalleryPlugin, editor: Editor) {
        super(app);
        this.plugin = plugin;
        this.editor = editor;
    }

    onOpen() {
        this.modalEl.addClass('gallery-builder-modal-container');
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('gallery-builder-modal');

        // Header Section
        const header = contentEl.createDiv('gallery-builder-header');
        const titleDiv = header.createDiv('gallery-builder-header-title');
        titleDiv.createSpan({ cls: 'gallery-builder-header-icon', text: '🎨' });
        titleDiv.createEl('h2', { text: 'Gallery view builder' });
        header.createEl('p', {
            cls: 'gallery-builder-header-desc',
            text: 'Configure sources and view layout to insert interactive galleries into your note.'
        });

        const body = contentEl.createDiv('gallery-builder-body');
        const mainCol = body.createDiv('gallery-builder-main-col');
        const sideCol = body.createDiv('gallery-builder-side-col');

        // 1. Layout & View Section
        const viewSection = mainCol.createDiv('gallery-builder-section');
        const viewTitle = viewSection.createDiv('gallery-builder-section-title');
        viewTitle.createSpan({ cls: 'gallery-builder-badge', text: '1' });
        viewTitle.createEl('h3', { text: 'Layout & view' });

        new Setting(viewSection)
            .setName('View type')
            .setDesc('Select the rendering layout for your gallery.')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'grid': 'Grid (Masonry)',
                    'thumbnail': 'Thumbnail Grid',
                    'carousel': 'Carousel (Slideshow)',
                    'embed': 'Embed (Continuous)'
                })
                .setValue(this.viewType)
                .onChange(value => {
                    this.viewType = value;
                    this.refreshLivePreview();
                })
            );

        // 2. Sources Section
        const sourcesSection = mainCol.createDiv('gallery-builder-section');
        const sourcesHeader = sourcesSection.createDiv('gallery-builder-section-header');

        const sourcesTitle = sourcesHeader.createDiv('gallery-builder-section-title');
        sourcesTitle.createSpan({ cls: 'gallery-builder-badge', text: '2' });
        sourcesTitle.createEl('h3', { text: 'Image sources' });

        // Quick add pills
        const quickAdd = sourcesHeader.createDiv('gallery-builder-quick-add');
        const quickOptions: Array<{ type: ISourceConfig['type']; label: string }> = [
            { type: 'local', label: '+ Local vault' },
            { type: 'external', label: '+ External URLs' },
            { type: 'immich-share', label: '+ Immich share' },
            { type: 'immich', label: '+ Immich auth' },
            { type: 'nextcloud', label: '+ Nextcloud auth' },
            { type: 'nextcloud-share', label: '+ Nextcloud share' }
        ];

        const sourcesContainer = sourcesSection.createDiv('gallery-builder-sources-list');

        quickOptions.forEach(opt => {
            const btn = quickAdd.createEl('button', {
                cls: 'gallery-builder-pill',
                text: opt.label
            });
            btn.addEventListener('click', () => {
                this.addSource(opt.type, sourcesContainer);
            });
        });

        this.renderSources(sourcesContainer);

        // 3. Live Preview Section
        const previewSection = sideCol.createDiv('gallery-builder-section');
        const previewTitle = previewSection.createDiv('gallery-builder-section-title');
        previewTitle.createSpan({ cls: 'gallery-builder-badge', text: '3' });
        previewTitle.createEl('h3', { text: 'Generated codeblock' });

        const previewBox = previewSection.createDiv('gallery-builder-preview-box');
        const previewHeader = previewBox.createDiv('gallery-builder-preview-header');
        previewHeader.createSpan({ cls: 'gallery-builder-preview-lang', text: 'obs-gallery' });

        const copyBtn = previewHeader.createEl('button', { cls: 'gallery-builder-copy-btn', text: 'Copy code' });
        copyBtn.addEventListener('click', () => {
            const codeText = this.livePreviewContainer?.innerText || '';
            if (codeText) {
                void navigator.clipboard.writeText(codeText);
                new Notice('Gallery yaml copied to clipboard!');
            }
        });

        const pre = previewBox.createEl('pre', { cls: 'gallery-builder-preview-code' });
        this.livePreviewContainer = pre.createEl('code');

        // Modal Footer Buttons
        const footer = contentEl.createDiv('gallery-builder-footer');
        const cancelBtn = footer.createEl('button', { cls: 'gallery-builder-cancel-btn', text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const insertBtn = footer.createEl('button', { cls: 'gallery-builder-insert-btn mod-cta', text: 'Insert gallery block' });
        insertBtn.addEventListener('click', () => this.insertGallery());

        this.refreshLivePreview();
    }

    private refreshLivePreview() {
        if (!this.livePreviewContainer) return;
        this.livePreviewContainer.empty();
        if (this.sources.length === 0) {
            this.livePreviewContainer.setText('# Add at least one source above to generate gallery configuration.');
            return;
        }
        try {
            const yaml = GalleryYamlGenerator.generateYaml(this.sources, this.viewType);
            this.livePreviewContainer.setText(yaml);
        } catch (e) {
            this.livePreviewContainer.setText(`# Cannot generate preview: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private renderSources(container: HTMLElement) {
        container.empty();

        if (this.sources.length === 0) {
            const emptyState = container.createDiv('gallery-builder-empty-state');
            emptyState.createDiv({ cls: 'gallery-builder-empty-icon', text: '🖼️' });
            emptyState.createEl('h4', { text: 'No image sources added yet' });
            emptyState.createEl('p', { text: 'Click one of the buttons above to add local files, external URLs, or immich albums.' });
            return;
        }

        const iconMap: Record<string, string> = {
            'local': '📁',
            'external': '🌐',
            'immich-share': '🔗',
            'immich': '🔐',
            'nextcloud': '☁️',
            'nextcloud-share': '🔗'
        };

        const nameMap: Record<string, string> = {
            'local': 'Local Vault',
            'external': 'External URLs',
            'immich-share': 'Immich Share Link',
            'immich': 'Immich Authenticated',
            'nextcloud': 'Nextcloud Authenticated',
            'nextcloud-share': 'Nextcloud Share Link'
        };

        this.sources.forEach((source, index) => {
            const sourceCard = container.createDiv('gallery-builder-source-card');

            const headerRow = sourceCard.createDiv('gallery-builder-source-card-header');
            const titleDiv = headerRow.createDiv('gallery-builder-source-title');
            const icon = iconMap[source.type || 'local'] || '📁';
            const name = nameMap[source.type || 'local'] || source.type;

            titleDiv.createSpan({ text: icon });
            titleDiv.createSpan({ text: `Source #${index + 1}: ${name}` });

            const removeBtn = headerRow.createEl('button', {
                cls: 'gallery-builder-remove-icon-btn',
                title: 'Remove source'
            });
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                this.sources.splice(index, 1);
                this.renderSources(container);
                this.refreshLivePreview();
            });

            const bodyDiv = sourceCard.createDiv('gallery-builder-source-card-body');
            this.renderSourceConfig(bodyDiv, source, index, container);
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
            case 'nextcloud':
                newSource = { type: 'nextcloud', connection: '' };
                break;
            case 'nextcloud-share':
                newSource = { type: 'nextcloud-share', url: '' };
                break;
        }

        this.sources.push(newSource);
        this.renderSources(container);
        this.refreshLivePreview();
    }

    private renderSourceConfig(container: HTMLElement, source: Partial<ISourceConfig>, index: number, rootContainer: HTMLElement) {
        if (source.type === 'local') {
            const folders = this.app.vault.getAllLoadedFiles()
                .filter((f): f is TFolder => f instanceof TFolder)
                .sort((a, b) => a.path.localeCompare(b.path));

            const activeFile = this.app.workspace.getActiveFile();

            const folderOptions: Record<string, string> = {};
            if (activeFile) {
                folderOptions['.'] = "📍 Current note's folder";
            }
            folderOptions['/'] = '/ (Vault root)';
            folders.forEach(f => {
                if (f.path && f.path !== '/') {
                    folderOptions[f.path] = f.path;
                }
            });

            if (source.path && !(source.path in folderOptions)) {
                folderOptions[source.path] = source.path;
            }

            const currentPath = source.path || '/';
            const isRelative = NotePathResolver.isRelative(currentPath);

            new Setting(container)
                .setName('Path')
                .setDesc('Select a vault folder, or "current note\'s folder" to stay relative to this note (keeps working if the note or folder is renamed).')
                .addDropdown(dropdown => {
                    dropdown.addOptions(folderOptions);
                    dropdown.setValue(currentPath);
                    dropdown.onChange(value => {
                        // Preserve "keep relative to note" mode across dropdown reselections,
                        // so picking a different folder doesn't silently revert to an absolute path.
                        if (activeFile && NotePathResolver.isRelative(source.path || '')) {
                            source.path = NotePathResolver.toRelative(value, activeFile.path);
                        } else {
                            source.path = value;
                        }
                        this.refreshLivePreview();
                    });
                    dropdown.selectEl.addClass('gallery-builder-wide-select');
                });

            if (activeFile) {
                new Setting(container)
                    .setName('Keep relative to this note')
                    .setDesc('Store the path relative to this note (e.g. "../sibling") instead of an absolute vault path, so the gallery keeps working if this note or folder is renamed or moved.')
                    .addToggle(toggle => toggle
                        .setValue(isRelative)
                        .onChange(value => {
                            const absolute = NotePathResolver.resolve(source.path || '/', activeFile.path);
                            source.path = value ? NotePathResolver.toRelative(absolute, activeFile.path) : absolute;
                            this.renderSources(rootContainer);
                            this.refreshLivePreview();
                        })
                    );
            }

            new Setting(container)
                .setName('Recursive')
                .setDesc('Include subfolders.')
                .addToggle(toggle => toggle
                    .setValue(source.recursive !== false)
                    .onChange(value => {
                        source.recursive = value;
                        this.refreshLivePreview();
                    })
                );

            new Setting(container)
                .setName('Limit')
                .setDesc('Maximum number of items to fetch.')
                .addText(text => text
                    .setValue(source.limit?.toString() || '')
                    .onChange(value => {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            source.limit = parsed;
                        } else {
                            delete source.limit;
                        }
                        this.refreshLivePreview();
                    })
                );

            const localFilterContent = this.createCollapsibleSection(container, 'Filter criteria', false);

            new Setting(localFilterContent)
                .setName('Filename filter')
                .setDesc('Glob pattern for filenames (e.g. *.jpg)')
                .addText(text => text
                    .setPlaceholder('*.jpg')
                    .setValue(source.filenameFilter || '')
                    .onChange(value => {
                        if (value) {
                            source.filenameFilter = value;
                        } else {
                            delete source.filenameFilter;
                        }
                        this.refreshLivePreview();
                    })
                );

            {
                const typedSource = source as unknown as ILocalSourceConfig;
                this.createDateRangeSetting(
                    localFilterContent,
                    'Modified',
                    'Only show files modified within this range.',
                    typedSource.filters?.modifiedAfter || '',
                    typedSource.filters?.modifiedBefore || '',
                    value => {
                        if (!typedSource.filters) typedSource.filters = {};
                        if (value) {
                            typedSource.filters.modifiedAfter = value;
                        } else {
                            delete typedSource.filters.modifiedAfter;
                            if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                        }
                        this.refreshLivePreview();
                    },
                    value => {
                        if (!typedSource.filters) typedSource.filters = {};
                        if (value) {
                            typedSource.filters.modifiedBefore = value;
                        } else {
                            delete typedSource.filters.modifiedBefore;
                            if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                        }
                        this.refreshLivePreview();
                    }
                );
            }

            this.markPaired(new Setting(localFilterContent)
                .setName('Min / max size (kb)')
                .setDesc('File size range in kilobytes.')
                .addText(text => {
                    const typedSource = source as unknown as ILocalSourceConfig;
                    return text
                        .setPlaceholder('Min (e.g. 100)')
                        .setValue(typedSource.filters?.minSizeKb?.toString() || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed >= 0) {
                                typedSource.filters.minSizeKb = parsed;
                            } else {
                                delete typedSource.filters.minSizeKb;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                })
                .addText(text => {
                    const typedSource = source as unknown as ILocalSourceConfig;
                    return text
                        .setPlaceholder('Max (e.g. 5000)')
                        .setValue(typedSource.filters?.maxSizeKb?.toString() || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                                typedSource.filters.maxSizeKb = parsed;
                            } else {
                                delete typedSource.filters.maxSizeKb;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                }));

            const localSortContent = this.createCollapsibleSection(container, 'Sort', false);

            this.markPaired(new Setting(localSortContent)
                .setName('Sort by / order')
                .setDesc('Property and direction to sort by.')
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as ILocalSourceConfig;
                    return dropdown
                        .addOption('name', 'Name')
                        .addOption('modified', 'Last modified')
                        .addOption('size', 'Size')
                        .setValue(typedSource.sort?.by || 'name')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.by = value as 'name' | 'modified' | 'size';
                            this.refreshLivePreview();
                        });
                })
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as ILocalSourceConfig;
                    return dropdown
                        .addOption('asc', 'Ascending')
                        .addOption('desc', 'Descending')
                        .setValue(typedSource.sort?.order || 'asc')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.order = value as 'asc' | 'desc';
                            this.refreshLivePreview();
                        });
                }));
        } else if (source.type === 'external') {
            const urlsContainer = container.createDiv('gallery-builder-urls');

            const renderUrls = () => {
                urlsContainer.empty();

                if (!source.urls) source.urls = [''];

                source.urls.forEach((item, urlIndex) => {
                    const urlVal = typeof item === 'string' ? item : (item?.url || '');
                    const captionVal = typeof item === 'object' && item !== null ? (item.caption || '') : '';

                    new Setting(urlsContainer)
                        .setName(`URL ${urlIndex + 1}`)
                        .addText(text => text
                            .setPlaceholder('https://example.com/image.jpg')
                            .setValue(urlVal)
                            .onChange(value => {
                                const currentItem = source.urls![urlIndex];
                                const currentCaption = typeof currentItem === 'object' && currentItem !== null
                                    ? currentItem.caption
                                    : undefined;

                                if (currentCaption && currentCaption.trim()) {
                                    source.urls![urlIndex] = { url: value, caption: currentCaption };
                                } else {
                                    source.urls![urlIndex] = value;
                                }
                                this.refreshLivePreview();
                            })
                        )
                        .addText(text => text
                            .setPlaceholder('Caption (optional)')
                            .setValue(captionVal)
                            .onChange(captionValue => {
                                const currentItem = source.urls![urlIndex];
                                const currentUrl = typeof currentItem === 'string'
                                    ? currentItem
                                    : (currentItem?.url || '');

                                if (captionValue && captionValue.trim()) {
                                    source.urls![urlIndex] = { url: currentUrl, caption: captionValue.trim() };
                                } else {
                                    source.urls![urlIndex] = currentUrl;
                                }
                                this.refreshLivePreview();
                            })
                        )
                        .addButton(btn => btn
                            .setButtonText('✕')
                            .onClick(() => {
                                source.urls!.splice(urlIndex, 1);
                                if (source.urls!.length === 0) source.urls = [''];
                                renderUrls();
                                this.refreshLivePreview();
                            })
                            .then(b => {
                                b.buttonEl.addClass('gallery-builder-remove-icon-btn');
                                b.buttonEl.setAttribute('title', 'Remove URL');
                            })
                        );
                });

                new Setting(urlsContainer)
                    .addButton(btn => btn
                        .setButtonText('Add URL')
                        .onClick(() => {
                            source.urls!.push('');
                            renderUrls();
                            this.refreshLivePreview();
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
                        this.refreshLivePreview();
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
                            this.refreshLivePreview();
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

            // Ensure filters object exists
            if (!source.filters) {
                source.filters = {};
            }

            // Connection Section
            new Setting(container).setName('Connection').setHeading();

            if (!source.connection || !connectionOptions[source.connection]) {
                source.connection = connections[0].key;
            }

            const connSetting = new Setting(container)
                .setName('Connection')
                .setDesc('Select an immich connection.');

            const renderDynamicContent = async (connectionKey: string) => {
                filtersContainer.empty();

                const connection = connections.find(c => c.key === connectionKey);
                if (!connection) return;

                // Static Filters
                const criteriaContent = this.createCollapsibleSection(filtersContainer, 'Filter criteria', true);

                this.markPaired(new Setting(criteriaContent)
                    .setName('Favorites & type')
                    .setDesc('Favorites-only toggle and asset type.')
                    .addToggle(toggle => toggle
                        .setValue(source.filters?.isFavorite || false)
                        .onChange(value => {
                            if (value) {
                                source.filters!.isFavorite = true;
                            } else {
                                delete source.filters!.isFavorite;
                            }
                            this.refreshLivePreview();
                        })
                    )
                    .addDropdown(dropdown => dropdown
                        .addOptions({'': 'All types', 'image': 'Image', 'video': 'Video'})
                        .setValue(source.filters?.assetType || '')
                        .onChange(value => {
                            if (value) {
                                source.filters!.assetType = value as 'image' | 'video';
                            } else {
                                delete source.filters!.assetType;
                            }
                            this.refreshLivePreview();
                        })
                    ));

                this.createDateRangeSetting(
                    criteriaContent,
                    'Created',
                    'Only include photos created within this range.',
                    source.filters?.createdAfter || '',
                    source.filters?.createdBefore || '',
                    value => {
                        if (value) {
                            source.filters!.createdAfter = value;
                        } else {
                            delete source.filters!.createdAfter;
                        }
                        this.refreshLivePreview();
                    },
                    value => {
                        if (value) {
                            source.filters!.createdBefore = value;
                        } else {
                            delete source.filters!.createdBefore;
                        }
                        this.refreshLivePreview();
                    }
                );

                const client = new ImmichClient(connection);

                // Albums
                const albumsContent = this.createCollapsibleSection(filtersContainer, 'Albums', false);
                const albumsWrapper = albumsContent.createDiv();
                albumsWrapper.createEl('p', { text: 'Loading albums...' });
                try {
                    const albums = await client.getAlbums();
                    albumsWrapper.empty();
                    const albumItems = albums.map(a => ({ id: a.id, name: a.albumName || 'Untitled Album' }));
                    this.createSearchableList(albumsWrapper, albumItems, source.filters?.albumIds || [], (selected) => {
                        if (selected.length > 0) {
                            source.filters!.albumIds = selected;
                        } else {
                            delete source.filters!.albumIds;
                        }
                        this.refreshLivePreview();
                    }, false); // Allow multi-select, although previously it was single in builder. Let's stick to array support as per schema.
                } catch (e) {
                    albumsWrapper.empty();
                    albumsWrapper.createEl('p', { text: `Failed to load albums: ${e instanceof Error ? e.message : String(e)}`, cls: 'gallery-error-text' });
                }

                // Tags
                const tagsContent = this.createCollapsibleSection(filtersContainer, 'Tags', false);
                const tagsWrapper = tagsContent.createDiv();
                tagsWrapper.createEl('p', { text: 'Loading tags...' });
                try {
                    const tags = await client.getTags();
                    tagsWrapper.empty();
                    const tagItems = tags.map(t => {
                        const name = t.value || t.id;
                        return { id: name, name: name }; // Use value for ImmichTag
                    });
                    this.createSearchableList(tagsWrapper, tagItems, source.filters?.tags || [], (selected) => {
                        if (selected.length > 0) {
                            source.filters!.tags = selected;
                        } else {
                            delete source.filters!.tags;
                        }
                        this.refreshLivePreview();
                    });
                } catch (e) {
                    tagsWrapper.empty();
                    tagsWrapper.createEl('p', { text: `Failed to load tags: ${e instanceof Error ? e.message : String(e)}`, cls: 'gallery-error-text' });
                }

                // People
                const peopleContent = this.createCollapsibleSection(filtersContainer, 'People', false);
                const peopleWrapper = peopleContent.createDiv();
                peopleWrapper.createEl('p', { text: 'Loading people...' });
                try {
                    const people = await client.getPeople();
                    peopleWrapper.empty();
                    const peopleItems = people.map(p => {
                        const name = String(p.name || p.id);
                        return { id: name, name: name }; // Use name for ImmichPerson
                    });
                    this.createSearchableList(peopleWrapper, peopleItems, source.filters?.people || [], (selected) => {
                        if (selected.length > 0) {
                            source.filters!.people = selected;
                        } else {
                            delete source.filters!.people;
                        }
                        this.refreshLivePreview();
                    });
                } catch (e) {
                    peopleWrapper.empty();
                    peopleWrapper.createEl('p', { text: `Failed to load people: ${e instanceof Error ? e.message : String(e)}`, cls: 'gallery-error-text' });
                }
            };

            new Setting(container).setName('Filters').setHeading();

            new Setting(container)
                .setName('Refresh metadata')
                .setDesc('Clear cache and refetch albums, tags, and people')
                .addButton(button => button
                    .setButtonText('Refresh')
                    .onClick(async () => {
                        if (source.connection) {
                            ImmichClient.invalidateCache(source.connection);
                            await renderDynamicContent(source.connection);
                        }
                        this.refreshLivePreview();
                    })
                );

            const filtersContainer = container.createDiv('gallery-builder-immich-filters');

            connSetting.addDropdown(dropdown => dropdown
                .addOptions(connectionOptions)
                .setValue(source.connection!)
                .onChange(async value => {
                    source.connection = value;
                    this.refreshLivePreview();
                    await renderDynamicContent(value);
                })
            );

            // Display Section
            const displayContent = this.createCollapsibleSection(container, 'Display', true);

            this.markPaired(new Setting(displayContent)
                .setName('Limit & sort')
                .setDesc('Maximum items to fetch and their order.')
                .addText(text => text
                    .setPlaceholder('Limit')
                    .setValue(source.limit?.toString() || '')
                    .onChange(value => {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            source.limit = parsed;
                        } else {
                            delete source.limit;
                        }
                        this.refreshLivePreview();
                    })
                )
                .addDropdown(dropdown => dropdown
                    .addOptions({'': 'Default order', 'asc': 'Oldest first', 'desc': 'Newest first'})
                    .setValue(source.sort?.order || '')
                    .onChange(value => {
                        if (value) {
                            source.sort = { by: 'createdAt', order: value as 'asc' | 'desc' };
                        } else {
                            delete source.sort;
                        }
                        this.refreshLivePreview();
                    })
                ));

            renderDynamicContent(source.connection).catch(e => console.error(e));
        } else if (source.type === 'nextcloud') {
            const connections = this.plugin.settings.nextcloudConnections || [];

            if (connections.length === 0) {
                container.createEl('p', {
                    text: 'No nextcloud connections configured. Please add one in the plugin settings.',
                    cls: 'gallery-error-text'
                });
                return;
            }

            const connectionOptions: Record<string, string> = {};
            connections.forEach(conn => {
                connectionOptions[conn.key] = conn.key;
            });

            if (!source.connection || !connectionOptions[source.connection]) {
                source.connection = connections[0].key;
            }

            new Setting(container)
                .setName('Connection')
                .setDesc('Select a nextcloud connection.')
                .addDropdown(dropdown => dropdown
                    .addOptions(connectionOptions)
                    .setValue(source.connection!)
                    .onChange(value => {
                        source.connection = value;
                        this.refreshLivePreview();
                    })
                );

            new Setting(container)
                .setName('Path')
                .setDesc('Path on your nextcloud server to fetch images from.')
                .addText(text => text
                    .setPlaceholder('/')
                    .setValue(source.path || '')
                    .onChange(value => {
                        source.path = value;
                        this.refreshLivePreview();
                    })
                );

            new Setting(container)
                .setName('Recursive')
                .setDesc('Include subfolders.')
                .addToggle(toggle => toggle
                    .setValue(source.recursive !== false)
                    .onChange(value => {
                        source.recursive = value;
                        this.refreshLivePreview();
                    })
                );

            new Setting(container)
                .setName('Limit')
                .setDesc('Maximum number of items to fetch.')
                .addText(text => text
                    .setValue(source.limit?.toString() || '')
                    .onChange(value => {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            source.limit = parsed;
                        } else {
                            delete source.limit;
                        }
                        this.refreshLivePreview();
                    })
                );

            const ncFilterContent = this.createCollapsibleSection(container, 'Filter criteria', false);

            new Setting(ncFilterContent)
                .setName('Filename filter')
                .setDesc('Glob pattern for filenames (e.g. *.jpg)')
                .addText(text => text
                    .setPlaceholder('*.jpg')
                    .setValue(source.filenameFilter || '')
                    .onChange(value => {
                        if (value) {
                            source.filenameFilter = value;
                        } else {
                            delete source.filenameFilter;
                        }
                        this.refreshLivePreview();
                    })
                );

            {
                const typedSource = source as unknown as INextcloudSourceConfig;
                this.createDateRangeSetting(
                    ncFilterContent,
                    'Modified',
                    'Only show files modified within this range.',
                    typedSource.filters?.modifiedAfter || '',
                    typedSource.filters?.modifiedBefore || '',
                    value => {
                        if (!typedSource.filters) typedSource.filters = {};
                        if (value) {
                            typedSource.filters.modifiedAfter = value;
                        } else {
                            delete typedSource.filters.modifiedAfter;
                            if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                        }
                        this.refreshLivePreview();
                    },
                    value => {
                        if (!typedSource.filters) typedSource.filters = {};
                        if (value) {
                            typedSource.filters.modifiedBefore = value;
                        } else {
                            delete typedSource.filters.modifiedBefore;
                            if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                        }
                        this.refreshLivePreview();
                    }
                );
            }

            this.markPaired(new Setting(ncFilterContent)
                .setName('Min / max size (kb)')
                .setDesc('File size range in kilobytes.')
                .addText(text => {
                    const typedSource = source as unknown as INextcloudSourceConfig;
                    return text
                        .setPlaceholder('Min (e.g. 100)')
                        .setValue(typedSource.filters?.minSizeKb?.toString() || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed >= 0) {
                                typedSource.filters.minSizeKb = parsed;
                            } else {
                                delete typedSource.filters.minSizeKb;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                })
                .addText(text => {
                    const typedSource = source as unknown as INextcloudSourceConfig;
                    return text
                        .setPlaceholder('Max (e.g. 5000)')
                        .setValue(typedSource.filters?.maxSizeKb?.toString() || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            const parsed = parseInt(value, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                                typedSource.filters.maxSizeKb = parsed;
                            } else {
                                delete typedSource.filters.maxSizeKb;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                }));

            new Setting(ncFilterContent)
                .setName('Mime types')
                .setDesc('Comma-separated list of mime types (e.g. Image/jpeg, image/png).')
                .addText(text => {
                    const typedSource = source as unknown as INextcloudSourceConfig;
                    return text
                        .setValue(typedSource.filters?.mimeTypes?.join(', ') || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            if (value.trim()) {
                                typedSource.filters.mimeTypes = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                            } else {
                                delete typedSource.filters.mimeTypes;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                });

            const ncSortContent = this.createCollapsibleSection(container, 'Sort', false);

            this.markPaired(new Setting(ncSortContent)
                .setName('Sort by / order')
                .setDesc('Property and direction to sort by.')
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as INextcloudSourceConfig;
                    return dropdown
                        .addOption('name', 'Name')
                        .addOption('lastModified', 'Last modified')
                        .addOption('size', 'Size')
                        .setValue(typedSource.sort?.by || 'name')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.by = value as 'name' | 'lastModified' | 'size';
                            this.refreshLivePreview();
                        });
                })
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as INextcloudSourceConfig;
                    return dropdown
                        .addOption('asc', 'Ascending')
                        .addOption('desc', 'Descending')
                        .setValue(typedSource.sort?.order || 'asc')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.order = value as 'asc' | 'desc';
                            this.refreshLivePreview();
                        });
                }));

        } else if (source.type === 'nextcloud-share') {
            new Setting(container)
                .setName('Share URL')
                .setDesc('Nextcloud public share link.')
                .addText(text => text
                    .setValue(source.url || '')
                    .onChange(value => {
                        source.url = value;
                        this.refreshLivePreview();
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
                            this.refreshLivePreview();
                        });
                });

            const ncsFilterContent = this.createCollapsibleSection(container, 'Filter criteria', false);

            new Setting(ncsFilterContent)
                .setName('Filename filter')
                .setDesc('Glob pattern for filenames (e.g. *.jpg)')
                .addText(text => text
                    .setPlaceholder('*.jpg')
                    .setValue(source.filenameFilter || '')
                    .onChange(value => {
                        if (value) {
                            source.filenameFilter = value;
                        } else {
                            delete source.filenameFilter;
                        }
                        this.refreshLivePreview();
                    })
                );

            new Setting(ncsFilterContent)
                .setName('Mime types')
                .setDesc('Comma-separated list of mime types (e.g. Image/jpeg, image/png).')
                .addText(text => {
                    const typedSource = source as unknown as INextcloudShareSourceConfig;
                    return text
                        .setValue(typedSource.filters?.mimeTypes?.join(', ') || '')
                        .onChange(value => {
                            if (!typedSource.filters) typedSource.filters = {};
                            if (value.trim()) {
                                typedSource.filters.mimeTypes = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                            } else {
                                delete typedSource.filters.mimeTypes;
                                if (Object.keys(typedSource.filters).length === 0) delete typedSource.filters;
                            }
                            this.refreshLivePreview();
                        });
                });

            new Setting(ncsFilterContent)
                .setName('Limit')
                .setDesc('Maximum number of items to fetch.')
                .addText(text => text
                    .setValue(source.limit?.toString() || '')
                    .onChange(value => {
                        const parsed = parseInt(value, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            source.limit = parsed;
                        } else {
                            delete source.limit;
                        }
                        this.refreshLivePreview();
                    })
                );

            const ncsSortContent = this.createCollapsibleSection(container, 'Sort', false);

            this.markPaired(new Setting(ncsSortContent)
                .setName('Sort by / order')
                .setDesc('Property and direction to sort by.')
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as INextcloudShareSourceConfig;
                    return dropdown
                        .addOption('name', 'Name')
                        .addOption('lastModified', 'Last modified')
                        .addOption('size', 'Size')
                        .setValue(typedSource.sort?.by || 'name')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.by = value as 'name' | 'lastModified' | 'size';
                            this.refreshLivePreview();
                        });
                })
                .addDropdown(dropdown => {
                    const typedSource = source as unknown as INextcloudShareSourceConfig;
                    return dropdown
                        .addOption('asc', 'Ascending')
                        .addOption('desc', 'Descending')
                        .setValue(typedSource.sort?.order || 'asc')
                        .onChange(value => {
                            if (!typedSource.sort) typedSource.sort = { by: 'name', order: 'asc' };
                            typedSource.sort.order = value as 'asc' | 'desc';
                            this.refreshLivePreview();
                        });
                }));
        }
    }

    /**
     * Creates a collapsible group (header + toggleable content) used to keep dense
     * filter sections (Immich albums/tags/people, Nextcloud filters/sort, etc.) out
     * of the way until the user actually wants them.
     */
    private createCollapsibleSection(container: HTMLElement, title: string, defaultOpen: boolean = false): HTMLElement {
        const wrapper = container.createDiv('gallery-builder-collapsible');
        const header = wrapper.createDiv('gallery-builder-collapsible-header');
        const chevron = header.createSpan({ cls: 'gallery-builder-collapsible-chevron', text: '▸' });
        header.createSpan({ cls: 'gallery-builder-collapsible-title', text: title });
        const content = wrapper.createDiv('gallery-builder-collapsible-content');

        const setOpen = (open: boolean) => {
            wrapper.classList.toggle('is-open', open);
            chevron.textContent = open ? '▾' : '▸';
        };
        setOpen(defaultOpen);

        header.addEventListener('click', () => {
            setOpen(!wrapper.classList.contains('is-open'));
        });

        return content;
    }

    /**
     * Marks a Setting row so its controls split evenly across the row instead of
     * stacking full-width — used to fit two related fields (e.g. min/max, sort
     * by/order) on one line without crowding.
     */
    private markPaired(setting: Setting): Setting {
        setting.settingEl.classList.add('gallery-builder-paired-row');
        return setting;
    }

    /**
     * Renders a compact "From / To" date range using native calendar (type=date)
     * inputs on a single row, in place of two separate YYYY-MM-DD text rows.
     */
    private createDateRangeSetting(
        container: HTMLElement,
        name: string,
        desc: string,
        fromValue: string,
        toValue: string,
        onFromChange: (value: string) => void,
        onToChange: (value: string) => void
    ): Setting {
        const setting = new Setting(container).setName(name).setDesc(desc);
        setting.settingEl.classList.add('gallery-builder-paired-row');

        const wrap = setting.controlEl.createDiv('gallery-builder-date-range');

        const fromField = wrap.createDiv('gallery-builder-date-field');
        fromField.createSpan({ cls: 'gallery-builder-date-field-label', text: 'From' });
        const fromInput = fromField.createEl('input');
        fromInput.type = 'date';
        fromInput.value = fromValue;
        fromInput.addEventListener('change', () => onFromChange(fromInput.value));

        const toField = wrap.createDiv('gallery-builder-date-field');
        toField.createSpan({ cls: 'gallery-builder-date-field-label', text: 'To' });
        const toInput = toField.createEl('input');
        toInput.type = 'date';
        toInput.value = toValue;
        toInput.addEventListener('change', () => onToChange(toInput.value));

        return setting;
    }

    private createSearchableList(
        container: HTMLElement,
        items: { id: string, name: string }[],
        selectedIds: string[],
        onChange: (selected: string[]) => void,
        singleSelect: boolean = false
    ) {
        new Setting(container)
            .addSearch(search => search
                .setPlaceholder('Search...')
                .onChange(value => {
                    const term = value.toLowerCase();
                    const itemEls = listContainer.querySelectorAll('.gallery-builder-list-item');
                    itemEls.forEach((el: Element) => {
                        const htmlEl = el as HTMLElement;
                        const text = htmlEl.getAttribute('data-name')?.toLowerCase() || '';
                        if (text.includes(term)) {
                            htmlEl.setCssStyles({ display: 'flex' });
                        } else {
                            htmlEl.setCssStyles({ display: 'none' });
                        }
                    });
                })
            );

        const listContainer = container.createDiv('gallery-builder-list-container');
        listContainer.setCssStyles({
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid var(--background-modifier-border)',
            borderRadius: '5px',
            padding: '5px'
        });

        const currentSelected = new Set(selectedIds);

        const renderItems = () => {
            listContainer.empty();
            if (items.length === 0) {
                listContainer.createEl('p', { text: 'No items found.', cls: 'setting-item-description' });
                return;
            }

            items.forEach(item => {
                const itemDiv = listContainer.createDiv('gallery-builder-list-item');
                itemDiv.setAttribute('data-name', item.name);
                itemDiv.setCssStyles({
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px',
                    borderBottom: '1px solid var(--background-modifier-border)'
                });

                if (singleSelect) {
                    const radio = itemDiv.createEl('input');
                    radio.type = 'radio';
                    radio.name = `radio-group-${container.id || Math.random()}`;
                    radio.value = item.id;
                    radio.checked = currentSelected.has(item.id);
                    radio.setCssStyles({ marginRight: '10px' });

                    radio.addEventListener('change', () => {
                        if (radio.checked) {
                            currentSelected.clear();
                            currentSelected.add(item.id);
                            onChange(Array.from(currentSelected));
                        }
                    });
                } else {
                    const checkbox = itemDiv.createEl('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = item.id;
                    checkbox.checked = currentSelected.has(item.id);
                    checkbox.setCssStyles({ marginRight: '10px' });

                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            currentSelected.add(item.id);
                        } else {
                            currentSelected.delete(item.id);
                        }
                        onChange(Array.from(currentSelected));
                    });
                }

                itemDiv.createEl('label', { text: item.name });
            });
        };

        renderItems();
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
