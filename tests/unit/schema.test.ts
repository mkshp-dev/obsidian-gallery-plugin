import { ParameterParser } from '../../src/processors/ParameterParser';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ImageSource } from '../../src/models/ImageSource';
import { IContentScanner } from '../../src/models/interfaces';

// Minimal mock view factory and mock view for testing rendering behavior
function createMockContainer(): HTMLElement & any {
  const el = document.createElement('div') as HTMLElement & any;

  const augment = (node: HTMLElement & any) => {
    node.createEl = (tag: string, options?: any) => {
      const child = document.createElement(tag) as HTMLElement & any;
      if (options && options.cls) child.className = options.cls;
      if (options && options.text) child.textContent = options.text;
      if (options && options.attr) {
        Object.keys(options.attr).forEach((k: string) => child.setAttribute(k, options.attr[k]));
      }
      augment(child);
      node.appendChild(child);
      return child;
    };

    node.createDiv = (options?: any) => {
      let opts = typeof options === 'string' ? { cls: options } : options || {};
      return node.createEl('div', opts);
    };

    node.createSpan = (options?: any) => {
      let opts = typeof options === 'string' ? { cls: options } : options || {};
      return node.createEl('span', opts);
    };

    node.empty = () => {
      while (node.firstChild) node.removeChild(node.firstChild);
    };

    node.addClass = (cls: string) => node.classList.add(cls);
    node.removeClass = (cls: string) => node.classList.remove(cls);
    node.q = (selector: string) => node.querySelector(selector);

    return node;
  };

  return augment(el);
}

class DummyView {
    public type = 'thumbnail';
    public container: any = { createEl: () => {} };
    public images: any[] = [];
    public remoteLoadTimeoutMs?: number;
    public allowRemoteImages?: boolean;

    async update(images: any[]) {
        this.images = images;
    }

    render() { /* no-op */ }
    destroy() { /* no-op */ }
    handleImageLoad() {}
    handleImageError() {}
    isImageVisible() { return true; }
    getStats() {
        return {
            totalImages: this.images.length,
            loadedImages: this.images.length,
            pendingImages: 0,
            errorImages: 0
        };
    }
}

class FakeViewFactory {
    public lastViewTypeCreated: string = '';
    createView(type: string, container: HTMLElement) {
        this.lastViewTypeCreated = type;
        const view = new DummyView();
        view.type = type;
        return view;
    }
    getSupportedTypes() { return ['thumbnail', 'carousel', 'grid']; }
    registerViewType() {}
}

const fakeScanner: Partial<IContentScanner> = {
    scanPath: async (path: string, recursive?: boolean) => {
        return [ImageSource.fromLocalPath(`${path}/pic.jpg`)];
    },
    validateImageSource: async () => true
};

