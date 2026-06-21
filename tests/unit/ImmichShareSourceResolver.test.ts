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

        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://immich.example.com/api/shared-links/me?key=abc1234',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-immich-share-key': 'abc1234'
            }
        });

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(2);

        expect(result.images[0].path).toBe('https://immich.example.com/api/assets/123/original?key=abc1234');
        expect(result.images[0].displayName).toBe('photo1.jpg');

        expect(result.images[1].path).toBe('https://immich.example.com/api/assets/456/original?key=abc1234');
        expect(result.images[1].displayName).toBe('photo2.png');
    });

    it('should resolve assets nested inside album property', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: {
                album: {
                    assets: [
                        { id: '789', originalFileName: 'photo3.jpg' }
                    ]
                }
            }
        });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/album123' };
        const result = await resolver.resolve(source, {});

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);

        expect(result.images[0].path).toBe('https://immich.example.com/api/assets/789/original?key=album123');
        expect(result.images[0].displayName).toBe('photo3.jpg');
    });

    it('should handle API errors gracefully', async () => {
        (requestUrl as jest.Mock).mockRejectedValue({ status: 404 });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/badkey' };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors[0]).toMatch(/Immich share not found or inaccessible/);
    });
});
