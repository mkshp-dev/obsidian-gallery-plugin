import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';
import { LazyLoader } from '../utils/LazyLoader';
import type { ViewType } from '../models/viewTypes';

/** A rendered tile and the aspect ratio (width / height) the layout places it with */
export interface LayoutTile {
  image: IImageSource;
  el: HTMLElement;
  ratio: number;
}

/**
 * Base for views that place tiles by each image's aspect ratio (masonry, justified).
 *
 * A tile's ratio comes from the image's metadata when its source provides it (Immich), from the
 * loaded image once it has loaded, and from DEFAULT_RATIO until then. The subclass layout runs
 * when the width changes or a loaded image turns out to have a different ratio. Layouts place
 * tiles greedily in image order, so a corrected ratio only moves the tiles after it.
 *
 * Tiles are created once per render and moved between columns/rows by the layout, so a relayout
 * never reloads an image.
 */
export abstract class AspectLayoutView extends GalleryView {
  /** Ratio assumed for an image whose size is not known yet (a typical landscape photo) */
  protected static readonly DEFAULT_RATIO = 3 / 2;
  /** Ratios differing by less than this fraction do not trigger a relayout */
  private static readonly RATIO_TOLERANCE = 0.01;

  /** Class of the layout root, e.g. `gallery-masonry-layout`; tiles get `gallery-tile` plus a view class */
  protected abstract readonly layoutClass: string;
  protected abstract readonly tileClass: string;

  protected root: HTMLElement | null = null;
  protected tiles: LayoutTile[] = [];
  private loader: LazyLoader | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private layoutFrame: number | null = null;
  /** Whether the scheduled layout must run even if the width is unchanged */
  private pendingForce = false;
  private lastWidth = -1;
  /** Ratios measured from loaded images, kept across re-renders (page changes, option changes) */
  private readonly measuredRatios = new WeakMap<IImageSource, number>();

  constructor(type: ViewType, container: HTMLElement) {
    super(type, container);
  }

  /** Place `this.tiles` into the root for the given content width (in px, 0 when not measurable) */
  protected abstract layout(width: number): void;

  render(): void {
    if (this._isDestroyed) return;
    this.teardownLayout();
    this.emptyElement(this.container);

    const root = this.createElement(this.container, 'div', { cls: this.layoutClass });
    this.root = root;

    // LazyLoader resolves each image's URL (fetching remote images) only once it nears the viewport
    this.loader = new LazyLoader({
      placeholderSrc: '',
      loadingClass: 'gallery-loading',
      loadedClass: 'gallery-loaded',
      errorClass: 'gallery-error',
      timeoutMs: this.remoteLoadTimeoutMs ?? 10000
    });

    this.tiles = this.getPageImages().map((image, idx) => this.createTile(root, image, idx));

    this.lastWidth = -1;
    this.runLayout(true);
    this.observeResize(root);

    this.renderPaginationControls(this.container);
  }

