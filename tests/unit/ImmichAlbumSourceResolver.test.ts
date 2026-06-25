import { ImmichAlbumSourceResolver } from '../../src/resolvers/ImmichAlbumSourceResolver';
import { IImmichConnection, IImmichAlbumSourceConfig } from '../../src/models/interfaces';
import { ImmichClient } from '../../src/services/immich/ImmichClient';

jest.mock('../../src/services/immich/ImmichClient');

describe('ImmichAlbumSourceResolver', () => {
    let resolver: ImmichAlbumSourceResolver;
    let mockConnections: IImmichConnection[];

    beforeEach(() => {
        jest.clearAllMocks();

        mockConnections = [
            {
                key: 'home',
                baseUrl: 'https://immich.example.com',
                apiKey: 'test-key'
            }
        ];

        resolver = new ImmichAlbumSourceResolver(() => mockConnections);
    });

    it('should return error if connection is missing in source', async () => {
        const source: any = { type: 'immich', source: { type: 'album', id: 'album1' } };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("missing a 'connection' reference");
    });

    it('should return error if connection key is not found in settings', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'work', source: { type: 'album', id: 'album1' } };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("not found in settings");
    });

    it('should resolve and fetch blobs successfully', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'album', id: 'album1' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' },
            { id: 'asset2', originalFileName: 'photo2.jpg' }
        ];

        (ImmichClient.prototype.getAlbumAssets as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url1')
                                                             .mockResolvedValueOnce('blob:url2');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(2);

        expect(result.images[0].path).toBe('immich://home/album/album1/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url1');
        expect(result.images[0].displayName).toBe('photo1.jpg'); // ImageSource uses provided displayName verbatim
    });

    it('should handle getAlbumAssets throwing an error', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'album', id: 'album1' } };

        (ImmichClient.prototype.getAlbumAssets as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe('Network error');
    });

    it('should request appropriate representation based on viewType', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'album', id: 'album1' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' }
        ];

        (ImmichClient.prototype.getAlbumAssets as jest.Mock).mockResolvedValue(mockAssets);
        const getBlobUrlMock = (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValue('blob:url1');

        await resolver.resolve(source, { viewType: 'thumbnail' });
        expect(getBlobUrlMock).toHaveBeenCalledWith('asset1', 'thumbnail');

        getBlobUrlMock.mockClear();

        await resolver.resolve(source, { viewType: 'carousel' });
        expect(getBlobUrlMock).toHaveBeenCalledWith('asset1', 'preview');

        getBlobUrlMock.mockClear();

        await resolver.resolve(source, { viewType: 'grid' });
        expect(getBlobUrlMock).toHaveBeenCalledWith('asset1', 'thumbnail');

        getBlobUrlMock.mockClear();

        await resolver.resolve(source, {});
        expect(getBlobUrlMock).toHaveBeenCalledWith('asset1', 'original');
    });

    it('should resolve and fetch blobs successfully for favorites', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'favorites' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'fav1.jpg' }
        ];

        (ImmichClient.prototype.getFavorites as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url_fav1');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].path).toBe('immich://home/favorites/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url_fav1');
        expect(result.images[0].displayName).toBe('fav1.jpg');
    });

    it('should resolve and fetch blobs successfully for recent', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'recent' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'recent1.jpg' }
        ];

        (ImmichClient.prototype.getRecentAssets as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url_recent1');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].path).toBe('immich://home/recent/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url_recent1');
        expect(result.images[0].displayName).toBe('recent1.jpg');
    });

    it('should ignore single asset failure but resolve the rest', async () => {
        const source: IImmichAlbumSourceConfig = { type: 'immich', connection: 'home', source: { type: 'album', id: 'album1' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' },
            { id: 'asset2', originalFileName: 'photo2.jpg' }
        ];

        (ImmichClient.prototype.getAlbumAssets as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockRejectedValueOnce(new Error('Failed to load blob'))
                                                             .mockResolvedValueOnce('blob:url2');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].resourceUrl).toBe('blob:url2');
    });
});
