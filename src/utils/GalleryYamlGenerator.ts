import { ISourceConfig } from '../models/interfaces';

export class GalleryYamlGenerator {
    static generateYaml(sources: Partial<ISourceConfig>[], viewType: string): string {
        if (!sources || sources.length === 0) {
            throw new Error('At least one source is required.');
        }

        let yaml = '\n```obs-gallery\n';
        yaml += 'sources:\n';

        for (const source of sources) {
            if (!source.type) continue;

            yaml += `  - type: ${source.type}\n`;

            switch (source.type) {
                case 'local':
                    if (!source.path) throw new Error('Local source requires a path.');
                    yaml += `    path: ${source.path}\n`;
                    if (source.recursive !== undefined) {
                        yaml += `    recursive: ${source.recursive}\n`;
                    }
                    break;
                case 'external': {
                    const validUrls = source.urls ? source.urls.filter(u => typeof u === 'string' ? u.trim() : (u && typeof u.url === 'string' && u.url.trim())) : [];
                    if (!source.urls || source.urls.length === 0 || validUrls.length === 0) {
                        throw new Error('External source requires at least one URL.');
                    }
                    yaml += `    urls:\n`;
                    for (const item of source.urls) {
                        if (typeof item === 'string') {
                            if (item.trim()) {
                                yaml += `      - ${item.trim()}\n`;
                            }
                        } else if (typeof item === 'object' && item !== null && item.url && item.url.trim()) {
                            yaml += `      - url: ${item.url.trim()}\n`;
                            if (item.caption && item.caption.trim()) {
                                yaml += `        caption: "${item.caption.trim().replace(/"/g, '\\"')}"\n`;
                            }
                        }
                    }
                    break;
                }
                case 'immich-share':
                    if (!source.url) throw new Error('Immich share source requires a URL.');
                    yaml += `    url: ${source.url.trim()}\n`;
                    if (source.password && source.password.trim()) {
                        yaml += `    password: ${source.password.trim()}\n`;
                    }
                    break;
                case 'immich':
                    if (!source.connection) throw new Error('Immich authenticated source requires a connection.');
                    yaml += `    connection: ${source.connection}\n`;

                    if (source.filters) {
                        yaml += `    filters:\n`;
                        if (source.filters.isFavorite) {
                            yaml += `      isFavorite: true\n`;
                        }
                        if (source.filters.albumIds && source.filters.albumIds.length > 0) {
                            yaml += `      albumIds:\n`;
                            for (const id of source.filters.albumIds) {
                                yaml += `        - ${id}\n`;
                            }
                        }
                        if (source.filters.createdAfter) {
                            yaml += `      createdAfter: ${source.filters.createdAfter}\n`;
                        }
                        if (source.filters.createdBefore) {
                            yaml += `      createdBefore: ${source.filters.createdBefore}\n`;
                        }
                        if (source.filters.assetType) {
                            yaml += `      assetType: ${source.filters.assetType}\n`;
                        }
                        if (source.filters.tagIds && source.filters.tagIds.length > 0) {
                            yaml += `      tagIds:\n`;
                            for (const id of source.filters.tagIds) {
                                yaml += `        - ${id}\n`;
                            }
                        }
                        if (source.filters.tags && source.filters.tags.length > 0) {
                            yaml += `      tags:\n`;
                            for (const tag of source.filters.tags) {
                                yaml += `        - ${tag}\n`;
                            }
                        }
                        if (source.filters.personIds && source.filters.personIds.length > 0) {
                            yaml += `      personIds:\n`;
                            for (const id of source.filters.personIds) {
                                yaml += `        - ${id}\n`;
                            }
                        }
                        if (source.filters.people && source.filters.people.length > 0) {
                            yaml += `      people:\n`;
                            for (const person of source.filters.people) {
                                yaml += `        - ${person}\n`;
                            }
                        }
                    }
                    if (source.limit) {
                        yaml += `    limit: ${source.limit}\n`;
                    }
                    if (source.sort) {
                        yaml += `    sort:\n`;
                        yaml += `      by: ${source.sort.by}\n`;
                        yaml += `      order: ${source.sort.order}\n`;
                    }
                    break;
                case 'nextcloud':
                    if (!source.connection) throw new Error('Nextcloud source requires a connection.');
                    yaml += `    connection: ${source.connection}\n`;
                    if (source.path) {
                        yaml += `    path: ${source.path}\n`;
                    }
                    if (source.recursive !== undefined) {
                        yaml += `    recursive: ${source.recursive}\n`;
                    }
                    if (source.filenameFilter) {
                        yaml += `    filenameFilter: ${source.filenameFilter}\n`;
                    }
                    if (source.limit) {
                        yaml += `    limit: ${source.limit}\n`;
                    }
                    break;
                case 'nextcloud-share':
                    if (!source.url) throw new Error('Nextcloud share source requires a URL.');
                    yaml += `    url: ${source.url.trim()}\n`;
                    if (source.password && source.password.trim()) {
                        yaml += `    password: ${source.password.trim()}\n`;
                    }
                    if (source.filenameFilter) {
                        yaml += `    filenameFilter: ${source.filenameFilter}\n`;
                    }
                    break;
            }
        }

        yaml += `view:\n`;
        yaml += `  type: ${viewType}\n`;
        yaml += '```\n';

        return yaml;
    }
}
