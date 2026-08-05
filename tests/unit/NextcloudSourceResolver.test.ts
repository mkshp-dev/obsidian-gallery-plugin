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

        expect(mockListFiles).toHaveBeenCalledWith('/Photos', true, undefined);
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

        expect(mockListFiles).toHaveBeenCalledWith('/Photos', false, undefined);
    });

    it('should filter files by filenameFilter glob pattern', async () => {
        const mockListFiles = jest.fn().mockResolvedValue([
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg' },
            { path: '/2.png', name: '2.png', contentType: 'image/png' },
            { path: '/3.jpg', name: '3.jpg', contentType: 'image/jpeg' }
        ]);
        const mockGetFileBlobUrl = jest.fn().mockResolvedValue('blob:test');

        (NextcloudClient as jest.Mock).mockImplementation(() => {
            return {
                listFiles: mockListFiles,
                getFileBlobUrl: mockGetFileBlobUrl
            };
        });

        const source: INextcloudSourceConfig = { type: 'nextcloud', connection: 'my-cloud', path: '/', filenameFilter: '*.jpg' };
        const context: GallerySourceResolveContext = { viewType: 'grid' };

        const result = await resolver.resolve(source, context);

        expect(result.images.length).toBe(2);
        expect(result.images[0].displayName).toBe('1.jpg');
        expect(result.images[1].displayName).toBe('3.jpg');
        expect(mockGetFileBlobUrl).toHaveBeenCalledTimes(2);
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

    describe('Date Range Filters (modifiedAfter / modifiedBefore)', () => {
        const mockFiles = [
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg', lastModified: 'Wed, 01 Jan 2025 10:00:00 GMT' },
            { path: '/2.jpg', name: '2.jpg', contentType: 'image/jpeg', lastModified: 'Sun, 15 Jun 2025 10:00:00 GMT' },
            { path: '/3.jpg', name: '3.jpg', contentType: 'image/jpeg', lastModified: 'Wed, 31 Dec 2025 10:00:00 GMT' },
            { path: '/4.jpg', name: '4.jpg', contentType: 'image/jpeg' }, // No date
        ];

        beforeEach(() => {
            (NextcloudClient as jest.Mock).mockImplementation(() => ({
                listFiles: jest.fn().mockResolvedValue([...mockFiles]),
                getFileBlobUrl: jest.fn().mockResolvedValue('blob:test')
            }));
        });

        it('should filter files modified after a specific date (exclusive edge)', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { modifiedAfter: '2025-06-01T00:00:00.000Z' }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            expect(result.images.length).toBe(3);
            expect(result.images.map(i => i.displayName)).toEqual(['2.jpg', '3.jpg', '4.jpg']);
        });

        it('should filter files modified before a specific date (exclusive edge)', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { modifiedBefore: '2025-06-01T00:00:00.000Z' }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            expect(result.images.length).toBe(2);
            expect(result.images.map(i => i.displayName)).toEqual(['1.jpg', '4.jpg']);
        });

        it('should filter files within a date range (modifiedAfter and modifiedBefore)', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: {
                    modifiedAfter: '2025-01-01T10:00:01.000Z',
                    modifiedBefore: '2025-12-31T09:59:59.000Z'
                }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            // 1.jpg is exactly 2025-01-01 10:00:00 GMT
            // 2.jpg is 2025-06-15 10:00:00 GMT
            // 3.jpg is exactly 2025-12-31 10:00:00 GMT
            // Since modifiedAfter is 1 second after 1.jpg, 1.jpg is excluded.
            // Since modifiedBefore is 1 second before 3.jpg, 3.jpg is excluded.
            expect(result.images.length).toBe(2);
            expect(result.images.map(i => i.displayName)).toEqual(['2.jpg', '4.jpg']);
        });

        it('should handle timezone neutrality by parsing ISO strings correctly', async () => {
            // Using a plain date string without timezone info
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { modifiedAfter: '2025-06-15' } // This is typically parsed as UTC midnight
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            // 2.jpg is Jun 15 10:00:00 GMT, which is > Jun 15 00:00:00 GMT
            expect(result.images.length).toBe(3);
            expect(result.images.map(i => i.displayName)).toEqual(['2.jpg', '3.jpg', '4.jpg']);
        });

        it('should apply limit AFTER date filtering', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                limit: 1,
                filters: { modifiedAfter: '2025-06-01T00:00:00.000Z' }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            // Without limit, it would be [2.jpg, 3.jpg, 4.jpg]
            // With limit 1, it should just be 2.jpg
            expect(result.images.length).toBe(1);
            expect(result.images[0].displayName).toBe('2.jpg');
        });
    });

    describe('Size Filters (maxSizeKb / minSizeKb)', () => {
        const mockFiles = [
            { path: '/1.jpg', name: '1.jpg', contentType: 'image/jpeg', size: 500 * 1024 }, // 500 KB
            { path: '/2.jpg', name: '2.jpg', contentType: 'image/jpeg', size: 2000 * 1024 }, // 2000 KB
            { path: '/3.jpg', name: '3.jpg', contentType: 'image/jpeg', size: 5000 * 1024 }, // 5000 KB
            { path: '/4.jpg', name: '4.jpg', contentType: 'image/jpeg' }, // No size
        ];

        beforeEach(() => {
            (NextcloudClient as jest.Mock).mockImplementation(() => ({
                listFiles: jest.fn().mockResolvedValue([...mockFiles]),
                getFileBlobUrl: jest.fn().mockResolvedValue('blob:test')
            }));
        });

        it('should filter files by maxSizeKb', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { maxSizeKb: 2500 }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            expect(result.images.length).toBe(3);
            expect(result.images.map(i => i.displayName)).toEqual(['1.jpg', '2.jpg', '4.jpg']);
        });

        it('should filter files by minSizeKb', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { minSizeKb: 1000 }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            expect(result.images.length).toBe(3);
            expect(result.images.map(i => i.displayName)).toEqual(['2.jpg', '3.jpg', '4.jpg']);
        });

        it('should filter files by both minSizeKb and maxSizeKb', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                filters: { minSizeKb: 1000, maxSizeKb: 4000 }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            expect(result.images.length).toBe(2);
            expect(result.images.map(i => i.displayName)).toEqual(['2.jpg', '4.jpg']);
        });

        it('should apply limit AFTER size filtering', async () => {
            const source: INextcloudSourceConfig = {
                type: 'nextcloud',
                connection: 'my-cloud',
                path: '/',
                limit: 1,
                filters: { minSizeKb: 1000 }
            };
            const context: GallerySourceResolveContext = { viewType: 'grid' };

            const result = await resolver.resolve(source, context);

            // Without limit: 2.jpg, 3.jpg, 4.jpg
            // With limit 1: 2.jpg
            expect(result.images.length).toBe(1);
            expect(result.images[0].displayName).toBe('2.jpg');
        });
    });
});

