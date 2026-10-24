import { ImmichShareSourceResolver } from '../../src/resolvers/ImmichShareSourceResolver';
import { IImmichShareSourceConfig } from '../../src/models/interfaces';
import { requestUrl } from 'obsidian';
import { ObjectUrlManager } from '../../src/utils/ObjectUrlManager';

jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

describe('ImmichShareSourceResolver', () => {
    let resolver: ImmichShareSourceResolver;

    beforeEach(() => {
        resolver = new ImmichShareSourceResolver();
        jest.resetAllMocks();
        ObjectUrlManager.cleanupAll();
        global.URL.createObjectURL = jest.fn(() => 'blob:share') as any;
        global.URL.revokeObjectURL = jest.fn() as any;
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

        expect(result.images[0].path).toBe('immich-share://abc1234/123');
        expect(result.images[0].type).toBe('immich-share');
        expect(result.images[0].displayName).toBe('photo1.jpg');

        expect(result.images[1].path).toBe('immich-share://abc1234/456');
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

        expect(result.images[0].path).toBe('immich-share://album123/789');
        expect(result.images[0].displayName).toBe('photo3.jpg');
    });

    it('should handle API errors gracefully', async () => {
        (requestUrl as jest.Mock).mockRejectedValue({ status: 404 });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/badkey' };
        const result = await resolver.resolve(source, {});

        expect(result.images).toHaveLength(0);
        expect(result.errors[0]).toMatch(/Immich share not found or inaccessible/);
    });

    it('should authenticate with password if provided', async () => {
        (requestUrl as jest.Mock)
            .mockResolvedValueOnce({
                status: 201,
                headers: {
                    'set-cookie': [
                        'other_cookie=xyz; Path=/;',
                        'immich_shared_link_token=authenticatedToken; Path=/;'
                    ]
                },
                json: {}
            })
            .mockResolvedValueOnce({
                status: 200,
                json: {
                    assets: [
                        { id: '999', originalFileName: 'private.jpg' }
                    ]
                }
            });

        const source: IImmichShareSourceConfig = {
            type: 'immich-share',
            url: 'https://immich.example.com/share/locked123',
            password: 'secretPassword'
        };
        const result = await resolver.resolve(source, {});

        expect(requestUrl).toHaveBeenNthCalledWith(1, {
            url: 'https://immich.example.com/api/shared-links/login?key=locked123',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                password: 'secretPassword'
            })
        });

        expect(requestUrl).toHaveBeenNthCalledWith(2, {
            url: 'https://immich.example.com/api/shared-links/me?key=locked123',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-immich-share-key': 'locked123',
                'Cookie': 'immich_shared_link_token=authenticatedToken'
            }
        });

        expect(result.errors).toHaveLength(0);
        expect(result.images).toHaveLength(1);
        expect(result.images[0].path).toBe('immich-share://locked123/999');
        expect(result.images[0].displayName).toBe('private.jpg');

        // The asset download sends the share session, which a plain image URL could not
        (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 200, arrayBuffer: new ArrayBuffer(4) });
        await expect(result.images[0].resolveDisplayUrl!()).resolves.toBe('blob:share');
        expect(requestUrl).toHaveBeenLastCalledWith({
            url: 'https://immich.example.com/api/assets/999/original?key=locked123',
            method: 'GET',
            headers: {
                'x-immich-share-key': 'locked123',
                'Cookie': 'immich_shared_link_token=authenticatedToken'
            }
        });
    });

    it('should not download assets until they are displayed, then fetch the representation for the view', async () => {
        (requestUrl as jest.Mock).mockResolvedValueOnce({
            status: 200,
            json: { assets: [{ id: '123', originalFileName: 'photo1.jpg', exifInfo: {} }] }
        });

        const source: IImmichShareSourceConfig = { type: 'immich-share', url: 'https://immich.example.com/share/abc1234' };
        const result = await resolver.resolve(source, { viewType: 'grid' });

        // Only the share lookup; exifInfo is present, so no per-asset caption lookup either
        expect(requestUrl).toHaveBeenCalledTimes(1);

        (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 200, arrayBuffer: new ArrayBuffer(4) });
        await expect(result.images[0].resolveDisplayUrl!()).resolves.toBe('blob:share');
        expect(requestUrl).toHaveBeenCalledTimes(2);
        expect(requestUrl).toHaveBeenLastCalledWith(expect.objectContaining({
            url: 'https://immich.example.com/api/assets/123/thumbnail?key=abc1234'
        }));

        // Destroying the image releases the blob URL it acquired
        result.images[0].destroy!();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:share');
    });
});
