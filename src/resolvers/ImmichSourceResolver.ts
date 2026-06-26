import { IImmichSourceConfig, IImmichConnection, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImmichClient } from '../services/immich/ImmichClient';
import { ImageSource } from '../models/ImageSource';
import { Logger } from '../utils/Logger';

export class ImmichSourceResolver implements GallerySourceResolver<IImmichSourceConfig> {
    readonly type = 'immich';
    private getConnections: () => IImmichConnection[];

    constructor(getConnections: () => IImmichConnection[]) {
        this.getConnections = getConnections;
    }

    async resolve(source: IImmichSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.connection) {
            errors.push(`Immich source is missing a 'connection' reference.`);
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
            // Resolve tags to tagIds
            if (source.filters && source.filters.tags && source.filters.tags.length > 0) {
                const availableTags = await client.getTags();
                const resolvedTagIds: string[] = [];

                for (const tagName of source.filters.tags) {
                    const matchingTags = availableTags.filter(t => t.value === tagName);

                    if (matchingTags.length === 0) {
                        throw new Error(`Tag not found: '${tagName}'.`);
                    } else if (matchingTags.length > 1) {
                        throw new Error(`Ambiguous tag name: '${tagName}' matches multiple tags. Please make the name unique in Immich.`);
                    }

                    resolvedTagIds.push(matchingTags[0].id);
                }

                // Initialize tagIds array if it doesn't exist
                if (!source.filters.tagIds) {
                    source.filters.tagIds = [];
                }

                // Add resolved IDs, ensuring uniqueness
                for (const id of resolvedTagIds) {
                    if (!source.filters.tagIds.includes(id)) {
                        source.filters.tagIds.push(id);
                    }
                }
            }

            // Resolve people to personIds
            if (source.filters && source.filters.people && source.filters.people.length > 0) {
                const availablePeople = await client.getPeople();
                const resolvedPersonIds: string[] = [];

                for (const personName of source.filters.people) {
                    const matchingPeople = availablePeople.filter(p => p.name === personName);

                    if (matchingPeople.length === 0) {
                        throw new Error(`Person not found: '${personName}'.`);
                    } else if (matchingPeople.length > 1) {
                        throw new Error(`Ambiguous person name: '${personName}' matches multiple people. Please make the name unique in Immich.`);
                    }

                    resolvedPersonIds.push(matchingPeople[0].id);
                }

                // Initialize personIds array if it doesn't exist
                if (!source.filters.personIds) {
                    source.filters.personIds = [];
                }

                // Add resolved IDs, ensuring uniqueness
                for (const id of resolvedPersonIds) {
                    if (!source.filters.personIds.includes(id)) {
                        source.filters.personIds.push(id);
                    }
                }
            }

            const assets = await client.searchMetadata(source.filters, source.limit, source.sort);

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
                    const logicalPath = `immich://${connection.key}/search/asset/${asset.id}`;

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
