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
            let files = await client.listFiles(path, recursive);

            if (source.filenameFilter) {
                const regex = globToRegex(source.filenameFilter);
                files = files.filter(file => regex.test(file.name));
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
