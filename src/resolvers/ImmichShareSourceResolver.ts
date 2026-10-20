import { requestUrl, RequestUrlResponse } from 'obsidian';
import { IImageSource, IImmichShareSourceConfig } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImageSource } from '../models/ImageSource';
import { extractImmichCaption } from './ImmichSourceResolver';
import { ImmichAsset, ImmichAlbum, ImmichShareResponse } from '../models/immich/ImmichTypes';
import { ObjectUrlManager } from '../utils/ObjectUrlManager';

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
            const apiBase = `${urlObj.origin}${basePath}/api`;

            let activeCookie: string | undefined;
            let activeToken: string | undefined;

            // Password authentication if password is provided
            if (source.password !== undefined && source.password !== null && String(source.password).trim() !== '') {
                const passwordStr = String(source.password).trim();
                const loginUrl = `${apiBase}/shared-links/login?key=${shareKey}`;
                try {
                    const loginRes = await requestUrl({
                        url: loginUrl,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            password: passwordStr
                        })
                    });
                    if (loginRes.status === 200 || loginRes.status === 201) {
                        const loginData = loginRes.json as { accessToken?: string; token?: string } | null;
                        if (loginData && typeof loginData === 'object') {
                            activeToken = loginData.accessToken || loginData.token;
                        }

                        const setCookieHeader = loginRes.headers['set-cookie'] || loginRes.headers['Set-Cookie'];
                        if (setCookieHeader) {
                            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
                            for (const cookieStr of cookies) {
                                if (typeof cookieStr === 'string') {
                                    const match = cookieStr.match(/immich_shared_link_token=([^;]+)/);
                                    if (match) {
                                        activeCookie = `immich_shared_link_token=${match[1]}`;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!activeCookie && activeToken) {
                            activeCookie = `immich_shared_link_token=${activeToken}`;
                        }
                    } else {
                        errors.push(`Password authentication failed for Immich share (HTTP ${loginRes.status})`);
                        return { images, errors };
                    }
                } catch (err) {
                    errors.push(`Failed to authenticate password for Immich share: ${err instanceof Error ? err.message : String(err)}`);
                    return { images, errors };
                }
            }

            // Sent with every request after login: the share key, plus the session from a password login
            const authHeaders: Record<string, string> = { 'x-immich-share-key': shareKey };
            if (activeCookie) authHeaders['Cookie'] = activeCookie;
            if (activeToken) authHeaders['Authorization'] = `Bearer ${activeToken}`;
            const jsonHeaders = { 'Accept': 'application/json', ...authHeaders };

            // In Immich API, to get shared link details, we can use `/api/shared-links/me` with `x-immich-share-key` header
            // This returns the shared link details including assets. We also append the key as a query parameter
            // to ensure the backend controller maps and retrieves the correct assets.
            let response: RequestUrlResponse;
            try {
                response = await requestUrl({
                    url: `${apiBase}/shared-links/me?key=${shareKey}`,
                    method: 'GET',
                    headers: jsonHeaders
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
                if (!Array.isArray(data) && data.album && typeof data.album === 'object' && typeof data.album.id === 'string') {
                    const albumId = String(data.album.id);
                    try {
                        const searchRes = await requestUrl({
                            url: `${apiBase}/search/metadata?key=${shareKey}`,
                            method: 'POST',
                            headers: { ...jsonHeaders, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ albumIds: [albumId], withExif: true })
                        });
                        if (searchRes.status === 200) {
                            const searchData = searchRes.json as { assets?: { items?: ImmichAsset[] }; items?: ImmichAsset[] };
                            const foundItems = searchData.assets?.items || searchData.items;
                            if (Array.isArray(foundItems) && foundItems.length > 0) {
                                assets = foundItems;
                            }
                        }
                    } catch {
                        // ignore probe errors
                    }

                    // Fallback to GET /api/albums/{id} if search endpoint didn't return items
                    if (assets.length === 0) {
                        try {
                            const albumRes = await requestUrl({
                                url: `${apiBase}/albums/${albumId}?key=${shareKey}`,
                                method: 'GET',
                                headers: jsonHeaders
                            });
                            if (albumRes.status === 200) {
                                const albumData = albumRes.json as ImmichAlbum;
                                if (albumData && typeof albumData === 'object' && Array.isArray(albumData.assets) && albumData.assets.length > 0) {
                                    assets = albumData.assets;
                                }
                            }
                        } catch {
                            // ignore probe errors
                        }
                    }
                }

                // If still empty, try GET /api/assets
                if (assets.length === 0) {
                    try {
                        const genericRes = await requestUrl({
                            url: `${apiBase}/assets?key=${shareKey}`,
                            method: 'GET',
                            headers: jsonHeaders
                        });
                        if (genericRes.status === 200) {
                            const genericData = genericRes.json as unknown;
                            if (Array.isArray(genericData) && genericData.length > 0) {
                                assets = genericData as ImmichAsset[];
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

            // Determine representation based on viewType
            let representation: 'thumbnail' | 'preview' | 'original' = 'original';
            if (context.viewType === 'thumbnail' || context.viewType === 'grid') {
                representation = 'thumbnail';
            } else if (context.viewType === 'carousel') {
                representation = 'preview';
            }

            const resolvedImages = await Promise.all(assets.map(async (asset) => {
                if (!asset || typeof asset !== 'object' || !asset.id) return null;
                const assetId = asset.id;

                const originalFileName = typeof asset.originalFileName === 'string' ? asset.originalFileName : String(assetId);
                let description = extractImmichCaption(asset);

                // An asset that includes exifInfo but no caption has none; only look up assets without exifInfo
                if (!description && asset.exifInfo === undefined) {
                    try {
                        const detailRes = await requestUrl({
                            url: `${apiBase}/assets/${assetId}?key=${shareKey}`,
                            method: 'GET',
                            headers: jsonHeaders
                        });
                        if (detailRes.status === 200) {
                            description = extractImmichCaption(detailRes.json as ImmichAsset);
                        }
                    } catch {
                        // ignore detail fetch fallback error
                    }
                }

                let assetUrl: string;
                if (representation === 'thumbnail') {
                    assetUrl = `${apiBase}/assets/${assetId}/thumbnail?key=${shareKey}`;
                } else if (representation === 'preview') {
                    assetUrl = `${apiBase}/assets/${assetId}/thumbnail?size=preview&key=${shareKey}`;
                } else {
                    assetUrl = `${apiBase}/assets/${assetId}/original?key=${shareKey}`;
                }

                // Fetched lazily, when a view first displays the asset. requestUrl bypasses browser CORS
                // and sends the share session, which a plain <img> URL could not do for password-protected shares.
                const cacheKey = `immich-share:${shareKey}:${assetId}:${representation}`;
                const loader = () => ObjectUrlManager.getOrCreate(cacheKey, async () => {
                    const blobRes = await requestUrl({ url: assetUrl, method: 'GET', headers: authHeaders });
                    if (blobRes.status !== 200) {
                        throw new Error(`Failed to fetch Immich share asset '${assetId}': HTTP ${blobRes.status}`);
                    }
                    return new Blob([blobRes.arrayBuffer]);
                });

                return new ImageSource(`immich-share://${shareKey}/${assetId}`, 'immich-share', originalFileName, undefined, description, loader);
            }));

            for (const img of resolvedImages) {
                if (img !== null) {
                    images.push(img);
                }
            }

        } catch (error) {
            errors.push(`Error resolving Immich share: ${error instanceof Error ? error.message : String(error)}`);
        }

        return { images, errors };
    }
}
