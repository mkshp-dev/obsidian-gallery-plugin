import { createMockMarkdownPostProcessorContext } from '../setup';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ImageSource } from '../../src/models/ImageSource';
import { IContentScanner } from '../../src/models/interfaces';

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

class StubView {
    public type = 'thumbnail';
    private images: unknown[] = [];
    update(images: unknown[]) { this.images = images; }
    render() { /* no-op */ }
    destroy() { /* no-op */ }
    setOptions() { /* no-op */ }
    getStats() {
        return { totalImages: this.images.length, loadedImages: this.images.length, pendingImages: 0, errorImages: 0 };
    }
}

const scanner: Partial<IContentScanner> = {
    scanPath: async () => [],
    validateImageSource: async () => true
};

function setup() {
    const factory = { createView: () => new StubView(), getSupportedTypes: () => ['thumbnail'], registerViewType: () => {} };
    const processor = new GalleryProcessor(scanner as any, factory as any);
    processor['resolverRegistry'].resolveSource = jest.fn(async () => ({
        images: [ImageSource.fromLocalPath('photos/pic.jpg')],
        errors: []
    }));
    return processor;
}

const yaml = `sources:
  - type: local
    path: photos
view: thumbnail`;

async function render(processor: GalleryProcessor, container: HTMLElement) {
    const result = await processor.processCodeBlock(yaml, container, createMockMarkdownPostProcessorContext() as any);
    expect(result.success).toBe(true);
    return result.galleryInstance!;
}

describe('GalleryProcessor duplicate cleanup', () => {
    test('rendering a block into a detached container keeps the other blocks\' galleries', async () => {
        // Live Preview renders each block into an element that is attached to the note only later
        const processor = setup();
        const first = await render(processor, createMockContainer());
        const second = await render(processor, createMockContainer());

        const active = processor.getActiveGalleries();
        expect(active).toContain(first);
        expect(active).toContain(second);
    });

    test('re-rendering a block replaces the gallery already in its container', async () => {
        const processor = setup();
        const container = createMockContainer();
        const first = await render(processor, container);
        const second = await render(processor, container);

        const active = processor.getActiveGalleries();
        expect(active).not.toContain(first);
        expect(active).toContain(second);
    });
});
