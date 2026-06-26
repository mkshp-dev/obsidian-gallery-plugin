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
                case 'external':
                    if (!source.urls || source.urls.length === 0 || source.urls.every(u => !u.trim())) {
                        throw new Error('External source requires at least one URL.');
                    }
                    yaml += `    urls:\n`;
                    for (const url of source.urls) {
                        if (url.trim()) {
                            yaml += `      - ${url.trim()}\n`;
                        }
                    }
                    break;
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
            }
        }

        yaml += `view:\n`;
        yaml += `  type: ${viewType}\n`;
        yaml += '```\n';

        return yaml;
    }
}
