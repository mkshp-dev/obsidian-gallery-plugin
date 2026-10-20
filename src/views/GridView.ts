import { Logger } from "../utils/Logger";
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

  setOptions(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean; showCaptions?: boolean; captionMaxLines?: number; pagination?: boolean; itemsPerPage?: number } = {}): void {
    // Apply base options
    super.setOptions(options);
    // If loader exists, propagate timeout change
    if (this.loader && typeof options.remoteLoadTimeoutMs === 'number') {
      this.loader.updateOptions({ timeoutMs: options.remoteLoadTimeoutMs });
    }
    // allowRemoteImages is read at render time for blocked externals
  }

  constructor(container: HTMLElement) {
    super('grid', container);
  }

  /**
   * Override to prevent adding 'gallery-grid' layout class to the outer container.
   * The inner div created in render() carries that class; having it on the outer
   * container too turns it into a grid itself, constraining the inner div to a
   * single narrow track and causing single-column display.
   */
  protected initializeContainer(): void {
    this.safeAddClass(this.container, 'gallery-view');
    try { this.container.setAttribute('data-view-type', this._type); } catch (error) { Logger.debug('Ignored error:', error); }
  }

  render(): void {
    if (this._isDestroyed) return;
    // Clear container (use DOM-agnostic helper)
    this.emptyElement(this.container);

    this.gridContainer = this.createElement(this.container, 'div', { cls: 'gallery-grid' });

    // LazyLoader resolves each image's URL (fetching remote images) only once it nears the viewport
    this.loader?.disconnect();
    this.loader = new LazyLoader({
      placeholderSrc: '',
      loadingClass: 'gallery-loading',
      loadedClass: 'gallery-loaded',
      errorClass: 'gallery-error',
      timeoutMs: this.remoteLoadTimeoutMs ?? 10000
    });
    const loader = this.loader;

    const pageImages = this.getPageImages();
    pageImages.forEach((img, idx) => {
      const wrapper = this.createElement(this.gridContainer!, 'div', {
        cls: 'gallery-grid-item',
        attr: {
          'data-image-path': img.path,
          'role': 'button',
          'aria-label': img.displayName || 'Gallery image',
          'tabindex': '0'
        }
      });

      wrapper.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.expandImage(img);
      });
      wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.expandImage(img);
        }
      });

      // Create img element; LazyLoader will set src when observing
      const el = this.createElement(wrapper, 'img', { cls: 'gallery-grid-image', attr: { alt: img.displayName || `Image ${idx + 1}` } }) as HTMLImageElement;

      // External images respect allowRemoteImages; if blocked, mark error state
      if (img.type === 'external' && !this.allowRemoteImages) {
        el.alt = img.displayName || 'External image blocked';
        this.safeAddClass(el, 'gallery-external-blocked');
        // Mark state so getStats / processor can observe
        this.updateImageElement(wrapper, img, 'error');
      } else {
        // Wire up load/error handlers to propagate state to GalleryView
        el.addEventListener('load', () => this.handleImageLoad(img));
        el.addEventListener('error', () => this.handleImageError(img, new Error('Failed to load')));

        loader.observe(el, () => this.resolveImageUrl(img), (error) => this.handleImageError(img, error));
      }

      // Render caption below image
      this.renderCaption(wrapper, img);
    });

    this.renderPaginationControls(this.container);
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
    const imgEl = element.querySelector('img');
    if (!imgEl) return;

    if (image.type === 'external' && !this.allowRemoteImages) {
      // External blocked - remain in error
      this.handleImageError(image, new Error('External images are blocked by settings'));
      return;
    }

    // Use a temporary image to honor timeout
    this.loadWithTimeout(image, (temp) => {
      try { imgEl.src = temp.src; } catch (error) { Logger.debug('Ignored error:', error); }
      this.handleImageLoad(image);
    }, (error) => this.handleImageError(image, error));
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
      const imgs = Array.from(this.gridContainer.querySelectorAll('img'));
      total = imgs.length;
      loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      pending = total - loaded - error;
    }

    return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
  }
}
