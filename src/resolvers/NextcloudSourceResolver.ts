import { INextcloudSourceConfig, INextcloudConnection, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { NextcloudClient } from '../services/nextcloud/NextcloudClient';
import { ImageSource } from '../models/ImageSource';
import { Logger } from '../utils/Logger';
import { globToRegex } from '../utils/globToRegex';

export class NextcloudSourceResolver implements GallerySourceResolver<INextcloudSourceConfig> {
    readonly type = 'nextcloud';
    private getConnections: () => INextcloudConnection[];

    constructor(getConnections: () => INextcloudConnection[]) {
        this.getConnections = getConnections;
    }

    async resolve(source: INextcloudSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.connection) {
            errors.push(`Nextcloud source is missing a 'connection' reference.`);
            return { images, errors };
        }

        const connections = this.getConnections();
        const connection = connections.find(c => c.key === source.connection);

        if (!connection) {
            errors.push(`Nextcloud connection with key '${source.connection}' not found in settings.`);
            return { images, errors };
        }

        const client = new NextcloudClient(connection);

        try {
            const path = source.path || '/';
            const recursive = source.recursive !== undefined ? source.recursive : true;
            let files = await client.listFiles(path, recursive, source.filters?.mimeTypes);

            if (source.filenameFilter) {
                const regex = globToRegex(source.filenameFilter);
                files = files.filter(file => regex.test(file.name));
            }

            if (source.filters) {
                const { modifiedAfter, modifiedBefore, maxSizeKb, minSizeKb } = source.filters;

                const afterDate = modifiedAfter ? new Date(modifiedAfter).getTime() : undefined;
                const beforeDate = modifiedBefore ? new Date(modifiedBefore).getTime() : undefined;

                if (afterDate !== undefined || beforeDate !== undefined) {
                    files = files.filter(file => {
                        if (!file.lastModified) return true;

                        const fileDate = new Date(file.lastModified).getTime();
                        if (isNaN(fileDate)) return true;

                        if (afterDate !== undefined && fileDate < afterDate) return false;
                        if (beforeDate !== undefined && fileDate > beforeDate) return false;

                        return true;
                    });
                }

                if (maxSizeKb !== undefined || minSizeKb !== undefined) {
                    files = files.filter(file => {
                        if (file.size === undefined) return true;

                        const maxSizeBytes = maxSizeKb !== undefined ? maxSizeKb * 1024 : undefined;
                        const minSizeBytes = minSizeKb !== undefined ? minSizeKb * 1024 : undefined;

                        if (maxSizeBytes !== undefined && file.size > maxSizeBytes) return false;
                        if (minSizeBytes !== undefined && file.size < minSizeBytes) return false;

                        return true;
                    });
                }
            }

            if (source.sort) {
                const { by, order } = source.sort;
                files.sort((a, b) => {
                    let comparison = 0;
                    if (by === 'name') {
                        comparison = a.name.localeCompare(b.name);
                    } else if (by === 'size') {
                        comparison = (a.size || 0) - (b.size || 0);
                    } else if (by === 'lastModified') {
                        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                        comparison = dateA - dateB;
                    }
                    return order === 'desc' ? -comparison : comparison;
                });
            }

            if (source.limit && source.limit > 0) {
                files = files.slice(0, source.limit);
            }

            if (files.length === 0) {
                return { images, errors };
            }

            let representation: 'thumbnail' | 'original' = 'original';
            if (context.viewType === 'thumbnail' || context.viewType === 'grid') {
                representation = 'thumbnail';
            }

            const resolvedImages = await Promise.all(files.map(async (file) => {
                try {
                    const blobUrl = await client.getFileBlobUrl(file.path, representation, file.fileId);

                    const logicalPath = `nextcloud://${connection.key}${file.path.startsWith('/') ? '' : '/'}${file.path}`;

                    return new ImageSource(logicalPath, 'nextcloud', file.name, blobUrl, undefined);
                } catch (e) {
                    Logger.warn(`Failed to load file ${file.path} for Nextcloud source: ${e instanceof Error ? e.message : String(e)}`);
                    return null;
                }
            }));

            for (const img of resolvedImages) {
                if (img !== null) {
                    images.push(img);
                }
            }
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }

        return { images, errors };
    }
}
