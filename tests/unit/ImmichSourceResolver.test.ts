import { ImmichSourceResolver } from '../../src/resolvers/ImmichSourceResolver';
import { IImmichConnection, IImmichSourceConfig } from '../../src/models/interfaces';
import { ImmichClient } from '../../src/services/immich/ImmichClient';

jest.mock('../../src/services/immich/ImmichClient');

describe('ImmichSourceResolver', () => {
    let resolver: ImmichSourceResolver;
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

        resolver = new ImmichSourceResolver(() => mockConnections);
    });

    it('should return error if connection is missing in source', async () => {
        const source: any = { type: 'immich', filters: { albumIds: ['album1'] } };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("missing a 'connection' reference");
    });

    it('should return error if connection key is not found in settings', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'work', filters: { albumIds: ['album1'] } };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain("not found in settings");
    });

    it('should resolve and fetch blobs successfully', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', filters: { albumIds: ['album1'] } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' },
            { id: 'asset2', originalFileName: 'photo2.jpg' }
        ];

        (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url1')
                                                             .mockResolvedValueOnce('blob:url2');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(2);

        expect(result.images[0].path).toBe('immich://home/search/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url1');
        expect(result.images[0].displayName).toBe('photo1.jpg'); // ImageSource uses provided displayName verbatim
    });

    it('should handle searchMetadata throwing an error', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', filters: { albumIds: ['album1'] } };

        (ImmichClient.prototype.searchMetadata as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe('Network error');
    });

    it('should request appropriate representation based on viewType', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', filters: { albumIds: ['album1'] } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' }
        ];

        (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
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
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', filters: { isFavorite: true } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'fav1.jpg' }
        ];

        (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url_fav1');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].path).toBe('immich://home/search/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url_fav1');
        expect(result.images[0].displayName).toBe('fav1.jpg');
    });

    it('should resolve and fetch blobs successfully for recent with default limit', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', sort: { by: 'createdAt', order: 'desc' } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'recent1.jpg' }
        ];

        const recentSpy = (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url_recent1');

        const result = await resolver.resolve(source, {});

        expect(recentSpy).toHaveBeenCalledWith(undefined, undefined, { by: 'createdAt', order: 'desc' });
        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].path).toBe('immich://home/search/asset/asset1');
        expect(result.images[0].resourceUrl).toBe('blob:url_recent1');
        expect(result.images[0].displayName).toBe('recent1.jpg');
    });

    it('should resolve and fetch blobs successfully for recent with explicit limit', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', limit: 12 };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'recent1.jpg' }
        ];

        const recentSpy = (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url_recent1');

        const result = await resolver.resolve(source, {});

        expect(recentSpy).toHaveBeenCalledWith(undefined, 12, undefined);
        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);
    });

    it('should ignore single asset failure but resolve the rest', async () => {
        const source: IImmichSourceConfig = { type: 'immich', connection: 'home', filters: { albumIds: ['album1'] } };

        const mockAssets = [
            { id: 'asset1', originalFileName: 'photo1.jpg' },
            { id: 'asset2', originalFileName: 'photo2.jpg' }
        ];

        (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockRejectedValueOnce(new Error('Failed to load blob'))
                                                             .mockResolvedValueOnce('blob:url2');

        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].resourceUrl).toBe('blob:url2');
    });

    it('should assert date filters are passed correctly', async () => {
        const source: IImmichSourceConfig = {
            type: 'immich',
            connection: 'home',
            filters: {
                createdAfter: '2025-01-01',
                createdBefore: '2025-12-31'
            }
        };

        const mockAssets = [{ id: 'asset1', originalFileName: 'photo1.jpg' }];
        const searchSpy = (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url1');

        await resolver.resolve(source, {});

        expect(searchSpy).toHaveBeenCalledWith({ createdAfter: '2025-01-01', createdBefore: '2025-12-31' }, undefined, undefined);
    });

    it('should assert assetType filter is passed correctly', async () => {
        const source: IImmichSourceConfig = {
            type: 'immich',
            connection: 'home',
            filters: {
                assetType: 'video'
            }
        };

        const mockAssets = [{ id: 'asset1', originalFileName: 'video1.mp4' }];
        const searchSpy = (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url1');

        await resolver.resolve(source, {});

        expect(searchSpy).toHaveBeenCalledWith({ assetType: 'video' }, undefined, undefined);
    });

    it('should assert tag filters are passed correctly', async () => {
        const source: IImmichSourceConfig = {
            type: 'immich',
            connection: 'home',
            filters: {
                tagIds: ['tag1', 'tag2']
            }
        };

        const mockAssets = [{ id: 'asset1', originalFileName: 'photo.jpg' }];
        const searchSpy = (ImmichClient.prototype.searchMetadata as jest.Mock).mockResolvedValue(mockAssets);
        (ImmichClient.prototype.getAssetBlobUrl as jest.Mock).mockResolvedValueOnce('blob:url1');

        await resolver.resolve(source, {});

        expect(searchSpy).toHaveBeenCalledWith({ tagIds: ['tag1', 'tag2'] }, undefined, undefined);
    });
});
