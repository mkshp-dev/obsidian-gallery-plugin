import { NextcloudSourceResolver } from '../../src/resolvers/NextcloudSourceResolver';
import { INextcloudConnection, INextcloudSourceConfig } from '../../src/models/interfaces';
import { GallerySourceResolveContext } from '../../src/resolvers/GallerySourceResolver';
import { NextcloudClient } from '../../src/services/nextcloud/NextcloudClient';

jest.mock('../../src/services/nextcloud/NextcloudClient');

describe('NextcloudSourceResolver', () => {
    let mockConnections: INextcloudConnection[];
    let resolver: NextcloudSourceResolver;

    beforeEach(() => {
        mockConnections = [
            {
                key: 'my-cloud',
                baseUrl: 'https://cloud.example.com',
                username: 'user1',
                appPassword: 'password123'
            }
        ];
        resolver = new NextcloudSourceResolver(() => mockConnections);

        // Reset the mock before each test
        (NextcloudClient as jest.Mock).mockClear();
    });

    it('should return error if connection key is missing', async () => {
        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: '' };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        const result = await resolver.resolve(source, context);

        expect(result.images.length).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain("Nextcloud source is missing a 'connection' reference");
    });

    it('should return error if connection is not found', async () => {
        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'non-existent' };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        const result = await resolver.resolve(source, context);

        expect(result.images.length).toBe(0);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]).toContain("Nextcloud connection with key 'non-existent' not found");
    });

    it('should resolve files successfully', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/Photos/image1.jpg', name: 'image1.jpg', contentType: 'image/jpeg', size: 1000 },
            { path: '/Photos/image2.png', name: 'image2.png', contentType: 'image/png', size: 2000 }
        ]);
        const mockGetFileBlobUrl = jest.fn().mockResolvedValue('blob:http://localhost/mock-blob-url');

        (NextcloudClient as jest.Mock).mockImplementation(() => {
            return {
                listFiles: mockListFiles,
                getFileBlobUrl: mockGetFileBlobUrl
            };
        });

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/Photos' };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        const result = await resolver.resolve(source, context);

        expect(result.errors.length).toBe(0);
        expect(result.images.length).toBe(2);

        expect(result.images[0].path).toBe('nextcloud://my-cloud/Photos/image1.jpg');
        expect(result.images[0].displayName).toBe('image1.jpg');
        expect(result.images[0].resourceUrl).toBe('blob:http://localhost/mock-blob-url');

        expect(result.images[1].path).toBe('nextcloud://my-cloud/Photos/image2.png');

        expect(mockListFiles).toHaveBeenCalledWith('/Photos', true);
        expect(mockGetFileBlobUrl).toHaveBeenCalledTimes(2);
        // since viewType is 'grid', we expect 'thumbnail' representation
        expect(mockGetFileBlobUrl).toHaveBeenCalledWith('/Photos/image1.jpg', 'thumbnail', undefined);
    });

    it('should handle individual file fetch failures gracefully', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/Photos/image1.jpg', name: 'image1.jpg', contentType: 'image/jpeg', size: 1000 },
            { path: '/Photos/image2.png', name: 'image2.png', contentType: 'image/png', size: 2000 }
        ]);

        const mockGetFileBlobUrl = jest.fn().mockImplementation((path) => {
            if (path.includes('image1.jpg')) {
                return Promise.reject(new Error('Failed to load blob'));
            }
            return Promise.resolve('blob:http://localhost/mock-blob-url');
        });

        (NextcloudClient as jest.Mock).mockImplementation(() => {
            return {
                listFiles: mockListFiles,
                getFileBlobUrl: mockGetFileBlobUrl
            };
        });

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/Photos' };
        const context: GallerySourceResolveContext = { viewType: 'carousel' };

        const result = await resolver.resolve(source, context);

        expect(result.errors.length).toBe(0);
        expect(result.images.length).toBe(1);
        expect(result.images[0].displayName).toBe('image2.png');

        // since viewType is 'carousel', we expect 'original' representation
        expect(mockGetFileBlobUrl).toHaveBeenCalledWith('/Photos/image1.jpg', 'original', undefined);
    });

    it('should respect recursive parameter', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([]);
        (NextcloudClient as jest.Mock).mockImplementation(() => {
            return {
                listFiles: mockListFiles,
                getFileBlobUrl: jest.fn()
            };
        });

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/Photos', recursive: false };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        await resolver.resolve(source, context);

        expect(mockListFiles).toHaveBeenCalledWith('/Photos', false);
    });

    it('should enforce limit parameter', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg' },
            { path: '/2.jpg', name: '2.jpg', contentType: 'image/jpeg' },
            { path: '/3.jpg', name: '3.jpg', contentType: 'image/jpeg' }
        ]);
        const mockGetFileBlobUrl = jest.fn().mockResolvedValue('blob:test');

        (NextcloudClient as jest.Mock).mockImplementation(() => {
            return {
                listFiles: mockListFiles,
                getFileBlobUrl: mockGetFileBlobUrl
            };
        });

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/', limit: 2 };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        const result = await resolver.resolve(source, context);

        expect(result.images.length).toBe(2);
        expect(result.images[0].displayName).toBe('1.jpg');
        expect(result.images[1].displayName).toBe('2.jpg');
        expect(mockGetFileBlobUrl).toHaveBeenCalledTimes(2);
    });

    it('should select thumbnail representation for thumbnail view', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg' }
        ]);
        const mockGetFileBlobUrl = jest.fn().mockResolvedValue('blob:test');
        (NextcloudClient as jest.Mock).mockImplementation(() => ({
            listFiles: mockListFiles, getFileBlobUrl: mockGetFileBlobUrl
        }));

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/' };
        const context: GallerySourceResolveContext = { viewType: 'thumbnail' };
        await resolver.resolve(source, context);

        expect(mockGetFileBlobUrl).toHaveBeenCalledWith('/1.jpg', 'thumbnail', undefined);
    });

    it('should select original representation for carousel view', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg' }
        ]);
        const mockGetFileBlobUrl = jest.fn().mockResolvedValue('blob:test');
        (NextcloudClient as jest.Mock).mockImplementation(() => ({
            listFiles: mockListFiles, getFileBlobUrl: mockGetFileBlobUrl
        }));

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/' };
        const context: GallerySourceResolveContext = { viewType: 'carousel' };
        await resolver.resolve(source, context);

        expect(mockGetFileBlobUrl).toHaveBeenCalledWith('/1.jpg', 'original', undefined);
    });

});
