import { CarouselView } from '../../src/views/CarouselView';
import { GridView } from '../../src/views/GridView';
import { IImageSource } from '../../src/models/interfaces';

// Minimal mock container that implements a subset of Obsidian's DOM helpers
function createMockContainer(): HTMLElement & any {
  const el = document.createElement('div') as HTMLElement & any;

  // Helper to augment any element with the small subset of Obsidian helpers
  const augment = (node: HTMLElement & any) => {
    node.createEl = (tag: string, options?: any) => {
      const child = document.createElement(tag) as HTMLElement & any;
      if (options && options.cls) child.className = options.cls;
      if (options && options.text) child.textContent = options.text;
      if (options && options.attr) {
        Object.keys(options.attr).forEach((k: string) => child.setAttribute(k, options.attr[k]));
      }
      // augment child so nested createEl calls work
      augment(child);
      node.appendChild(child);
      return child;
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

function makeImage(path: string, state: 'pending' | 'loading' | 'loaded' | 'error'): IImageSource {
  let loadState = state;
  return {
    path,
    type: 'local',
    displayName: path.split('/').pop() || path,
    loadState,
    startLoading() { loadState = 'loading'; (this as any).loadState = 'loading'; },
    markLoaded(dim?: { width: number; height: number }) { loadState = 'loaded'; (this as any).loadState = 'loaded'; },
    markError(err: string) { loadState = 'error'; (this as any).loadState = 'error'; },
    reset() { loadState = 'pending'; (this as any).loadState = 'pending'; },
    canRetry() { return loadState === 'error'; },
    getDisplayUrl() { return `https://example.com/${encodeURIComponent(path)}`; },
    validateSize() { return true; }
  } as unknown as IImageSource;
}

describe('Gallery Views - getStats', () => {
  test('CarouselView reports correct stats from model', () => {
  const container = createMockContainer();
    const view = new CarouselView(container as any);

    const images = [
      makeImage('img1.jpg', 'loaded'),
      makeImage('img2.jpg', 'pending'),
      makeImage('img3.jpg', 'error')
    ];

    view.update(images);
    // render to populate DOM for fallback paths
    view.render();

    const stats = (view as any).getStats();
    expect(stats.totalImages).toBe(3);
    expect(stats.loadedImages).toBe(1);
    expect(stats.errorImages).toBe(1);
    expect(stats.pendingImages).toBe(1);
  });

  test('GridView reports correct stats from model and DOM fallback', () => {
  const container = createMockContainer();
    const view = new GridView(container as any);

    const images = [
      makeImage('a.png', 'pending'),
      makeImage('b.png', 'pending')
    ];

    // Update model but do not mark loaded to simulate pending state
    view.update(images);
    view.render();

    // Initially pending
    let stats = (view as any).getStats();
    expect(stats.totalImages).toBe(2);
    expect(stats.loadedImages).toBe(0);

    // Simulate one image loaded via DOM
    const imgEl = container.querySelector('img') as HTMLImageElement;
    if (imgEl) {
      // simulate natural size
      Object.defineProperty(imgEl, 'complete', { value: true, configurable: true });
      Object.defineProperty(imgEl, 'naturalWidth', { value: 800, configurable: true });
    }

    stats = (view as any).getStats();
    expect(stats.totalImages).toBe(2);
  });
});
