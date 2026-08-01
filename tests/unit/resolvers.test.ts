import { LocalSourceResolver } from '../../src/resolvers/LocalSourceResolver';
import { ExternalSourceResolver } from '../../src/resolvers/ExternalSourceResolver';
import { SourceResolverRegistry } from '../../src/resolvers/SourceResolverRegistry';
import { IContentScanner, IImageSource, ILocalSourceConfig, IExternalSourceConfig } from '../../src/models/interfaces';
import { ImageSource } from '../../src/models/ImageSource';

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
            const registry = new SourceResolverRegistry(mockScanner);
            const source: IExternalSourceConfig = { type: 'external', urls: ['http://example.com/img.jpg'] };

            const { images, errors } = await registry.resolveSource(source, {});

            expect(errors.length).toBe(0);
            expect(images.length).toBe(1);
            expect(images[0].path).toBe('http://example.com/img.jpg');
        });

        it('should fail in a controlled way for unknown source type', async () => {
            const registry = new SourceResolverRegistry(mockScanner);
            const source = { type: 'unknown_source_type' } as any;

            const { images, errors } = await registry.resolveSource(source, {});

            expect(images).toEqual([]);
            expect(errors.length).toBe(1);
            expect(errors[0]).toBe('Unsupported source type: unknown_source_type');
        });
    });
});
