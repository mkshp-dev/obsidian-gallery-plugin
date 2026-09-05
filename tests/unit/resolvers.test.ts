import { LocalSourceResolver } from '../../src/resolvers/LocalSourceResolver';
import { ExternalSourceResolver } from '../../src/resolvers/ExternalSourceResolver';
import { SourceResolverRegistry } from '../../src/resolvers/SourceResolverRegistry';
import { IContentScanner, IImageSource, ILocalSourceConfig, IExternalSourceConfig } from '../../src/models/interfaces';
import { ImageSource } from '../../src/models/ImageSource';
import { NextcloudSourceResolver } from '../../src/resolvers/NextcloudSourceResolver';
import { NextcloudShareSourceResolver } from '../../src/resolvers/NextcloudShareSourceResolver';


describe('Resolvers', () => {
    let mockScanner: jest.Mocked<IContentScanner>;

    beforeEach(() => {
        mockScanner = {
            scanPath: jest.fn(),
            isImageFile: jest.fn(),
            extractLinksFromFile: jest.fn(),
            validateImageSource: jest.fn(),
            invalidateCache: jest.fn()
        } as unknown as jest.Mocked<IContentScanner>;
    });

    describe('LocalSourceResolver', () => {
        it('should resolve local source correctly', async () => {
            const resolver = new LocalSourceResolver(mockScanner);
            const source: ILocalSourceConfig = { type: 'local', path: 'folder', recursive: true };
            const mockImages = [{ path: 'folder/img.jpg', type: 'local' } as IImageSource];
            mockScanner.scanPath.mockResolvedValue(mockImages);

            const result = await resolver.resolve(source, {});

            expect(mockScanner.scanPath).toHaveBeenCalledWith('folder', true);
            expect(result.images).toEqual(mockImages);
            expect(result.errors).toEqual([]);
        });

        it('should return empty if path is missing or blank', async () => {
            const resolver = new LocalSourceResolver(mockScanner);
            const source: ILocalSourceConfig = { type: 'local', path: '   ' };

            const result = await resolver.resolve(source, {});

            expect(mockScanner.scanPath).not.toHaveBeenCalled();
            expect(result.images).toEqual([]);
            expect(result.errors).toEqual([]);
        });

        it('should resolve "." against the current note\'s folder', async () => {
            const resolver = new LocalSourceResolver(mockScanner);
            const source: ILocalSourceConfig = { type: 'local', path: '.', recursive: true };
            mockScanner.scanPath.mockResolvedValue([]);

            await resolver.resolve(source, { notePath: 'Gaming/Altruze.md' });

            expect(mockScanner.scanPath).toHaveBeenCalledWith('Gaming', true);
        });

        it('should resolve "../sibling" relative to the current note\'s folder', async () => {
            const resolver = new LocalSourceResolver(mockScanner);
            const source: ILocalSourceConfig = { type: 'local', path: '../Attachments', recursive: true };
            mockScanner.scanPath.mockResolvedValue([]);

            await resolver.resolve(source, { notePath: 'Notes/Sub/Foo.md' });

            expect(mockScanner.scanPath).toHaveBeenCalledWith('Notes/Attachments', true);
        });

        it('should leave absolute paths unchanged even when notePath is provided', async () => {
            const resolver = new LocalSourceResolver(mockScanner);
            const source: ILocalSourceConfig = { type: 'local', path: 'Images/Gallery', recursive: true };
            mockScanner.scanPath.mockResolvedValue([]);

            await resolver.resolve(source, { notePath: 'Notes/Foo.md' });

            expect(mockScanner.scanPath).toHaveBeenCalledWith('Images/Gallery', true);
        });

        it('should handle mixed valid and invalid urls correctly by returning valid ones and recording errors', async () => {
            const resolver = new ExternalSourceResolver();
            const source: IExternalSourceConfig = { type: 'external', urls: ['http://example.com/img.jpg', 'invalid-url', 'http://example.com/img2.jpg'] };

            const result = await resolver.resolve(source, {});

            expect(result.images.length).toBe(2);
            expect(result.images[0].path).toBe('http://example.com/img.jpg');
            expect(result.images[1].path).toBe('http://example.com/img2.jpg');
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('Invalid URL in external source urls list: invalid-url');
        });

        describe('filters, sort, and limit', () => {
            const makeImage = (name: string, size: number, mtime: number): IImageSource => {
                const img = ImageSource.fromLocalPath(`folder/${name}`, name.replace(/\.[^/.]+$/, ''));
                img.size = size;
                img.mtime = mtime;
                return img;
            };

            it('should filter by filenameFilter glob pattern', async () => {
                const resolver = new LocalSourceResolver(mockScanner);
                mockScanner.scanPath.mockResolvedValue([
                    makeImage('1.jpg', 100, 1000),
                    makeImage('2.png', 100, 1000),
                    makeImage('3.jpg', 100, 1000)
                ]);

                const source: ILocalSourceConfig = { type: 'local', path: 'folder', filenameFilter: '*.jpg' };
                const result = await resolver.resolve(source, {});

                expect(result.images.map(i => i.path)).toEqual(['folder/1.jpg', 'folder/3.jpg']);
            });

            it('should filter by modifiedAfter / modifiedBefore', async () => {
                const resolver = new LocalSourceResolver(mockScanner);
                mockScanner.scanPath.mockResolvedValue([
                    makeImage('1.jpg', 100, new Date('2025-01-01').getTime()),
                    makeImage('2.jpg', 100, new Date('2025-06-15').getTime()),
                    makeImage('3.jpg', 100, new Date('2025-12-31').getTime())
                ]);

                const source: ILocalSourceConfig = {
                    type: 'local',
                    path: 'folder',
                    filters: { modifiedAfter: '2025-02-01', modifiedBefore: '2025-11-01' }
                };
                const result = await resolver.resolve(source, {});

                expect(result.images.map(i => i.path)).toEqual(['folder/2.jpg']);
            });

            it('should filter by minSizeKb / maxSizeKb', async () => {
                const resolver = new LocalSourceResolver(mockScanner);
                mockScanner.scanPath.mockResolvedValue([
                    makeImage('1.jpg', 500 * 1024, 1000),
                    makeImage('2.jpg', 2000 * 1024, 1000),
                    makeImage('3.jpg', 5000 * 1024, 1000)
                ]);

                const source: ILocalSourceConfig = {
                    type: 'local',
                    path: 'folder',
                    filters: { minSizeKb: 1000, maxSizeKb: 4000 }
                };
                const result = await resolver.resolve(source, {});

                expect(result.images.map(i => i.path)).toEqual(['folder/2.jpg']);
            });

            it('should sort by name, size, and modified in both directions', async () => {
                const resolver = new LocalSourceResolver(mockScanner);
                const images = [
                    makeImage('b.jpg', 1000, new Date('2025-01-01').getTime()),
                    makeImage('c.jpg', 100, new Date('2025-06-15').getTime()),
                    makeImage('a.jpg', 500, new Date('2024-12-31').getTime())
                ];

                mockScanner.scanPath.mockResolvedValue([...images]);
                let result = await resolver.resolve({ type: 'local', path: 'folder', sort: { by: 'name', order: 'asc' } }, {});
                expect(result.images.map(i => i.displayName)).toEqual(['a', 'b', 'c']);

                mockScanner.scanPath.mockResolvedValue([...images]);
                result = await resolver.resolve({ type: 'local', path: 'folder', sort: { by: 'size', order: 'desc' } }, {});
                expect(result.images.map(i => i.displayName)).toEqual(['b', 'a', 'c']);

                mockScanner.scanPath.mockResolvedValue([...images]);
                result = await resolver.resolve({ type: 'local', path: 'folder', sort: { by: 'modified', order: 'asc' } }, {});
                expect(result.images.map(i => i.displayName)).toEqual(['a', 'b', 'c']);
            });

            it('should apply limit after filtering and sorting', async () => {
                const resolver = new LocalSourceResolver(mockScanner);
                mockScanner.scanPath.mockResolvedValue([
                    makeImage('1.jpg', 100, 1000),
                    makeImage('2.jpg', 100, 2000),
                    makeImage('3.jpg', 100, 3000)
                ]);

                const source: ILocalSourceConfig = { type: 'local', path: 'folder', sort: { by: 'modified', order: 'desc' }, limit: 2 };
                const result = await resolver.resolve(source, {});

                expect(result.images.map(i => i.path)).toEqual(['folder/3.jpg', 'folder/2.jpg']);
            });
        });
    });

    describe('ExternalSourceResolver', () => {
        it('should resolve external urls correctly', async () => {
            const resolver = new ExternalSourceResolver();
            const source: IExternalSourceConfig = { type: 'external', urls: ['http://example.com/img.jpg'] };

            const result = await resolver.resolve(source, {});

            expect(result.images.length).toBe(1);
            expect(result.images[0].path).toBe('http://example.com/img.jpg');
            expect(result.images[0].type).toBe('external');
        });

        it('should return empty if urls array is missing or empty', async () => {
            const resolver = new ExternalSourceResolver();
            const source: IExternalSourceConfig = { type: 'external', urls: [] };

            const result = await resolver.resolve(source, {});

            expect(result.images).toEqual([]);
            expect(result.errors).toEqual([]);
        });

        it('should handle mixed valid and invalid urls correctly by returning valid ones and recording errors', async () => {
            const resolver = new ExternalSourceResolver();
            const source: IExternalSourceConfig = { type: 'external', urls: ['http://example.com/img.jpg', 'invalid-url', 'http://example.com/img2.jpg'] };

            const result = await resolver.resolve(source, {});

            expect(result.images.length).toBe(2);
            expect(result.images[0].path).toBe('http://example.com/img.jpg');
            expect(result.images[1].path).toBe('http://example.com/img2.jpg');
            expect(result.errors.length).toBe(1);
            expect(result.errors[0]).toContain('Invalid URL in external source urls list: invalid-url');
        });

        it('should resolve object url entries with captions', async () => {
            const resolver = new ExternalSourceResolver();
            const source: IExternalSourceConfig = {
                type: 'external',
                urls: [
                    { url: 'http://example.com/pic1.jpg', caption: 'Sunset view' },
                    'http://example.com/pic2.jpg'
                ]
            };

            const result = await resolver.resolve(source, {});

            expect(result.images.length).toBe(2);
            expect(result.images[0].path).toBe('http://example.com/pic1.jpg');
            expect(result.images[0].caption).toBe('Sunset view');
            expect(result.images[1].path).toBe('http://example.com/pic2.jpg');
            expect(result.images[1].caption).toBeUndefined();
        });

    });

    describe('SourceResolverRegistry', () => {
        it('should resolve a valid source through dispatch correctly', async () => {
            const registry = new SourceResolverRegistry(mockScanner, () => [], () => []);
            const source: IExternalSourceConfig = { type: 'external', urls: ['http://example.com/img.jpg'] };

            const { images, errors } = await registry.resolveSource(source, {});

            expect(errors.length).toBe(0);
            expect(images.length).toBe(1);
            expect(images[0].path).toBe('http://example.com/img.jpg');
        });


        it('should have nextcloud resolver registered', () => {
            const registry = new SourceResolverRegistry(mockScanner, () => [], () => []);
            const nextcloudResolver = registry.getResolver('nextcloud');
            expect(nextcloudResolver).toBeInstanceOf(NextcloudSourceResolver);
        });

        it('should have nextcloud-share resolver registered', () => {
            const registry = new SourceResolverRegistry(mockScanner, () => [], () => []);
            const nextcloudShareResolver = registry.getResolver('nextcloud-share');
            expect(nextcloudShareResolver).toBeInstanceOf(NextcloudShareSourceResolver);
        });

        it('should fail in a controlled way for unknown source type', async () => {
            const registry = new SourceResolverRegistry(mockScanner, () => [], () => []);
            const source = { type: 'unknown_source_type' } as any;

            const { images, errors } = await registry.resolveSource(source, {});

            expect(images).toEqual([]);
            expect(errors.length).toBe(1);
            expect(errors[0]).toBe('Unsupported source type: unknown_source_type');
        });
    });
});
