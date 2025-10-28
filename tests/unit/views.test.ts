import { CarouselView } from '../../src/views/CarouselView';
import { GridView } from '../../src/views/GridView';
import { IImageSource } from '../../src/models/interfaces';

// Minimal mock container that implements a subset of Obsidian's DOM helpers
class MockContainer extends HTMLElement {
  constructor() {
    super();
  }

  createEl(tag: string, options?: any) {
    const el = document.createElement(tag);
    if (options && options.cls) el.className = options.cls;
    if (options && options.text) el.textContent = options.text;
    if (options && options.attr) {
      Object.keys(options.attr).forEach(k => el.setAttribute(k, options.attr[k]));
    }
    this.appendChild(el);
    return el;
  }

  empty() {
    while (this.firstChild) this.removeChild(this.firstChild);
  }

  addClass(cls: string) { this.classList.add(cls); }
  removeClass(cls: string) { this.classList.remove(cls); }

  // helper to find elements by selector
  q(selector: string) { return this.querySelector(selector); }
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
    const container = new MockContainer();
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
    const container = new MockContainer();
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
