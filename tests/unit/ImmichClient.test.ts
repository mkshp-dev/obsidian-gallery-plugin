import { ImmichClient } from '../../src/services/immich/ImmichClient';
import { IImmichConnection } from '../../src/models/interfaces';
import { requestUrl } from 'obsidian';

jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

jest.mock('../../src/utils/Logger', () => ({
    Logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('ImmichClient', () => {
    let client: ImmichClient;
    const mockConnection: IImmichConnection = {
        key: 'test',
        baseUrl: 'https://immich.example.com/',
        apiKey: 'test-api-key'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        client = new ImmichClient(mockConnection);
    });

    it('should normalize base URL by removing trailing slash', () => {
        expect((client as any).baseUrl).toBe('https://immich.example.com');
    });

    it('should use base URL without trailing slash if no slash is present', () => {
        const connWithoutSlash = { ...mockConnection, baseUrl: 'https://immich.example.com' };
        const clientWithoutSlash = new ImmichClient(connWithoutSlash);
        expect((clientWithoutSlash as any).baseUrl).toBe('https://immich.example.com');
    });

    it('should include API key in headers', () => {
        const headers = (client as any).getHeaders();
        expect(headers['x-api-key']).toBe('test-api-key');
        expect(headers['Accept']).toBe('application/json');
    });

    it('should fetch albums successfully', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: [
                { id: 'album1', albumName: 'Vacation' },
                { id: 'album2', albumName: 'Pets' }
            ]
        });

        const albums = await client.getAlbums();

        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://immich.example.com/api/albums',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-api-key': 'test-api-key'
            }
        });
        expect(albums).toHaveLength(2);
        expect(albums[0].id).toBe('album1');
    });

    it('should throw explicit error on fetch albums auth failure', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 401,
            json: { message: 'Unauthorized' }
        });

        await expect(client.getAlbums()).rejects.toThrow(/Authentication failed for Immich connection/);
    });

    it('should fetch album assets successfully', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                id: 'album1',
                albumName: 'Vacation',
                assets: [
                    { id: 'asset1', originalFileName: 'photo.jpg' }
                ]
            }
        });

        const assets = await client.getAlbumAssets('album1');

        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://immich.example.com/api/albums/album1',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-api-key': 'test-api-key'
            }
        });
        expect(assets).toHaveLength(1);
        expect(assets[0].id).toBe('asset1');
    });

    it('should fetch favorites successfully with nested assets items', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                assets: {
                    items: [
                        { id: 'fav1', originalFileName: 'photo1.jpg' }
                    ],
                    count: 1
                }
            }
        });

        const assets = await client.getFavorites();

        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://immich.example.com/api/search/metadata',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'x-api-key': 'test-api-key',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                isFavorite: true
            })
        });
        expect(assets).toHaveLength(1);
        expect(assets[0].id).toBe('fav1');
    });

    it('should fetch favorites successfully with flat items', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                items: [
                    { id: 'fav1', originalFileName: 'photo1.jpg' }
                ],
                count: 1
            }
        });

        const assets = await client.getFavorites();
        expect(assets).toHaveLength(1);
        expect(assets[0].id).toBe('fav1');
    });

    it('should throw explicit error on fetch favorites auth failure', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 401,
            json: { message: 'Unauthorized' }
        });

        await expect(client.getFavorites()).rejects.toThrow(/Authentication failed for Immich connection/);
    });

    it('should fetch recent assets successfully', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                assets: {
                    items: [
                        { id: 'recent1', originalFileName: 'photo-recent.jpg' }
                    ],
                    count: 1
                }
            }
        });

        const assets = await client.getRecentAssets();

        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://immich.example.com/api/search/metadata',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'x-api-key': 'test-api-key',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(assets).toHaveLength(1);
        expect(assets[0].id).toBe('recent1');
    });

    it('should throw explicit error on fetch recent assets auth failure', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 401,
            json: { message: 'Unauthorized' }
        });

        await expect(client.getRecentAssets()).rejects.toThrow(/Authentication failed for Immich connection/);
    });

    it('should return correct asset URL for original', () => {
        const url = client.getAssetUrl('asset123');
        expect(url).toBe('https://immich.example.com/api/assets/asset123/original');

        const urlExplicit = client.getAssetUrl('asset123', 'original');
        expect(urlExplicit).toBe('https://immich.example.com/api/assets/asset123/original');
    });

    it('should return correct asset URL for thumbnail', () => {
        const url = client.getAssetUrl('asset123', 'thumbnail');
        expect(url).toBe('https://immich.example.com/api/assets/asset123/thumbnail');
    });

    it('should return correct asset URL for preview', () => {
        const url = client.getAssetUrl('asset123', 'preview');
        expect(url).toBe('https://immich.example.com/api/assets/asset123/thumbnail?size=preview');
    });

    describe('validateConnection', () => {
        it('should return success when connection is valid (status 200)', async () => {
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 200,
                json: []
            });

            const result = await client.validateConnection();
            expect(result).toEqual({ success: true, message: 'Connection successful' });
        });

        it('should return auth failure when API key is invalid (status 401)', async () => {
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 401,
                json: { message: 'Unauthorized' }
            });

            const result = await client.validateConnection();
            expect(result).toEqual({ success: false, message: 'Authentication failed: Invalid API key' });
        });

        it('should return not found when API is not found (status 404)', async () => {
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 404,
                text: 'Not Found'
            });

            const result = await client.validateConnection();
            expect(result).toEqual({ success: false, message: 'Server responded, but API not found. Is this an Immich server?' });
        });

        it('should return generic unreachable error when network fails', async () => {
            (requestUrl as jest.Mock).mockRejectedValue(new Error('Network Error'));

            const result = await client.validateConnection();
            expect(result).toEqual({ success: false, message: 'Server unreachable or invalid URL' });
        });
    });
});
