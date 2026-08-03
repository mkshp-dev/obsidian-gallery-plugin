
import { requestUrl } from 'obsidian';
import { IImmichConnection } from '../../models/interfaces';
import { Logger } from '../../utils/Logger';
import { ImmichAsset, ImmichAlbum, ImmichTag, ImmichPerson } from '../../models/immich/ImmichTypes';
import { ImmichHelpers } from '../../utils/immich/ImmichHelpers';
import { ObjectUrlManager } from '../../utils/immich/ObjectUrlManager';

interface CacheEntry<T> {
    promise: Promise<T>;
    timestamp: number;
}

export class ImmichClient {
    private static albumCache: Map<string, CacheEntry<ImmichAlbum[]>> = new Map();
    private static tagCache: Map<string, CacheEntry<ImmichTag[]>> = new Map();
    private static peopleCache: Map<string, CacheEntry<ImmichPerson[]>> = new Map();
    private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

    public static invalidateCache(connectionKey?: string) {
        if (connectionKey) {
            ImmichClient.albumCache.delete(connectionKey);
            ImmichClient.tagCache.delete(connectionKey);
            ImmichClient.peopleCache.delete(connectionKey);
        } else {
            ImmichClient.albumCache.clear();
            ImmichClient.tagCache.clear();
            ImmichClient.peopleCache.clear();
        }
    }

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

        public async getAlbums(forceRefresh: boolean = false): Promise<ImmichAlbum[]> {
        const key = this.connection.key;
        const now = Date.now();
        const cached = ImmichClient.albumCache.get(key);

        if (!forceRefresh && cached && (now - cached.timestamp < ImmichClient.CACHE_TTL_MS)) {
            return cached.promise;
        }

        const url = `${this.baseUrl}/api/albums`;

        const promise = (async () => {
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
                ImmichClient.albumCache.delete(key);
                // Re-throw explicit errors, map network errors
                if (e instanceof Error && e.message.includes('HTTP')) {
                    throw e;
                }
                throw new Error(`Server unreachable or invalid URL for Immich connection '${this.connection.key}'`);
            }
        })();

