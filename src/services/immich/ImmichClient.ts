import { requestUrl } from 'obsidian';
import { IImmichConnection } from '../../models/interfaces';
import { Logger } from '../../utils/Logger';
import { ImmichAsset, ImmichAlbum } from '../../models/immich/ImmichTypes';
import { ImmichHelpers } from '../../utils/immich/ImmichHelpers';
import { ObjectUrlManager } from '../../utils/immich/ObjectUrlManager';

export class ImmichClient {
    private connection: IImmichConnection;
    private baseUrl: string;

    constructor(connection: IImmichConnection) {
        this.connection = connection;
        this.baseUrl = ImmichHelpers.normalizeBaseUrl(connection.baseUrl);
    }

    private getHeaders(): Record<string, string> {
        return {
            'Accept': 'application/json',
            'x-api-key': this.connection.apiKey
        };
    }

    public async getAlbums(): Promise<ImmichAlbum[]> {
        const url = `${this.baseUrl}/api/albums`;
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });
            if (response.status === 200) {
                return response.json as ImmichAlbum[];
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
            }
            if (response.status === 404) {
                throw new Error(`Immich server API not found (HTTP ${response.status}). Check base URL.`);
            }
            throw new Error(`Failed to fetch Immich albums: HTTP ${response.status}`);
        } catch (e) {
            // Re-throw explicit errors, map network errors
            if (e instanceof Error && e.message.includes('HTTP')) {
                throw e;
            }
            throw new Error(`Server unreachable or invalid URL for Immich connection '${this.connection.key}'`);
        }
    }

    public async getAlbumAssets(albumId: string): Promise<ImmichAsset[]> {
        const url = `${this.baseUrl}/api/albums/${albumId}`;
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });
            if (response.status === 200) {
                const album = response.json as ImmichAlbum;
                return album.assets || [];
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
            }
            if (response.status === 404) {
                throw new Error(`Album '${albumId}' not found on Immich connection '${this.connection.key}'`);
            }
            throw new Error(`Failed to fetch Immich album assets: HTTP ${response.status}`);
        } catch (e) {
            // Re-throw explicit errors, map network errors
            if (e instanceof Error && e.message.includes('HTTP')) {
                throw e;
            }
            if (e instanceof Error && e.message.includes('not found on Immich connection')) {
                throw e;
            }
            throw new Error(`Server unreachable or network error for Immich connection '${this.connection.key}'`);
        }
    }

    public async getRecentAssets(): Promise<ImmichAsset[]> {
        const url = `${this.baseUrl}/api/search/metadata`;
        try {
            const response = await requestUrl({
                url,
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            if (response.status === 200) {
                const data = response.json as { assets?: { items: ImmichAsset[] }; items?: ImmichAsset[]; count?: number };
                return data.assets?.items || data.items || [];
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
            }
            if (response.status === 404) {
                throw new Error(`Search endpoint not found on Immich connection '${this.connection.key}'`);
            }
            throw new Error(`Failed to fetch Immich recent assets: HTTP ${response.status}`);
        } catch (e) {
            // Re-throw explicit errors, map network errors
            if (e instanceof Error && e.message.includes('HTTP')) {
                throw e;
            }
            if (e instanceof Error && e.message.includes('not found on Immich connection')) {
                throw e;
            }
            throw new Error(`Server unreachable or network error for Immich connection '${this.connection.key}'`);
        }
    }

    public async getFavorites(): Promise<ImmichAsset[]> {
        const url = `${this.baseUrl}/api/search/metadata`;
        try {
            const response = await requestUrl({
                url,
                method: 'POST',
                headers: {
                    ...this.getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    isFavorite: true
                })
            });
            if (response.status === 200) {
                const data = response.json as { assets?: { items: ImmichAsset[] }; items?: ImmichAsset[]; count?: number };
                return data.assets?.items || data.items || [];
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
            }
            if (response.status === 404) {
                throw new Error(`Favorites endpoint not found on Immich connection '${this.connection.key}'`);
            }
            throw new Error(`Failed to fetch Immich favorites: HTTP ${response.status}`);
        } catch (e) {
            // Re-throw explicit errors, map network errors
            if (e instanceof Error && e.message.includes('HTTP')) {
                throw e;
            }
            if (e instanceof Error && e.message.includes('not found on Immich connection')) {
                throw e;
            }
            throw new Error(`Server unreachable or network error for Immich connection '${this.connection.key}'`);
        }
    }

    public getAssetUrl(assetId: string, representation: 'thumbnail' | 'preview' | 'original' = 'original'): string {
        if (representation === 'thumbnail') {
            return `${this.baseUrl}/api/assets/${assetId}/thumbnail`;
        } else if (representation === 'preview') {
            return `${this.baseUrl}/api/assets/${assetId}/thumbnail?size=preview`;
        }
        return `${this.baseUrl}/api/assets/${assetId}/original`;
    }

    public async validateConnection(): Promise<{ success: boolean; message: string }> {
        if (!this.baseUrl) {
            return { success: false, message: 'Invalid URL' };
        }

        const url = `${this.baseUrl}/api/albums`;
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 200) {
                return { success: true, message: 'Connection successful' };
            } else if (response.status === 401 || response.status === 403) {
                return { success: false, message: 'Authentication failed: Invalid API key' };
            } else if (response.status === 404) {
                return { success: false, message: 'Server responded, but API not found. Is this an Immich server?' };
            } else {
                return { success: false, message: `Unexpected server response: HTTP ${response.status}` };
            }
        } catch (e) {
            Logger.debug(`Immich connection validation failed: ${e instanceof Error ? e.message : String(e)}`);
            return { success: false, message: 'Server unreachable or invalid URL' };
        }
    }

    public async getAssetBlobUrl(assetId: string, representation: 'thumbnail' | 'preview' | 'original' = 'original'): Promise<string> {
        const key = `immich:${this.connection.key}:${assetId}:${representation}`;
        const existingUrl = ObjectUrlManager.acquire(key);
        if (existingUrl) {
            return existingUrl;
        }

        const url = this.getAssetUrl(assetId, representation);
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });

            if (response.status === 200) {
                const blob = new Blob([response.arrayBuffer]);
                return ObjectUrlManager.create(key, blob);
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed for asset '${assetId}' (HTTP ${response.status})`);
            }
            if (response.status === 404) {
                throw new Error(`Asset '${assetId}' not found`);
            }
            throw new Error(`Failed to fetch asset blob: HTTP ${response.status}`);
        } catch (e) {
            if (e instanceof Error && (e.message.includes('HTTP') || e.message.includes('not found'))) {
                throw e;
            }
            throw new Error(`Network error fetching asset '${assetId}' on connection '${this.connection.key}'`);
        }
    }
}
