import { requestUrl } from 'obsidian';
import { IImmichConnection } from '../../models/interfaces';
import { Logger } from '../../utils/Logger';

export interface ImmichAsset {
    id: string;
    originalFileName?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface ImmichAlbum {
    id: string;
    albumName: string;
    assets?: ImmichAsset[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export class ImmichClient {
    private connection: IImmichConnection;
    private baseUrl: string;

    constructor(connection: IImmichConnection) {
        this.connection = connection;
        this.baseUrl = this.normalizeBaseUrl(connection.baseUrl);
    }

    private normalizeBaseUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash if present
            return urlObj.origin + urlObj.pathname.replace(/\/$/, '');
        } catch {
            Logger.warn('Invalid base URL provided to ImmichClient', url);
            return url.replace(/\/$/, '');
        }
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
            Logger.error(`Failed to fetch Immich albums: HTTP ${response.status}`);
            return [];
        } catch (e) {
            Logger.error(`Error fetching Immich albums: ${e instanceof Error ? e.message : String(e)}`);
            throw e;
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
            Logger.error(`Failed to fetch Immich album assets: HTTP ${response.status}`);
            return [];
        } catch (e) {
            Logger.error(`Error fetching Immich album assets: ${e instanceof Error ? e.message : String(e)}`);
            throw e;
        }
    }

    public getAssetUrl(assetId: string): string {
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

    // Add auth to getAssetUrl so we can pass headers for rendering? Or for authenticated image delivery, that will be needed later.
    // The issue says: "no authenticated image delivery/rendering pipeline yet". So we only need the data endpoints for now.
}