describe('Nextcloud Source Sorting', () => {
    let resolver: NextcloudSourceResolver;

    beforeEach(() => {
        resolver = new NextcloudSourceResolver(() => [
            { key: 'my-cloud', baseUrl: 'https://cloud.example.com', username: 'user', appPassword: 'password' }
        ]);
        const mockFiles = [
            { path: '/a.jpg', name: 'a.jpg', contentType: 'image/jpeg', size: 500, lastModified: 'Wed, 01 Jan 2025 10:00:00 GMT' },
            { path: '/c.jpg', name: 'c.jpg', contentType: 'image/jpeg', size: 100, lastModified: 'Sun, 15 Jun 2025 10:00:00 GMT' },
            { path: '/b.jpg', name: 'b.jpg', contentType: 'image/jpeg', size: 1000, lastModified: 'Wed, 31 Dec 2024 10:00:00 GMT' }
        ];

        (NextcloudClient as jest.Mock).mockImplementation(() => ({
            listFiles: jest.fn().mockResolvedValue([...mockFiles]),
            getFileBlobUrl: jest.fn().mockResolvedValue('blob:test')
        }));
    });

    it('should sort by name asc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'name', order: 'asc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    });

    it('should sort by name desc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'name', order: 'desc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['c.jpg', 'b.jpg', 'a.jpg']);
    });

    it('should sort by size asc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'size', order: 'asc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    });

    it('should sort by size desc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'size', order: 'desc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    });

    it('should sort by lastModified asc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'lastModified', order: 'asc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    });

    it('should sort by lastModified desc', async () => {
        const source: INextcloudSourceConfig = {
            type: 'nextcloud', connection: 'my-cloud', path: '/',
            sort: { by: 'lastModified', order: 'desc' }
        };
        const result = await resolver.resolve(source, { viewType: 'grid' });
        expect(result.images.map(i => i.displayName)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
    });
});