describe('Gallery Schema Hardening & v2 Schema Validation', () => {
    describe('Parsing and Normalization', () => {
        test('legacy local block -> normalized sources + view', () => {
            const yaml = `path: Photos/Vacation\nrecursive: true\nview: thumbnail`;
            const config = ParameterParser.parseAndValidate(yaml);
            
            expect(config.sources).toBeDefined();
            expect(config.sources!.length).toBe(1);
            expect(config.sources![0]).toEqual({
                type: 'local',
                path: 'Photos/Vacation',
                recursive: true
            });
            expect(config.view).toEqual({ type: 'thumbnail' });
        });

        test('legacy external block -> normalized sources + view', () => {
            const yaml = `urls:\n  - https://example.com/img1.jpg\n  - https://example.com/img2.png\nview: carousel`;
            const config = ParameterParser.parseAndValidate(yaml);

            expect(config.sources).toBeDefined();
            expect(config.sources!.length).toBe(1);
            expect(config.sources![0]).toEqual({
                type: 'external',
                urls: [
                    'https://example.com/img1.jpg',
                    'https://example.com/img2.png'
                ]
            });
            expect(config.view).toEqual({ type: 'carousel' });
        });

        test('new v2 local block parses correctly', () => {
            const yaml = `sources:\n  - type: local\n    path: Images/Screenshots\n    recursive: false\nview:\n  type: grid`;
            const config = ParameterParser.parseAndValidate(yaml);

            expect(config.sources).toBeDefined();
            expect(config.sources!.length).toBe(1);
            expect(config.sources![0]).toEqual({
                type: 'local',
                path: 'Images/Screenshots',
                recursive: false
            });
            expect(config.view).toEqual({ type: 'grid' });
        });

        test('new v2 external block parses correctly', () => {
            const yaml = `sources:\n  - type: external\n    urls:\n      - https://example.com/img.webp\nview:\n  type: carousel`;
            const config = ParameterParser.parseAndValidate(yaml);

            expect(config.sources).toBeDefined();
            expect(config.sources!.length).toBe(1);
            expect(config.sources![0]).toEqual({
                type: 'external',
                urls: ['https://example.com/img.webp']
            });
            expect(config.view).toEqual({ type: 'carousel' });
        });

        test('legacy view: "grid" normalizes to view.type = "grid"', () => {
            const yaml = `path: photos\nview: grid`;
            const config = ParameterParser.parseAndValidate(yaml);
            expect(config.view).toEqual({ type: 'grid' });
        });

        test('new view: { type: ... } parses correctly', () => {
            const yaml = `path: photos\nview:\n  type: grid\n  columns: 4`;
            const config = ParameterParser.parseAndValidate(yaml);
            expect(config.view).toEqual({ type: 'grid', columns: 4 });
        });
    });

    describe('Rendering / Behavior', () => {
        test('v2 local block renders the same way as legacy local block', async () => {
            const factoryLegacy = new FakeViewFactory();
            const processorLegacy = new GalleryProcessor(fakeScanner as any, factoryLegacy as any);
            const containerLegacy = createMockContainer();
            const resultLegacy = await processorLegacy.processCodeBlock(
                `path: photos\nview: thumbnail\nrecursive: true`,
                containerLegacy,
                {} as any
            );

            const factoryV2 = new FakeViewFactory();
            const processorV2 = new GalleryProcessor(fakeScanner as any, factoryV2 as any);
            const containerV2 = createMockContainer();
            const resultV2 = await processorV2.processCodeBlock(
                `sources:\n  - type: local\n    path: photos\n    recursive: true\nview:\n  type: thumbnail`,
                containerV2,
                {} as any
            );

            expect(resultLegacy.success).toBe(true);
            expect(resultV2.success).toBe(true);

            expect(resultLegacy.imagesFound).toBe(resultV2.imagesFound);
            expect(resultLegacy.imagesValid).toBe(resultV2.imagesValid);
            expect(resultLegacy.imagesLoaded).toBe(resultV2.imagesLoaded);

            const instanceLegacy = resultLegacy.galleryInstance!;
            const instanceV2 = resultV2.galleryInstance!;

            // Check that the parsed images are identical
            expect(instanceLegacy.images.map(img => img.path)).toEqual(instanceV2.images.map(img => img.path));
            expect(instanceLegacy.images.map(img => img.type)).toEqual(instanceV2.images.map(img => img.type));
        });

        test('v2 external block renders the same way as legacy external block', async () => {
            const factoryLegacy = new FakeViewFactory();
            const processorLegacy = new GalleryProcessor(fakeScanner as any, factoryLegacy as any);
            const containerLegacy = createMockContainer();
            const resultLegacy = await processorLegacy.processCodeBlock(
                `urls:\n  - https://picsum.photos/200\nview: carousel`,
                containerLegacy,
                {} as any,
                { allowRemoteImages: true }
            );

            const factoryV2 = new FakeViewFactory();
            const processorV2 = new GalleryProcessor(fakeScanner as any, factoryV2 as any);
            const containerV2 = createMockContainer();
            const resultV2 = await processorV2.processCodeBlock(
                `sources:\n  - type: external\n    urls:\n      - https://picsum.photos/200\nview:\n  type: carousel`,
                containerV2,
                {} as any,
                { allowRemoteImages: true }
            );

            expect(resultLegacy.success).toBe(true);
            expect(resultV2.success).toBe(true);

            expect(resultLegacy.imagesFound).toBe(resultV2.imagesFound);
            expect(resultLegacy.imagesValid).toBe(resultV2.imagesValid);
            expect(resultLegacy.imagesLoaded).toBe(resultV2.imagesLoaded);

            const instanceLegacy = resultLegacy.galleryInstance!;
            const instanceV2 = resultV2.galleryInstance!;

            expect(instanceLegacy.images.map(img => img.path)).toEqual(instanceV2.images.map(img => img.path));
        });

        test('each supported view type works with v2 syntax', async () => {
            const viewTypes = ['thumbnail', 'carousel', 'grid'];
            for (const viewType of viewTypes) {
                const factory = new FakeViewFactory();
                const processor = new GalleryProcessor(fakeScanner as any, factory as any);
                const container = createMockContainer();
                const result = await processor.processCodeBlock(
                    `sources:\n  - type: local\n    path: photos\nview:\n  type: ${viewType}`,
                    container,
                    {} as any
                );

                expect(result.success).toBe(true);
                expect(factory.lastViewTypeCreated).toBe(viewType);
            }
        });
    });
});
