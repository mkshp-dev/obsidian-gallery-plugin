import { jest } from '@jest/globals';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ImageSource } from '../../src/models/ImageSource';

// Minimal mock implementations for dependencies
class MockContentScanner {
    async scanPath(path: string, recursive?: boolean) {
        // Return a single local image
        return [ImageSource.fromLocalPath('images/pic.jpg')];
    }
    isImageFile(path: string) { return true; }
    async extractLinksFromFile() { return []; }
    async validateImageSource() { return true; }
    invalidateCache() {}
}

class MockView {
    public readonly container: HTMLElement;
    public _images: any[] = [];
    constructor(container: HTMLElement) { this.container = container; }
    get type() { return 'thumbnail' as const; }
    get images() { return this._images; }
    async update(images: any[]) { this._images = images; }
    render() { /* no-op */ }
    destroy() { /* no-op */ }
    handleImageLoad() {}
    handleImageError() {}
    isImageVisible() { return true; }
    getStats() { return { totalImages: this._images.length, loadedImages: this._images.length, errorImages: 0 }; }
}

class MockViewFactory {
    createView(type: string, container: HTMLElement) {
        return new MockView(container);
    }
    getSupportedTypes() { return ['thumbnail']; }
    registerViewType() {}
}

describe('Gallery detach/reattach behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        // clean document body
        document.body.innerHTML = '';
    });

    test.skip('gallery is destroyed after grace period when container is removed', async () => {
        const scanner = new MockContentScanner() as any;
        const factory = new MockViewFactory() as any;

        const processor = new GalleryProcessor(scanner, factory);

        const container = document.createElement('div');
        document.body.appendChild(container);

        const result = await processor.processCodeBlock('path: images', container, {} as any, {
            showLoadingFeedback: false,
            enableValidation: true,
            maxRetries: 1,
            timeoutMs: 5000,
            allowRemoteImages: true,
            validateRemoteContentType: false,
            gracePeriodMs: 1000, // 1 second grace period for test
            enableLifecycleLogging: false
        });

        expect(result.success).toBe(true);
        const galleryId = result.galleryInstance?.id;
        expect(galleryId).toBeDefined();
        expect(processor.getGallery(galleryId!)).toBeDefined();

        // Remove container to trigger MutationObserver-based cleanup
        document.body.removeChild(container);

        // Advance timers past the internal retry attempts + grace period
        // attempts: 200 + 500 + 1000 + 2000 + 5000 + 10000 = 18800
        // plus gracePeriodMs: 1000 = 19800 total
        jest.advanceTimersByTime(25000); // Extra margin

        // After timeouts, gallery should be destroyed
        const maybe = processor.getGallery(galleryId!);
        expect(maybe).toBeUndefined();
    });

    test.skip('gallery survives when container is reattached before final destroy', async () => {
        const scanner = new MockContentScanner() as any;
        const factory = new MockViewFactory() as any;

        const processor = new GalleryProcessor(scanner, factory);

        const container = document.createElement('div');
        document.body.appendChild(container);

        const result = await processor.processCodeBlock('path: images', container, {} as any, {
            showLoadingFeedback: false,
            enableValidation: true,
            maxRetries: 1,
            timeoutMs: 5000,
            allowRemoteImages: true,
            validateRemoteContentType: false,
            gracePeriodMs: 5000, // 5 second grace period for reattach test
            enableLifecycleLogging: false
        });

        expect(result.success).toBe(true);
        const galleryId = result.galleryInstance?.id!;
        expect(processor.getGallery(galleryId)).toBeDefined();

        // Remove container
        document.body.removeChild(container);

        // Advance only part of the retry window, then reattach
        jest.advanceTimersByTime(2000); // 2 seconds
        document.body.appendChild(container);

        // Advance past the grace period but not past total destruction time
        jest.advanceTimersByTime(10000); // 10 more seconds

        // Gallery should still be present because it was reattached during grace period
        const still = processor.getGallery(galleryId);
        expect(still).toBeDefined();
    });
});
