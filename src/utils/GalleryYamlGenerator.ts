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
                    if (!source.source) throw new Error('Immich authenticated source requires a source configuration.');
                    yaml += `    connection: ${source.connection}\n`;
                    yaml += `    source:\n`;

                    if (source.source.type === 'favorites') {
                        yaml += `      type: favorites\n`;
                    } else if (source.source.type === 'album') {
                        if (!source.source.id) throw new Error('Immich authenticated album source requires an album ID.');
                        yaml += `      type: album\n`;
                        yaml += `      id: ${source.source.id}\n`;
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
