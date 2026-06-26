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
});
