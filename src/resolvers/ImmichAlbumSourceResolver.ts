import { IImmichAlbumSourceConfig, IImmichConnection, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImmichClient } from '../services/immich/ImmichClient';
import { ImageSource } from '../models/ImageSource';
import { Logger } from '../utils/Logger';

export class ImmichAlbumSourceResolver implements GallerySourceResolver<IImmichAlbumSourceConfig> {
    readonly type = 'immich';
    private getConnections: () => IImmichConnection[];

    constructor(getConnections: () => IImmichConnection[]) {
        this.getConnections = getConnections;
    }

    async resolve(source: IImmichAlbumSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.connection) {
            errors.push(`Immich source is missing a 'connection' reference.`);
            return { images, errors };
        }

        if (!source.source) {
            errors.push(`Immich source is missing a 'source' block.`);
            return { images, errors };
        }

        if (source.source.type === 'album' && !source.source.id) {
            errors.push(`Immich source is missing a valid album 'id'.`);
            return { images, errors };
        }

        const connections = this.getConnections();
        const connection = connections.find(c => c.key === source.connection);

        if (!connection) {
            errors.push(`Immich connection with key '${source.connection}' not found in settings.`);
            return { images, errors };
        }

        const client = new ImmichClient(connection);

        try {
            let assets;
            if (source.source.type === 'favorites') {
                assets = await client.getFavorites();
            } else if (source.source.type === 'recent') {
                assets = await client.getRecentAssets();
            } else {
                assets = await client.getAlbumAssets(source.source.id);
            }

            if (assets.length === 0) {
                // Return no images, but no error - genuinely empty album/favorites/recent
                return { images, errors };
            }

            // Determine the appropriate asset representation based on the view type
            let representation: 'thumbnail' | 'preview' | 'original' = 'original';
            if (context.viewType === 'thumbnail' || context.viewType === 'grid') {
                representation = 'thumbnail';
            } else if (context.viewType === 'carousel') {
                representation = 'preview';
            }

            // Fetch preview blobs for the MVP authenticated image delivery.
            // We use Promise.all to fetch concurrently, but we must map the results back
            // to preserve the original sorting order of the album.
            const resolvedImages = await Promise.all(assets.map(async (asset) => {
                if (!asset.id) return null;

                try {
                    const blobUrl = await client.getAssetBlobUrl(asset.id, representation);
                    const originalFileName = typeof asset.originalFileName === 'string' ? asset.originalFileName : String(asset.id);

                    // The path is logical, resourceUrl is the blob Object URL
                    let logicalPath;
                    if (source.source.type === 'favorites') {
                        logicalPath = `immich://${connection.key}/favorites/asset/${asset.id}`;
                    } else if (source.source.type === 'recent') {
                        logicalPath = `immich://${connection.key}/recent/asset/${asset.id}`;
                    } else {
                        logicalPath = `immich://${connection.key}/album/${source.source.id}/asset/${asset.id}`;
                    }

                    return new ImageSource(logicalPath, 'immich', originalFileName, blobUrl);
                } catch (e) {
                    Logger.warn(`Failed to load asset ${asset.id} for Immich source: ${e instanceof Error ? e.message : String(e)}`);
                    // We don't necessarily want to fail the whole album if one asset fails
                    return null;
                }
            }));

            // Filter out nulls and push in correct order
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