        ImmichClient.albumCache.set(key, { promise, timestamp: now });
        return promise;
    }
    public async searchMetadata(filters?: Record<string, unknown>, limit?: number, sort?: Record<string, unknown>): Promise<ImmichAsset[]> {
        const url = `${this.baseUrl}/api/search/metadata`;
        try {
            const body: Record<string, unknown> = {};
            if (limit) {
                body.size = limit;
            }
            if (sort) {
                body.order = sort.order || 'desc';
            }
            if (filters) {
                if (filters.isFavorite !== undefined) {
                    body.isFavorite = filters.isFavorite;
                }
                if (typeof filters.createdAfter === 'string') {
                    const val = filters.createdAfter;
                    body.createdAfter = /^\d{4}-\d{2}-\d{2}$/.test(val) ? `${val}T00:00:00.000Z` : val;
                }
                if (typeof filters.createdBefore === 'string') {
                    const val = filters.createdBefore;
                    body.createdBefore = /^\d{4}-\d{2}-\d{2}$/.test(val) ? `${val}T23:59:59.999Z` : val;
                }
                if (filters.assetType !== undefined) {
                    body.type = (filters.assetType as string).toUpperCase();
                }
                if (filters.tagIds !== undefined) {
                    body.tagIds = filters.tagIds;
                }
                if (filters.personIds !== undefined) {
                    body.personIds = filters.personIds;
                }
            }

            const promises = [];
            if (filters && Array.isArray(filters.albumIds) && filters.albumIds.length > 0) {
                for (const albumId of filters.albumIds as string[]) {
                    const albumBody = { ...body, albumIds: [albumId] };
                    promises.push(this.doSearch(url, albumBody));
                }
            } else {
                promises.push(this.doSearch(url, body));
            }

            const results = await Promise.all(promises);
            const allAssets = results.flat();
            const uniqueAssets = Array.from(new Map(allAssets.map(a => [a.id, a])).values());
            return uniqueAssets;

        } catch (e) {
            if (e instanceof Error && e.message.includes('HTTP')) {
                throw e;
            }
            throw new Error(`Server unreachable or network error for Immich connection '${this.connection.key}'`);
        }
    }

    private async doSearch(url: string, body: Record<string, unknown>): Promise<ImmichAsset[]> {
        const response = await requestUrl({
            url,
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
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
        throw new Error(`Failed to fetch Immich assets: HTTP ${response.status}`);
    }

    public getAssetUrl(assetId: string, representation: 'thumbnail' | 'preview' | 'original' = 'original'): string {
        if (representation === 'thumbnail') {
            return `${this.baseUrl}/api/assets/${assetId}/thumbnail`;
        } else if (representation === 'preview') {
            return `${this.baseUrl}/api/assets/${assetId}/thumbnail?size=preview`;
        }
        return `${this.baseUrl}/api/assets/${assetId}/original`;
    }

    public async getAssetInfo(assetId: string): Promise<ImmichAsset | null> {
        const url = `${this.baseUrl}/api/assets/${assetId}`;
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });
            if (response.status === 200) {
                return response.json as ImmichAsset;
            }
            return null;
        } catch {
            return null;
        }
    }

        public async getTags(forceRefresh: boolean = false): Promise<ImmichTag[]> {
        const key = this.connection.key;
        const now = Date.now();
        const cached = ImmichClient.tagCache.get(key);

        if (!forceRefresh && cached && (now - cached.timestamp < ImmichClient.CACHE_TTL_MS)) {
            return cached.promise;
        }

        const url = `${this.baseUrl}/api/tags`;

        const promise = (async () => {
            try {
                const response = await requestUrl({
                    url,
                    method: 'GET',
                    headers: this.getHeaders()
                });
                if (response.status === 200) {
                    return response.json as ImmichTag[];

                }
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
                }
                if (response.status === 404) {
                    throw new Error(`Immich server API not found (HTTP ${response.status}). Check base URL.`);
                }
                throw new Error(`Failed to fetch Immich tags: HTTP ${response.status}`);
            } catch (e) {
                ImmichClient.tagCache.delete(key);
                // Re-throw explicit errors, map network errors
                if (e instanceof Error && e.message.includes('HTTP')) {
                    throw e;
                }
                throw new Error(`Server unreachable or invalid URL for Immich connection '${this.connection.key}'`);
            }
        })();

        ImmichClient.tagCache.set(key, { promise, timestamp: now });
        return promise;
    }
        public async getPeople(forceRefresh: boolean = false): Promise<ImmichPerson[]> {
        const key = this.connection.key;
        const now = Date.now();
        const cached = ImmichClient.peopleCache.get(key);

        if (!forceRefresh && cached && (now - cached.timestamp < ImmichClient.CACHE_TTL_MS)) {
            return cached.promise;
        }

        const url = `${this.baseUrl}/api/people`;

        const promise = (async () => {
            try {
                const response = await requestUrl({
                    url,
                    method: 'GET',
                    headers: this.getHeaders()
                });
                if (response.status === 200) {
                    const data = response.json as { items?: ImmichPerson[]; people?: ImmichPerson[] } | ImmichPerson[];
                    if (Array.isArray(data)) {
                        return data;
                    } else if (data && typeof data === 'object') {
                        if ('people' in data && Array.isArray(data.people)) {
                            return data.people;
                        }
                        if ('items' in data && Array.isArray(data.items)) {
                            return data.items;
                        }
                    }
                    return [];
                }
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Authentication failed for Immich connection '${this.connection.key}' (HTTP ${response.status})`);
                }
                if (response.status === 404) {
                    throw new Error(`Immich server API not found (HTTP ${response.status}). Check base URL.`);
                }
                throw new Error(`Failed to fetch Immich people: HTTP ${response.status}`);
            } catch (e) {
                ImmichClient.peopleCache.delete(key);
                // Re-throw explicit errors, map network errors
                if (e instanceof Error && e.message.includes('HTTP')) {
                    throw e;
                }
                throw new Error(`Server unreachable or invalid URL for Immich connection '${this.connection.key}'`);
            }
        })();

        ImmichClient.peopleCache.set(key, { promise, timestamp: now });
        return promise;
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
