import { GalleryYamlGenerator } from '../../src/utils/GalleryYamlGenerator';
import { ISourceConfig } from '../../src/models/interfaces';

describe('GalleryYamlGenerator', () => {
    it('should generate valid yaml for a local source', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'local', path: 'Assets/Photos', recursive: true }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('```obs-gallery');
        expect(result).toContain('sources:');
        expect(result).toContain('- type: local');
        expect(result).toContain('path: Assets/Photos');
        expect(result).toContain('recursive: true');
        expect(result).toContain('view:');
        expect(result).toContain('type: grid');
    });

    it('should generate valid yaml for an external source', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'external', urls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'] }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'carousel');

        expect(result).toContain('- type: external');
        expect(result).toContain('urls:');
        expect(result).toContain('- https://example.com/1.jpg');
        expect(result).toContain('- https://example.com/2.jpg');
        expect(result).toContain('type: carousel');
    });

    it('should generate valid yaml for external sources with custom captions', () => {
        const sources: Partial<ISourceConfig>[] = [
            {
                type: 'external',
                urls: [
                    { url: 'https://example.com/1.jpg', caption: 'Custom Caption' },
                    'https://example.com/2.jpg'
                ]
            }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: external');
        expect(result).toContain('- url: https://example.com/1.jpg');
        expect(result).toContain('caption: "Custom Caption"');
        expect(result).toContain('- https://example.com/2.jpg');
    });

    it('should generate valid yaml for an immich-share source with password', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'immich-share', url: 'https://immich.example.com/share/abc', password: 'secretpassword' }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'thumbnail');

        expect(result).toContain('- type: immich-share');
        expect(result).toContain('url: https://immich.example.com/share/abc');
        expect(result).toContain('password: secretpassword');
    });

    it('should generate valid yaml for an immich-share source without password', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'immich-share', url: 'https://immich.example.com/share/xyz' }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'thumbnail');

        expect(result).toContain('- type: immich-share');
        expect(result).toContain('url: https://immich.example.com/share/xyz');
        expect(result).not.toContain('password:');
    });

    it('should generate valid yaml for an authenticated immich source (album mode)', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'immich', connection: 'home', filters: { albumIds: ['album-123'] } }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: immich');
        expect(result).toContain('connection: home');

        expect(result).toContain('filters:');
        expect(result).toContain('albumIds:');
        expect(result).toContain('- album-123');
    });

    it('should generate valid yaml for an authenticated immich source (favorites mode)', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'immich', connection: 'home', filters: { isFavorite: true } }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: immich');
        expect(result).toContain('connection: home');
        expect(result).toContain('filters:');
        expect(result).toContain('isFavorite: true');
    });

    it('should generate valid yaml for an authenticated immich source (recent mode)', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'immich', connection: 'home', limit: 50, sort: { by: 'createdAt', order: 'desc' } }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: immich');
        expect(result).toContain('connection: home');
        expect(result).toContain('limit: 50');
        expect(result).toContain('sort:');
        expect(result).toContain('by: createdAt');
        expect(result).toContain('order: desc');
    });

    it('should generate valid yaml for combined sources', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'local', path: 'Local/Pics' },
            { type: 'external', urls: ['https://example.com/img.png'] }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: local');
        expect(result).toContain('path: Local/Pics');
        expect(result).toContain('- type: external');
        expect(result).toContain('urls:');
        expect(result).toContain('- https://example.com/img.png');
    });

    it('should throw an error if no sources are provided', () => {
        expect(() => {
            GalleryYamlGenerator.generateYaml([], 'grid');
        }).toThrow('At least one source is required.');
    });

    it('should generate valid yaml for nextcloud source', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'nextcloud', connection: 'my-cloud', path: '/Photos', recursive: false, filenameFilter: '*.jpg', limit: 10, filters: { maxSizeKb: 5000, minSizeKb: 100 } }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'grid');

        expect(result).toContain('- type: nextcloud');
        expect(result).toContain('connection: my-cloud');
        expect(result).toContain('path: /Photos');
        expect(result).toContain('recursive: false');
        expect(result).toContain('filenameFilter: *.jpg');
        expect(result).toContain('limit: 10');
        expect(result).toContain('filters:');
        expect(result).toContain('maxSizeKb: 5000');
        expect(result).toContain('minSizeKb: 100');
    });

    it('should throw an error if nextcloud source is missing connection', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'nextcloud' }
        ];

        expect(() => {
            GalleryYamlGenerator.generateYaml(sources, 'grid');
        }).toThrow('Nextcloud source requires a connection.');
    });

    it('should generate valid yaml for nextcloud-share source with password', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN', password: 'secretpassword', filenameFilter: '*.png' }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'thumbnail');

        expect(result).toContain('- type: nextcloud-share');
        expect(result).toContain('url: https://cloud.example.com/s/TOKEN');
        expect(result).toContain('password: secretpassword');
        expect(result).toContain('filenameFilter: *.png');
    });

    it('should generate valid yaml for nextcloud-share source without password', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'nextcloud-share', url: 'https://cloud.example.com/s/TOKEN' }
        ];

        const result = GalleryYamlGenerator.generateYaml(sources, 'thumbnail');

        expect(result).toContain('- type: nextcloud-share');
        expect(result).toContain('url: https://cloud.example.com/s/TOKEN');
        expect(result).not.toContain('password:');
    });

    it('should throw an error if nextcloud-share source is missing url', () => {
        const sources: Partial<ISourceConfig>[] = [
            { type: 'nextcloud-share' }
        ];

        expect(() => {
            GalleryYamlGenerator.generateYaml(sources, 'grid');
        }).toThrow('Nextcloud share source requires a URL.');
    });

});

describe('Nextcloud & Nextcloud Share Sorting Generation', () => {
        it('should emit sort block for nextcloud sources', () => {
            const yaml = GalleryYamlGenerator.generateYaml([{
                type: 'nextcloud',
                connection: 'my-nc',
                sort: { by: 'size', order: 'desc' }
            }], 'grid');

            expect(yaml).toContain('sort:');
            expect(yaml).toContain('by: size');
            expect(yaml).toContain('order: desc');
        });

        it('should emit sort block for nextcloud-share sources', () => {
            const yaml = GalleryYamlGenerator.generateYaml([{
                type: 'nextcloud-share',
                url: 'https://cloud.example.com/s/TOKEN',
                sort: { by: 'lastModified', order: 'asc' }
            }], 'grid');

            expect(yaml).toContain('sort:');
            expect(yaml).toContain('by: lastModified');
            expect(yaml).toContain('order: asc');
        });
    });
