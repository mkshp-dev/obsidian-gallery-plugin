import { createMockMarkdownPostProcessorContext } from "../setup";
import { ParameterParser } from '../../src/processors/ParameterParser';
import { GalleryProcessor } from '../../src/processors/GalleryProcessor';
import { ViewFactory } from '../../src/views/ViewFactory';
import { IContentScanner } from '../../src/models/interfaces';

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
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    };
  };
  augment(el);
  return el;
}

// Minimal fake view used by the processor for testing
class DummyView {
    public type = 'thumbnail' as const;
    public container: any = createMockContainer();
    public images: any[] = [];
    public remoteLoadTimeoutMs?: number;
    public allowRemoteImages?: boolean;

    async update(images: any[]) {
        this.images = images;
    }

    render() { /* no-op for tests */ }

    destroy() { /* no-op */ }

    handleImageLoad() { }
    handleImageError() { }
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
    createView(type: string, container: HTMLElement) {
        return new DummyView();
    }

    getSupportedTypes() { return ['thumbnail']; }
    registerViewType() { /* no-op */ }
}

const fakeScanner: Partial<IContentScanner> = {
    scanPath: async () => [],
    validateImageSource: async () => true
};

describe('ParameterParser and remote URL handling', () => {
    test('parses urls list normally', () => {
        const content = `path: ''\nurls:\n  - https://via.placeholder.com/600x400.png\n  - https://via.placeholder.com/300x200.jpg\nview: thumbnail`;
        const cfg = ParameterParser.parseAndValidate(content);
        expect((cfg as any).urls).toBeDefined();
        expect((cfg as any).urls.length).toBe(2);
    });

    test('parses urls list with NBSP/pasted indentation', () => {
        const content = `path: ''\nurls:\n\u00A0- https://picsum.photos/200/300\nview: thumbnail`;
        const cfg = ParameterParser.parseAndValidate(content);
        expect((cfg as any).urls).toBeDefined();
        expect((cfg as any).urls.length).toBe(1);
    });

    test('processor blocks external URLs when allowRemoteImages=false', async () => {
        const processor = new GalleryProcessor(fakeScanner as any, new FakeViewFactory() as any);
        const source = `path: ''\nurls:\n  - https://picsum.photos/200/300\nview: thumbnail`;
        const container = createMockContainer();
        const result = await processor.processCodeBlock(source, container, createMockMarkdownPostProcessorContext() as any, { allowRemoteImages: false });
        expect(result.success).toBe(false);
        expect(result.errors.some(e => typeof e === 'string' && e.includes('external'))).toBeTruthy();
    });

    test('processor accepts external URLs when allowRemoteImages=true', async () => {
        const processor = new GalleryProcessor(fakeScanner as any, new FakeViewFactory() as any);
        const source = `path: ''\nurls:\n  - https://picsum.photos/200/300\nview: thumbnail`;
        const container = createMockContainer();
        const result = await processor.processCodeBlock(source, container, createMockMarkdownPostProcessorContext() as any, { allowRemoteImages: true });
        expect(result.success).toBe(true);
        expect(result.imagesFound).toBeGreaterThan(0);
    });
});
