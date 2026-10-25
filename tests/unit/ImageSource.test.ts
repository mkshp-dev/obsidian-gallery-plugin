import { ImageSource } from '../../src/models/ImageSource';
import { ObjectUrlManager } from '../../src/utils/ObjectUrlManager';

describe('ImageSource', () => {
    describe('getDisplayUrl', () => {
        it('should return resourceUrl for local image if resourceUrl is provided', () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic', 'app://local-resource/pic.jpg');
            expect(img.getDisplayUrl()).toBe('app://local-resource/pic.jpg');
        });

        it('should return path for local image if resourceUrl is not provided', () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic');
            expect(img.getDisplayUrl()).toBe('images/pic.jpg');
        });

        it('should return resourceUrl for immich image if resourceUrl is provided', () => {
            const img = new ImageSource('immich://conn/album/1/asset/2', 'immich', 'asset2', 'blob:http-mock-blob');
            expect(img.getDisplayUrl()).toBe('blob:http-mock-blob');
        });

        it('should return path for immich image if resourceUrl is not provided', () => {
            const img = new ImageSource('immich://conn/album/1/asset/2', 'immich', 'asset2');
            expect(img.getDisplayUrl()).toBe('immich://conn/album/1/asset/2');
        });

        it('should return resourceUrl for external image if resourceUrl is provided', () => {
            const img = new ImageSource('https://example.com/pic.jpg', 'external', 'pic', 'blob:something-else');
            expect(img.getDisplayUrl()).toBe('blob:something-else');
        });

        it('should return resourceUrl for immich-share image if resourceUrl is provided', () => {
            const img = new ImageSource('https://example.com/share/key/original', 'immich-share', 'share-pic', 'blob:something-else');
            expect(img.getDisplayUrl()).toBe('blob:something-else');
        });
    });

    describe('hasTimedOut', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should return false for local images even after time passes', () => {
            const img = new ImageSource('images/pic.jpg', 'local');
            img.startLoading();
            jest.advanceTimersByTime(15000); // 15 seconds
            expect(img.hasTimedOut()).toBe(false);
        });

        it('should return false for immich images even after time passes', () => {
            const img = new ImageSource('immich://conn/album/1/asset/2', 'immich');
            img.startLoading();
            jest.advanceTimersByTime(15000); // 15 seconds
            expect(img.hasTimedOut()).toBe(false);
        });

        it('should return false for nextcloud images even after time passes', () => {
            const img = new ImageSource('nextcloud://conn/files/image.jpg', 'nextcloud');
            img.startLoading();
            jest.advanceTimersByTime(15000); // 15 seconds
            expect(img.hasTimedOut()).toBe(false);
        });

        it('should return true for external images if loading takes more than 10 seconds', () => {
            const img = new ImageSource('https://example.com/pic.jpg', 'external');
            
            expect(img.hasTimedOut()).toBe(false); // pending
            
            img.startLoading();
            expect(img.hasTimedOut()).toBe(false);
            
            jest.advanceTimersByTime(9999);
            expect(img.hasTimedOut()).toBe(false);
            
            jest.advanceTimersByTime(2); // 10001 ms total
            expect(img.hasTimedOut()).toBe(true);
        });
    });

    describe('resolveDisplayUrl', () => {
        it('should return the display URL directly when there is no loader', async () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic', 'app://local/images/pic.jpg');
            await expect(img.resolveDisplayUrl()).resolves.toBe('app://local/images/pic.jpg');
        });

        it('should run the loader once, on first use, and remember the URL', async () => {
            const loader = jest.fn().mockResolvedValue('blob:loaded');
            const img = new ImageSource('nextcloud://conn/a.jpg', 'nextcloud', 'a', undefined, undefined, loader);

            expect(loader).not.toHaveBeenCalled();
            expect(img.resourceUrl).toBeUndefined();

            const [first, second] = await Promise.all([img.resolveDisplayUrl(), img.resolveDisplayUrl()]);
            expect(first).toBe('blob:loaded');
            expect(second).toBe('blob:loaded');
            await expect(img.resolveDisplayUrl()).resolves.toBe('blob:loaded');
            expect(loader).toHaveBeenCalledTimes(1);
            expect(img.getDisplayUrl()).toBe('blob:loaded');
        });

        it('should run the loader again after a failure, so retries work', async () => {
            const loader = jest.fn()
                .mockRejectedValueOnce(new Error('HTTP 503'))
                .mockResolvedValueOnce('blob:second-try');
            const img = new ImageSource('immich://conn/search/asset/1', 'immich', 'a', undefined, undefined, loader);

            await expect(img.resolveDisplayUrl()).rejects.toThrow('HTTP 503');
            await expect(img.resolveDisplayUrl()).resolves.toBe('blob:second-try');
        });
    });

    describe('destroy', () => {
        let spyRelease: jest.SpyInstance;

        beforeEach(() => {
            spyRelease = jest.spyOn(ObjectUrlManager, 'releaseByUrl').mockImplementation(() => {});
        });

        afterEach(() => {
            spyRelease.mockRestore();
        });

        it('should release the URL its loader acquired, once', async () => {
            const img = new ImageSource('nextcloud-share://TOKEN/a.jpg', 'nextcloud-share', 'a', undefined, undefined,
                () => Promise.resolve('blob:share-url'));
            await img.resolveDisplayUrl();

            img.destroy();
            img.destroy();

            expect(spyRelease).toHaveBeenCalledTimes(1);
            expect(spyRelease).toHaveBeenCalledWith('blob:share-url');
            expect(img.resourceUrl).toBeUndefined();
        });

        it('should not release anything when the loader never ran', () => {
            const img = new ImageSource('immich://conn/search/asset/1', 'immich', 'a', undefined, undefined, jest.fn());
            img.destroy();
            expect(spyRelease).not.toHaveBeenCalled();
        });

        it('should release a URL that arrives after the image was destroyed', async () => {
            let resolveLoad: (url: string) => void = () => {};
            const img = new ImageSource('immich://conn/search/asset/1', 'immich', 'a', undefined, undefined,
                () => new Promise<string>(resolve => { resolveLoad = resolve; }));

            const pending = img.resolveDisplayUrl();
            img.destroy();
            resolveLoad('blob:late');

            await expect(pending).rejects.toThrow('destroyed');
            expect(spyRelease).toHaveBeenCalledWith('blob:late');
            expect(img.resourceUrl).toBeUndefined();
        });

        it('should not release a URL it was given rather than acquired', () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic', 'app://local/images/pic.jpg');
            img.destroy();
            expect(spyRelease).not.toHaveBeenCalled();
            expect(img.getDisplayUrl()).toBe('app://local/images/pic.jpg');
        });
    });

    describe('large version for the image viewer', () => {
        let spyRelease: jest.SpyInstance;

        beforeEach(() => {
            spyRelease = jest.spyOn(ObjectUrlManager, 'releaseByUrl').mockImplementation(() => {});
        });

        afterEach(() => {
            spyRelease.mockRestore();
        });

        it('falls back to the display URL when there is no larger version', async () => {
            const img = new ImageSource('immich://c/search/asset/1', 'immich', 'a', undefined, undefined, () => Promise.resolve('blob:thumb'));
            await expect(img.resolveLargeUrl()).resolves.toBe('blob:thumb');
        });

        it('fetches the larger version once, and releases it with the thumbnail on destroy', async () => {
            const large = jest.fn(() => Promise.resolve('blob:preview'));
            const img = new ImageSource('immich://c/search/asset/1', 'immich', 'a', undefined, undefined, () => Promise.resolve('blob:thumb'));
            img.setLargeLoader(large);

            await img.resolveDisplayUrl();
            await expect(img.resolveLargeUrl()).resolves.toBe('blob:preview');
            await expect(img.resolveLargeUrl()).resolves.toBe('blob:preview');
            expect(large).toHaveBeenCalledTimes(1);
            // The gallery keeps showing the thumbnail
            expect(img.getDisplayUrl()).toBe('blob:thumb');

            img.destroy();
            expect(spyRelease).toHaveBeenCalledWith('blob:thumb');
            expect(spyRelease).toHaveBeenCalledWith('blob:preview');
        });

        it('releases a larger version that arrives after the image was destroyed', async () => {
            let resolveLarge: (url: string) => void = () => {};
            const img = new ImageSource('immich://c/search/asset/1', 'immich', 'a', undefined, undefined, () => Promise.resolve('blob:thumb'));
            img.setLargeLoader(() => new Promise<string>(resolve => { resolveLarge = resolve; }));

            const pending = img.resolveLargeUrl();
            img.destroy();
            resolveLarge('blob:late-preview');

            await expect(pending).rejects.toThrow('destroyed');
            expect(spyRelease).toHaveBeenCalledWith('blob:late-preview');
        });
    });

    describe('caption', () => {
        it('should support caption property in constructor and factory methods', () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic', undefined, 'A custom caption');
            expect(img.caption).toBe('A custom caption');

            const localImg = ImageSource.fromLocalPath('images/pic.jpg', 'pic', 'app://pic', 'Local caption');
            expect(localImg.caption).toBe('Local caption');

            const extImg = ImageSource.fromUrl('https://example.com/pic.jpg', 'pic', 'External caption');
            expect(extImg.caption).toBe('External caption');
        });

        it('should default caption to undefined if omitted', () => {
            const img = new ImageSource('images/pic.jpg', 'local', 'pic');
            expect(img.caption).toBeUndefined();
        });
    });
});
