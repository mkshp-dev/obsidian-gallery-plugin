import { ImageSource } from '../../src/models/ImageSource';

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

        it('should return path for external image even if resourceUrl is provided', () => {
            const img = new ImageSource('https://example.com/pic.jpg', 'external', 'pic', 'blob:something-else');
            expect(img.getDisplayUrl()).toBe('https://example.com/pic.jpg');
        });

        it('should return path for immich-share image even if resourceUrl is provided', () => {
            const img = new ImageSource('https://example.com/share/key/original', 'immich-share', 'share-pic', 'blob:something-else');
            expect(img.getDisplayUrl()).toBe('https://example.com/share/key/original');
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
