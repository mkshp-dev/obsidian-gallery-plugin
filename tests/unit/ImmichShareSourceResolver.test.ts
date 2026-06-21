import { ImmichShareSourceResolver } from '../../src/resolvers/ImmichShareSourceResolver';
import { IImmichShareSourceConfig } from '../../src/models/interfaces';
import { requestUrl } from 'obsidian';

jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

describe('ImmichShareSourceResolver', () => {
    let resolver: ImmichShareSourceResolver;

    beforeEach(() => {
        resolver = new ImmichShareSourceResolver();
        jest.clearAllMocks();
    });

    it('should fail cleanly on missing or invalid url', async () => {
        const source = { type: 'immich-share' } as any;
        const result = await resolver.resolve(source, {});
        expect(result.images).toHaveLength(0);
        expect(result.errors).toContain('Immich share source requires a valid url');
    });

    it('should fail cleanly on non-share URL format', async () => {
        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/not-share' };
        const result = await resolver.resolve(source, {});
        expect(result.images).toHaveLength(0);
        expect(result.errors[0]).toMatch(/URL does not appear to be an Immich share link/);
    });

    it('should resolve assets from valid share link', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                assets: [
                    { id: '123', originalFileName: 'photo1.jpg' },
                    { id: '456', originalFileName: 'photo2.png' }
                ]
            }
        });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/abc1234' };
        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(2);

        expect(result.images[0].path).toBe('https://immich.example.com/api/asset/file/123?key=abc1234');
        expect(result.images[0].displayName).toBe('photo1.jpg');

        expect(result.images[1].path).toBe('https://immich.example.com/api/asset/file/456?key=abc1234');
        expect(result.images[1].displayName).toBe('photo2.png');
    });

    it('should handle API errors gracefully', async () => {
        (requestUrl as jest.Mock).mockRejectedValue({ status: 404 });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/badkey' };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors[0]).toMatch(/Immich share not found or inaccessible/);
    });
});