  setOptions(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean; showCaptions?: boolean; captionMaxLines?: number; pagination?: boolean; itemsPerPage?: number } = {}): void {
    super.setOptions(options);
    if (this.loader && typeof options.remoteLoadTimeoutMs === 'number') {
      this.loader.updateOptions({ timeoutMs: options.remoteLoadTimeoutMs });
    }
  }

  destroy(): void {
    this.teardownLayout();
    this.root = null;
    this.tiles = [];
    super.destroy();
  }

  private teardownLayout(): void {
    this.loader?.disconnect();
    this.loader = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.layoutFrame !== null) {
      window.cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = null;
    }
  }

  private createTile(root: HTMLElement, image: IImageSource, idx: number): LayoutTile {
    const el = this.createElement(root, 'div', {
      cls: `gallery-tile ${this.tileClass}`,
      attr: {
        'data-image-path': image.path,
        'role': 'button',
        'aria-label': image.displayName || 'Gallery image',
        'tabindex': '0'
      }
    });
    const tile: LayoutTile = { image, el, ratio: this.knownRatio(image) };
    this.applyRatio(tile);

    el.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.expandImage(image);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.expandImage(image);
      }
    });

    // Create img element; LazyLoader will set src when observing
    const imgEl = this.createElement(el, 'img', { cls: 'gallery-tile-image', attr: { alt: image.displayName || `Image ${idx + 1}` } }) as HTMLImageElement;

    // External images respect allowRemoteImages; if blocked, mark error state
    if (image.type === 'external' && !this.allowRemoteImages) {
      imgEl.alt = image.displayName || 'External image blocked';
      this.safeAddClass(imgEl, 'gallery-external-blocked');
      this.updateImageElement(el, image, 'error');
    } else {
      imgEl.addEventListener('load', () => {
        this.updateRatioFromImage(tile, imgEl);
        this.handleImageLoad(image);
      });
      imgEl.addEventListener('error', () => this.handleImageError(image, new Error('Failed to load')));

      this.loader?.observe(imgEl, () => this.resolveImageUrl(image), (error) => this.handleImageError(image, error));
    }

    this.renderCaption(el, image);
    return tile;
  }

  private knownRatio(image: IImageSource): number {
    const measured = this.measuredRatios.get(image);
    if (measured) return measured;
    const dims = image.dimensions;
    if (dims && dims.width > 0 && dims.height > 0) return dims.width / dims.height;
    return AspectLayoutView.DEFAULT_RATIO;
  }

  /** Expose the ratio to CSS, which sizes the image box before (and after) it loads */
  private applyRatio(tile: LayoutTile): void {
    tile.el.style.setProperty('--gallery-tile-ratio', String(tile.ratio));
  }

  private updateRatioFromImage(tile: LayoutTile, imgEl: HTMLImageElement): void {
    if (!(imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0)) return;
    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
    this.measuredRatios.set(tile.image, ratio);
    if (Math.abs(ratio - tile.ratio) / tile.ratio < AspectLayoutView.RATIO_TOLERANCE) return;

    tile.ratio = ratio;
    this.applyRatio(tile);
    this.scheduleLayout(true);
  }

  private observeResize(root: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    // Height changes (including those the layout itself causes) are ignored: runLayout skips
    // unless the width changed.
    this.resizeObserver = new ResizeObserver(() => this.scheduleLayout(false));
    this.resizeObserver.observe(root);
  }

  /** Coalesce layout requests into one per frame. `force` relayouts even if the width is unchanged. */
  protected scheduleLayout(force: boolean): void {
    this.pendingForce = this.pendingForce || force;
    if (this.layoutFrame !== null) return;
    this.layoutFrame = window.requestAnimationFrame(() => {
      this.layoutFrame = null;
      const forceNow = this.pendingForce;
      this.pendingForce = false;
      this.runLayout(forceNow);
    });
  }

  private runLayout(force: boolean): void {
    if (this._isDestroyed || !this.root) return;
    const width = this.contentWidth(this.root);
    if (!force && width === this.lastWidth) return;
    this.lastWidth = width;
    try {
      this.layout(width);
    } catch (error) {
      Logger.error('Gallery layout failed:', error);
    }
  }

  /** Width available to tiles: the root's width without its padding */
  private contentWidth(root: HTMLElement): number {
    const style = getComputedStyle(root);
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    return Math.max(0, root.clientWidth - padding);
  }

  /** A numeric CSS custom property (in px) on the layout root, so themes and snippets can tune it */
  protected readCssNumber(name: string, fallback: number): number {
    if (!this.root) return fallback;
    const value = parseFloat(getComputedStyle(this.root).getPropertyValue(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  /** Grow or shrink the root's column/row elements in `existing` to `count`, reusing the ones already there */
  protected syncContainers(existing: HTMLElement[], count: number, cls: string): HTMLElement[] {
    const root = this.root!;
    while (existing.length < count) existing.push(this.createElement(root, 'div', { cls }));
    while (existing.length > count) existing.pop()!.remove();
    return existing;
  }

  /**
   * Make `parent`'s children exactly `tiles`, in order, touching the DOM only when they differ.
   * Moving a tile that has focus would drop the focus, so unchanged columns/rows are left alone.
   */
  protected syncChildren(parent: HTMLElement, tiles: LayoutTile[]): void {
    const current = parent.children;
    const same = current.length === tiles.length && tiles.every((tile, i) => current[i] === tile.el);
    if (!same) parent.replaceChildren(...tiles.map(tile => tile.el));
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
    if (total === 0 && this.root) {
      const imgs = Array.from(this.root.querySelectorAll('img'));
      total = imgs.length;
      loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
      pending = total - loaded - error;
    }

    return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
  }
}
