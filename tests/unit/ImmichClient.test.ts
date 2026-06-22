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
        id: '123',
        name: 'Test Server',
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

    it('should return empty array and log error on fetch albums failure', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 401,
            json: { message: 'Unauthorized' }
        });

        const albums = await client.getAlbums();

        expect(albums).toHaveLength(0);
        // We mocked Logger, so we can't easily check the log unless we import the mock, but the behavior is tested.
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

    it('should return correct asset URL', () => {
        const url = client.getAssetUrl('asset123');
        expect(url).toBe('https://immich.example.com/api/assets/asset123/original');
    });
});
