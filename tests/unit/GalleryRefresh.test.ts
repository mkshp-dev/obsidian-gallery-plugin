import { createMockMarkdownPostProcessorContext } from '../setup';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ImageSource } from '../../src/models/ImageSource';
import { IContentScanner, IImageSource, ISourceConfig } from '../../src/models/interfaces';

function createMockContainer(): HTMLElement & any {
    const el = document.createElement('div') as HTMLElement & any;
    const augment = (node: HTMLElement & any) => {
        node.createEl = (tag: string, options?: any) => {
            const child = document.createElement(tag) as HTMLElement & any;
            if (options && options.cls) child.className = options.cls;
            if (options && options.text) child.textContent = options.text;
            augment(child);
            node.appendChild(child);
            return child;
        };
        node.createDiv = (options?: any) => node.createEl('div', typeof options === 'string' ? { cls: options } : options || {});
        node.empty = () => { while (node.firstChild) node.removeChild(node.firstChild); };
        node.addClass = (cls: string) => node.classList.add(cls);
        node.removeClass = (cls: string) => node.classList.remove(cls);
        return node;
    };
    return augment(el);
}

class RecordingView {
    public type = 'thumbnail';
    public images: IImageSource[] = [];
    public updates: IImageSource[][] = [];
    update(images: IImageSource[]) { this.images = images; this.updates.push(images); }
    render() { /* no-op */ }
    destroy() { /* no-op */ }
    setOptions() { /* no-op */ }
    handleImageLoad() {}
    handleImageError() {}
    isImageVisible() { return true; }
    getStats() {
        return { totalImages: this.images.length, loadedImages: this.images.length, pendingImages: 0, errorImages: 0 };
    }
}

class RecordingViewFactory {
    public views: RecordingView[] = [];
    createView() { const v = new RecordingView(); this.views.push(v); return v; }
    getSupportedTypes() { return ['thumbnail', 'carousel', 'grid', 'embed']; }
    registerViewType() {}
}

const scanner: Partial<IContentScanner> = {
    scanPath: async () => [],
    validateImageSource: async () => true
};

/**
 * Sets up a processor whose resolver returns a new ImageSource object on every call,
 * with the same path per source, so tests can tell re-resolved images from reused ones.
 */
function setup() {
    const factory = new RecordingViewFactory();
    const processor = new GalleryProcessor(scanner as any, factory as any);
    const resolveCalls: string[] = [];

    processor['resolverRegistry'].resolveSource = jest.fn(async (source: ISourceConfig) => {
        resolveCalls.push(source.type);
        const image = source.type === 'local'
            ? ImageSource.fromLocalPath('photos/pic.jpg')
            : new ImageSource(`${source.type}://home/asset/1`, source.type, 'remote');
        jest.spyOn(image, 'destroy');
        return { images: [image], errors: [] };
    });

    return { factory, processor, resolveCalls };
}

async function createGallery(processor: GalleryProcessor, yaml: string) {
    const result = await processor.processCodeBlock(yaml, createMockContainer(), createMockMarkdownPostProcessorContext() as any);
    expect(result.success).toBe(true);
    return result.galleryInstance!;
}

const mixedYaml = `sources:
  - type: local
    path: photos
  - type: immich
    connection: home
view: thumbnail`;

const immichOnlyYaml = `sources:
  - type: immich
    connection: home
view: thumbnail`;

describe('GalleryProcessor refresh scoping', () => {
    test('a local refresh re-resolves only local sources and reuses the remote images', async () => {
        const { processor, resolveCalls } = setup();
        const gallery = await createGallery(processor, mixedYaml);
        const [oldLocal, oldRemote] = gallery.images;
        resolveCalls.length = 0;

        await processor.refreshAllGalleries(['local']);

        expect(resolveCalls).toEqual(['local']);
        const [newLocal, newRemote] = gallery.images;
        expect(newRemote).toBe(oldRemote);
        expect(oldRemote.destroy).not.toHaveBeenCalled();
        expect(newLocal).not.toBe(oldLocal);
        expect(oldLocal.destroy).toHaveBeenCalled();
    });

    test('a local refresh leaves galleries without a local source untouched', async () => {
        const { factory, processor, resolveCalls } = setup();
        await createGallery(processor, immichOnlyYaml);
        const view = factory.views[0];
        const updatesBefore = view.updates.length;
        resolveCalls.length = 0;

        await processor.refreshAllGalleries(['local']);

        expect(resolveCalls).toEqual([]);
        expect(view.updates.length).toBe(updatesBefore);
    });

    test("'none' re-renders the current images without resolving anything", async () => {
        const { factory, processor, resolveCalls } = setup();
        const gallery = await createGallery(processor, mixedYaml);
        const before = gallery.images;
        resolveCalls.length = 0;

        await processor.refreshAllGalleries('none');

        expect(resolveCalls).toEqual([]);
        expect(factory.views[0].updates.at(-1)).toEqual(before);
        before.forEach(img => expect(img.destroy).not.toHaveBeenCalled());
    });

    test("'all' re-resolves every source and releases the replaced images, even with unchanged paths", async () => {
        const { processor, resolveCalls } = setup();
        const gallery = await createGallery(processor, mixedYaml);
        const before = gallery.images;
        resolveCalls.length = 0;

        await processor.refreshAllGalleries('all');

        expect(resolveCalls).toEqual(['local', 'immich']);
        expect(gallery.images.map(img => img.path)).toEqual(before.map(img => img.path));
        before.forEach(img => expect(img.destroy).toHaveBeenCalled());
    });

    test('a refresh that finishes after a newer one started is discarded', async () => {
        const { processor } = setup();
        const gallery = await createGallery(processor, immichOnlyYaml);

        // First refresh resolves slowly, second quickly
        let releaseSlow: () => void = () => {};
        const slowImage = new ImageSource('immich://home/asset/1', 'immich', 'slow');
        const fastImage = new ImageSource('immich://home/asset/1', 'immich', 'fast');
        jest.spyOn(slowImage, 'destroy');
        (processor['resolverRegistry'].resolveSource as jest.Mock)
            .mockImplementationOnce(() => new Promise(resolve => { releaseSlow = () => resolve({ images: [slowImage], errors: [] }); }))
            .mockImplementationOnce(async () => ({ images: [fastImage], errors: [] }));

        const slow = processor.refreshGallery(gallery.id, 'all');
        const fast = processor.refreshGallery(gallery.id, 'all');
        await fast;
        releaseSlow();
        await slow;

        expect(gallery.images).toEqual([fastImage]);
        expect(slowImage.destroy).toHaveBeenCalled();
    });

    test('inline source errors include providers other than Immich', async () => {
        const { processor } = setup();
        (processor['resolverRegistry'].resolveSource as jest.Mock).mockImplementation(async (source: ISourceConfig) =>
            source.type === 'local'
                ? { images: [ImageSource.fromLocalPath('photos/pic.jpg')], errors: [] }
                : { images: [], errors: ["Nextcloud connection with key 'home' not found in settings."] });

        const container = createMockContainer();
        const result = await processor.processCodeBlock(`sources:
  - type: local
    path: photos
  - type: nextcloud
    connection: home
view: thumbnail`, container, createMockMarkdownPostProcessorContext() as any);

        expect(result.success).toBe(true);
        const errorElement = Array.from(container.children).find((child: any) => child.className === 'gallery-error-compact');
        expect((errorElement as any)?.textContent).toBe("⚠️ gallery: Nextcloud connection with key 'home' not found in settings.");
    });
});
