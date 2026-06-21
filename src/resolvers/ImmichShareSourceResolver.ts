import { requestUrl, RequestUrlResponse } from 'obsidian';
import { IImageSource, IImmichShareSourceConfig } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImageSource } from '../models/ImageSource';

interface ImmichAsset {
    id: string;
    originalFileName?: string;
    [key: string]: unknown;
}

interface ImmichShareResponse {
    assets?: ImmichAsset[];
    asset?: ImmichAsset;
    album?: {
        assets?: ImmichAsset[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export class ImmichShareSourceResolver implements GallerySourceResolver<IImmichShareSourceConfig> {
    readonly type = 'immich-share';

    async resolve(source: IImmichShareSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.url || typeof source.url !== 'string') {
            errors.push('Immich share source requires a valid url');
            return { images, errors };
        }

        try {
            // Validate it's a URL
            const urlObj = new URL(source.url);

            // Expected format: https://immich.example.com/share/abc1234
            // Or with subpath: https://example.com/immich/share/abc1234
            const shareMatch = urlObj.pathname.match(/(.*)\/share\/([a-zA-Z0-9_-]+)$/);
            if (!shareMatch) {
                errors.push(`URL does not appear to be an Immich share link: ${source.url}`);
                return { images, errors };
            }

            const basePath = shareMatch[1]; // could be empty string
            const shareKey = shareMatch[2];

            // In Immich API, to get shared link details, we can use `/api/shared-links/me` with `x-immich-share-key` header
            // This returns the shared link details including assets. We also append the key as a query parameter
            // to ensure the backend controller maps and retrieves the correct assets.
            const apiUrl = `${urlObj.origin}${basePath}/api/shared-links/me?key=${shareKey}`;

            let response: RequestUrlResponse;
            try {
                response = await requestUrl({
                    url: apiUrl,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'x-immich-share-key': shareKey
                    }
                });
            } catch (err) {
                const status = typeof err === 'object' && err !== null && 'status' in err
                    ? (err as { status: number }).status
                    : undefined;
                if (status === 404 || status === 401 || status === 403) {
                    errors.push(`Immich share not found or inaccessible: ${source.url}`);
                } else {
                    errors.push(`Failed to fetch Immich share: ${err instanceof Error ? err.message : String(err)}`);
                }
                return { images, errors };
            }

            if (response.status !== 200) {
                errors.push(`Failed to fetch Immich share: HTTP ${response.status}`);
                return { images, errors };
            }

            const data = response.json as ImmichShareResponse;

            // The response for /api/shared-links/me typically contains the share info.
            // If it's an album share, the assets are in data.assets or similar.
            // Some Immich versions return the assets directly, or under a nested property.
            let assets: ImmichAsset[] = Array.isArray(data.assets) ? data.assets : [];

            // Fallback for album shares where assets are nested inside the album object
            if (assets.length === 0 && data.album && typeof data.album === 'object' && Array.isArray(data.album.assets)) {
                assets = data.album.assets;
            }

            // Fallback for single asset shares or different structure where assets are at the root
            if (assets.length === 0 && Array.isArray(data)) {
                assets = data as ImmichAsset[];
            } else if (assets.length === 0 && data.asset) {
                assets = [data.asset];
            }

            if (assets.length === 0) {
                if (data.album && typeof data.album === 'object' && (data.album as any).id) {
                    const albumId = (data.album as any).id;
                    const albumInfoUrl = `${urlObj.origin}${basePath}/api/albums/${String(albumId)}?key=${shareKey}`;
                    try {
                        const albumRes = await requestUrl({
                            url: albumInfoUrl,
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'x-immich-share-key': shareKey
                            }
                        });
                        if (albumRes.status === 200) {
                            const albumData = albumRes.json;
                            if (albumData && typeof albumData === 'object' && Array.isArray(albumData.assets) && albumData.assets.length > 0) {
                                assets = albumData.assets;
                            }
                        }
                    } catch {
                        // ignore probe errors
                    }
                }

                // If still empty, try GET /api/assets
                if (assets.length === 0) {
                    const genericAssetsUrl = `${urlObj.origin}${basePath}/api/assets?key=${shareKey}`;
                    try {
                        const genericRes = await requestUrl({
                            url: genericAssetsUrl,
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json',
                                'x-immich-share-key': shareKey
                            }
                        });
                        if (genericRes.status === 200) {
                            const genericData = genericRes.json;
                            if (Array.isArray(genericData) && genericData.length > 0) {
                                assets = genericData;
                            }
                        }
                    } catch {
                        // ignore probe errors
                    }
                }
            }

            if (assets.length === 0) {
                // If it's empty, it resolves correctly but with no images.
                return { images, errors };
            }

            for (const asset of assets) {
                if (!asset || typeof asset !== 'object' || !asset.id) continue;
                // Immich has /api/assets/{id}/thumbnail or /api/assets/{id}/original
                // With share link, we include the key in the URL.
                // We'll use the original file download URL with the key. Or thumbnail.
                // For gallery, viewing the full image or high res preview is best.
                // In Immich, /api/assets/{id}/original?key={shareKey}
                const imageUrl = `${urlObj.origin}${basePath}/api/assets/${String(asset.id)}/original?key=${shareKey}`;
                try {
                    const originalFileName = typeof asset.originalFileName === 'string' ? asset.originalFileName : String(asset.id);
                    const imgSource = ImageSource.fromUrl(imageUrl, originalFileName);
                    images.push(imgSource);
                } catch {
                    // Ignore individual asset errors
                }
            }

        } catch (error) {
            errors.push(`Error resolving Immich share: ${error instanceof Error ? error.message : String(error)}`);
        }

        return { images, errors };
    }
}
