import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';
import { LazyLoader } from '../utils/LazyLoader';

/**
 * GridView
 * Simple responsive masonry-like grid using CSS columns.
 * Uses LazyLoader to defer image loads.
 */
export class GridView extends GalleryView {
  private gridContainer: HTMLElement | null = null;
  private loader: LazyLoader | null = null;
  // Runtime options are provided by GalleryView.setOptions (remoteLoadTimeoutMs, allowRemoteImages)

  setOptions(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean } = {}): void {
    // Apply base options
    super.setOptions(options as any);
    // If loader exists, propagate timeout change
    if (this.loader && typeof options.remoteLoadTimeoutMs === 'number') {
      this.loader.updateOptions({ timeoutMs: options.remoteLoadTimeoutMs });
    }
    // allowRemoteImages is read at render time for blocked externals
  }

  constructor(container: HTMLElement) {
    super('grid', container);
  }

  render(): void {
    if (this._isDestroyed) return;
    // Clear container (use DOM-agnostic helper)
    this.emptyElement(this.container);

    this.gridContainer = this.createElement(this.container, 'div', { cls: 'gallery-grid' });

    const imagesData: Array<{ src: string; alt?: string }> = [];

    this._images.forEach((img, idx) => {
  const wrapper = this.createElement(this.gridContainer!, 'div', { cls: 'gallery-grid-item', attr: { 'data-image-path': img.path } });

  // Create img element; LazyLoader will set src when observing
  const el = this.createElement(wrapper, 'img', { cls: 'gallery-grid-image', attr: { alt: img.displayName || `Image ${idx + 1}` } }) as HTMLImageElement;

      // External images respect allowRemoteImages; if blocked, mark error state
      if (img.type === 'external' && !this.allowRemoteImages) {
        el.alt = img.displayName || 'External image blocked';
        this.safeAddClass(el, 'gallery-external-blocked');
        // Mark state so getStats / processor can observe
        this.updateImageElement(wrapper, img, 'error');
      } else {
        // Otherwise store as dataset for lazy loader
        try { el.dataset.src = img.getDisplayUrl(); } catch { el.setAttribute('data-src', img.getDisplayUrl()); }

        // Wire up load/error handlers to propagate state to GalleryView
        el.addEventListener('load', () => this.handleImageLoad(img));
        el.addEventListener('error', () => this.handleImageError(img, new Error('Failed to load')));
      }
    });

    // Use LazyLoader to observe images (observe existing img elements)
    this.loader?.disconnect();
    this.loader = new LazyLoader({
      placeholderSrc: '',
      loadingClass: 'gallery-loading',
      loadedClass: 'gallery-loaded',
      errorClass: 'gallery-error',
      timeoutMs: this.remoteLoadTimeoutMs ?? 10000
    });

    // Observe all images we just created
    const imgs = Array.from(this.gridContainer!.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((imgEl) => {
      const src = (imgEl.dataset && (imgEl.dataset.src || imgEl.getAttribute('data-src'))) || (imgEl.getAttribute('src') || '');
      if (src) this.loader!.observe(imgEl, src);
    });
  }

  update(images: IImageSource[]): void {
    super.update(images);
    // render called by base update
  }

  destroy(): void {
    this.loader?.disconnect();
    this.loader = null;
    this.gridContainer = null;
    super.destroy();
  }

  /**
   * Reload image in a specific element (used by retry)
   */
  protected reloadImage(element: HTMLElement, image: IImageSource): void {
    const imgEl = element.querySelector('img') as HTMLImageElement | null;
    if (!imgEl) return;

    if (image.type === 'external' && !this.allowRemoteImages) {
      // External blocked - remain in error
      this.handleImageError(image, new Error('External images are blocked by settings'));
      return;
    }

    // Use a temporary image to honor timeout
    const temp = new Image();
    let timeoutHandle: any = null;

    const onLoad = () => {
      clearTimeout(timeoutHandle);
      try { imgEl.src = temp.src; } catch {}
      this.handleImageLoad(image);
      cleanup();
    };

    const onError = (err?: Error) => {
      clearTimeout(timeoutHandle);
      this.handleImageError(image, err || new Error('Failed to load'));
      cleanup();
    };

    const cleanup = () => { temp.onload = null; temp.onerror = null; };

    temp.onload = onLoad;
    temp.onerror = () => onError(new Error('Failed to load'));

    timeoutHandle = setTimeout(() => onError(new Error('Image loading timed out')), this.remoteLoadTimeoutMs ?? 10000);
    try { temp.src = image.getDisplayUrl(); } catch (e) { onError(e as Error); }
  }

  /**
   * Provide rendering statistics so processor can detect progress
   */
  getStats(): { totalImages: number; loadedImages: number; pendingImages: number; errorImages: number } {
    let total = this._images.length;
    let loaded = this._images.filter(img => img.loadState === 'loaded').length;
    let error = this._images.filter(img => img.loadState === 'error').length;
    let pending = total - loaded - error;

    // Fallback to DOM inspection if model states are not yet set
    if (total === 0 && this.gridContainer) {
      const imgs = Array.from(this.gridContainer.querySelectorAll('img')) as HTMLImageElement[];
      total = imgs.length;
      loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      pending = total - loaded - error;
    }

    return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
  }
}
