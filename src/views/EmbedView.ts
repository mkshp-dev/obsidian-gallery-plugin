import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';
import { LazyLoader } from '../utils/LazyLoader';

/**
 * EmbedView
 * Renders images as a continuous vertical stack, full note width, with no
 * card chrome (no border/background/shadow) — mimicking Obsidian's native
 * ![[image]] embed so the gallery feels like part of the note rather than
 * a distinct widget.
 */
export class EmbedView extends GalleryView {
  private embedContainer: HTMLElement | null = null;
  private loader: LazyLoader | null = null;

  constructor(container: HTMLElement) {
    super('embed', container);
  }

  setOptions(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean; showCaptions?: boolean; captionMaxLines?: number } = {}): void {
    super.setOptions(options);
    if (this.loader && typeof options.remoteLoadTimeoutMs === 'number') {
      this.loader.updateOptions({ timeoutMs: options.remoteLoadTimeoutMs });
    }
  }

  render(): void {
    if (this._isDestroyed) return;
    this.emptyElement(this.container);

    this.embedContainer = this.createElement(this.container, 'div', { cls: 'gallery-embed-list' });

    this._images.forEach((img, idx) => {
      const wrapper = this.createElement(this.embedContainer!, 'figure', {
        cls: 'gallery-embed-item',
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

      const el = this.createElement(wrapper, 'img', { cls: 'gallery-embed-image', attr: { alt: img.displayName || `Image ${idx + 1}` } }) as HTMLImageElement;

      if (img.type === 'external' && !this.allowRemoteImages) {
        el.alt = img.displayName || 'External image blocked';
        this.safeAddClass(el, 'gallery-external-blocked');
        this.updateImageElement(wrapper, img, 'error');
      } else {
        try { el.dataset.src = img.getDisplayUrl(); } catch { el.setAttribute('data-src', img.getDisplayUrl()); }

        el.addEventListener('load', () => this.handleImageLoad(img));
        el.addEventListener('error', () => this.handleImageError(img, new Error('Failed to load')));
      }

      this.renderCaption(wrapper, img);
    });

    this.loader?.disconnect();
    this.loader = new LazyLoader({
      placeholderSrc: '',
      loadingClass: 'gallery-loading',
      loadedClass: 'gallery-loaded',
      errorClass: 'gallery-error',
      timeoutMs: this.remoteLoadTimeoutMs ?? 10000
    });

    const imgs = Array.from(this.embedContainer.querySelectorAll('img'));
    imgs.forEach((imgEl) => {
      const src = (imgEl.dataset && (imgEl.dataset.src || imgEl.getAttribute('data-src'))) || (imgEl.getAttribute('src') || '');
      if (src) this.loader!.observe(imgEl, src);
    });
  }

  update(images: IImageSource[]): void {
    super.update(images);
  }

  destroy(): void {
    this.loader?.disconnect();
    this.loader = null;
    this.embedContainer = null;
    super.destroy();
  }

  protected reloadImage(element: HTMLElement, image: IImageSource): void {
    const imgEl = element.querySelector('img');
    if (!imgEl) return;

    if (image.type === 'external' && !this.allowRemoteImages) {
      this.handleImageError(image, new Error('External images are blocked by settings'));
      return;
    }

    const temp = new Image();
    let timeoutHandle: number | undefined = undefined;

    const onLoad = () => {
      window.clearTimeout(timeoutHandle);
      try { imgEl.src = temp.src; } catch (error) { Logger.debug('Ignored error:', error); }
      this.handleImageLoad(image);
      cleanup();
    };

    const onError = (err?: Error) => {
      window.clearTimeout(timeoutHandle);
      this.handleImageError(image, err || new Error('Failed to load'));
      cleanup();
    };

    const cleanup = () => { temp.onload = null; temp.onerror = null; };

    temp.onload = onLoad;
    temp.onerror = () => onError(new Error('Failed to load'));

    timeoutHandle = window.setTimeout(() => onError(new Error('Image loading timed out')), this.remoteLoadTimeoutMs ?? 10000);
    try { temp.src = image.getDisplayUrl(); } catch (e) { onError(e as Error); }
  }

  getStats(): { totalImages: number; loadedImages: number; pendingImages: number; errorImages: number } {
    let total = this._images.length;
    let loaded = this._images.filter(img => img.loadState === 'loaded').length;
    let error = this._images.filter(img => img.loadState === 'error').length;
    let pending = total - loaded - error;

    if (total === 0 && this.embedContainer) {
      const imgs = Array.from(this.embedContainer.querySelectorAll('img'));
      total = imgs.length;
      loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      pending = total - loaded - error;
    }

    return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
  }
}
