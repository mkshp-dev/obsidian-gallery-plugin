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

  constructor(container: HTMLElement) {
    super('grid', container);
  }

  render(): void {
    if (this._isDestroyed) return;

    // Clear container
    this.container.empty();

    this.gridContainer = this.container.createEl('div', { cls: 'gallery-grid' });

    const imagesData: Array<{ src: string; alt?: string }> = [];

    this._images.forEach((img, idx) => {
      const wrapper = this.gridContainer!.createEl('div', { cls: 'gallery-grid-item' });
      wrapper.setAttribute('data-image-path', img.path);

      // Create img element; LazyLoader will set src when observing
      const el = wrapper.createEl('img', { cls: 'gallery-grid-image', attr: { alt: img.displayName || `Image ${idx + 1}` } });
      el.dataset.src = img.getDisplayUrl();

      // Wire up load/error handlers to propagate state to GalleryView
      el.addEventListener('load', () => this.handleImageLoad(img));
      el.addEventListener('error', () => this.handleImageError(img, new Error('Failed to load')));
    });

    // Use LazyLoader to observe images (observe existing img elements)
    this.loader?.disconnect();
    this.loader = new LazyLoader({
      placeholderSrc: '',
      loadingClass: 'gallery-loading',
      loadedClass: 'gallery-loaded',
      errorClass: 'gallery-error'
    });

    // Observe all images we just created
    const imgs = Array.from(this.gridContainer.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((imgEl) => {
      const src = (imgEl.dataset && imgEl.dataset.src) || (imgEl.getAttribute('src') || '');
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
