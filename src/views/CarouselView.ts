import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';

/**
 * CarouselView
 * One image at a time on a fixed-height stage, with arrow buttons, keyboard and swipe navigation,
 * a "3 / 12" counter, and dots for short galleries.
 *
 * Tunable from CSS: --gallery-carousel-height (the stage height), or per gallery with `height`.
 */
export class CarouselView extends GalleryView {
    /** Above this many images, the dots are left out and the counter alone shows the position */
    private static readonly MAX_DOTS = 12;

    private viewport: HTMLElement | null = null;
    private containerEl: HTMLElement | null = null;
    private currentIndex = 0;
    private trackEl: HTMLElement | null = null;
    private prevBtn: HTMLButtonElement | null = null;
    private nextBtn: HTMLButtonElement | null = null;
    private counterEl: HTMLElement | null = null;
    private dots: HTMLElement[] = [];
    /** Slide image elements in render order; loaded on demand around the current slide */
    private slides: Array<{ imgEl: HTMLImageElement; image: IImageSource; requested: boolean }> = [];

    // Runtime options inherited from GalleryView (remoteLoadTimeoutMs, allowRemoteImages)

    constructor(container: HTMLElement) {
        super('carousel', container);
    }

    render(): void {
        if (this._isDestroyed) return;

        // Clear container
        this.emptyElement(this.container);

        // Root carousel element
        this.containerEl = this.createElement(this.container, 'div', { cls: 'gallery-carousel' });

        // Viewport and track
        this.viewport = this.createElement(this.containerEl, 'div', { cls: 'gallery-carousel-viewport' });
        this.trackEl = this.createElement(this.viewport, 'div', { cls: 'gallery-carousel-container' });

        // Render items
        this.slides = [];
        if (this.currentIndex >= this._images.length) this.currentIndex = 0;
        this._images.forEach((img) => {
            const item = this.createElement(this.trackEl!, 'div', { cls: 'gallery-carousel-item', attr: { 'data-image-path': img.path } });
            // The frame hugs the image, so a hover caption sits on the image rather than the slide
            const frame = this.createElement(item, 'div', { cls: 'gallery-media-frame' });
            const el = this.createElement(frame, 'img', { cls: 'gallery-carousel-image', attr: { alt: img.displayName } });

            // Loaded on demand (see loadAround) so only slides near the current one are fetched
            this.slides.push({ imgEl: el as HTMLImageElement, image: img, requested: false });

            const caption = this.renderCaption(item, img, frame);
            // Lets CSS leave room under the image without a :has() selector
            if (caption?.classList.contains('is-below')) item.classList.add('has-caption-below');

            // Click to expand
            item.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.expandImage(img);
            });
        });
        const count = this._images.length;
        if (typeof this.layoutOptions.height === 'number') {
            this.containerEl.style.setProperty('--gallery-carousel-height', `${this.layoutOptions.height}px`);
        }

        // Arrows and counter sit on the stage; none of the controls are needed for a single image
        this.prevBtn = null;
        this.nextBtn = null;
        this.counterEl = null;
        this.dots = [];
        if (count > 1) {
            this.prevBtn = this.createElement(this.viewport, 'button', { cls: 'gallery-carousel-nav prev', attr: { 'aria-label': 'Previous image' } }) as HTMLButtonElement;
            this.nextBtn = this.createElement(this.viewport, 'button', { cls: 'gallery-carousel-nav next', attr: { 'aria-label': 'Next image' } }) as HTMLButtonElement;
            this.prevBtn.addEventListener('click', (e: MouseEvent) => { e.stopPropagation(); this.prev(); });
            this.nextBtn.addEventListener('click', (e: MouseEvent) => { e.stopPropagation(); this.next(); });

            this.counterEl = this.createElement(this.viewport, 'div', { cls: 'gallery-carousel-counter', attr: { 'aria-live': 'polite' } });

            if (count <= CarouselView.MAX_DOTS) {
                const indicators = this.createElement(this.containerEl, 'div', { cls: 'gallery-carousel-indicators' });
                this._images.forEach((_, idx) => {
                    const dot = this.createElement(indicators, 'button', {
                        cls: 'gallery-carousel-indicator',
                        attr: { 'aria-label': `Go to image ${idx + 1}` }
                    });
                    dot.addEventListener('click', () => this.goTo(idx));
                    this.dots.push(dot);
                });
            }
        }

        // Keyboard support
        this.containerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Make container focusable for keyboard
        this.containerEl.setAttribute('tabindex', '0');

        // Touch support - basic swipe
        this.addTouchSupport(this.viewport);

        this.goTo(this.currentIndex);
        this.renderWarnings(this.container);
    }

    update(images: IImageSource[]): void {
        // The base update re-renders
        super.update(images);
    }

    destroy(): void {
        this.slides = [];
        this.trackEl = null;
        this.viewport = null;
        this.containerEl = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.counterEl = null;
        this.dots = [];
        super.destroy();
    }

    private prev(): void {
        this.goTo(Math.max(0, this.currentIndex - 1));
    }

    private next(): void {
        this.goTo(Math.min(this._images.length - 1, this.currentIndex + 1));
    }

    private goTo(index: number): void {
        if (!this.trackEl || !this.viewport) return;
        if (index < 0 || index >= this._images.length) return;

        this.currentIndex = index;
        this.loadAround(index);
        // A percentage keeps the slide aligned when the pane is resized
        this.trackEl.style.transform = `translateX(-${index * 100}%)`;

        const count = this._images.length;
        if (this.prevBtn) this.prevBtn.disabled = index === 0;
        if (this.nextBtn) this.nextBtn.disabled = index === count - 1;
        if (this.counterEl) this.counterEl.textContent = `${index + 1} / ${count}`;
        this.dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === index);
            if (idx === index) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
        });
    }

    private addTouchSupport(el: HTMLElement) {
        let startX = 0;
        let moved = 0;

        const onStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            moved = 0;
        };

        const onMove = (e: TouchEvent) => {
            moved = e.touches[0].clientX - startX;
        };

        const onEnd = () => {
            if (Math.abs(moved) > 30) {
                if (moved < 0) this.next(); else this.prev();
            }
            startX = 0;
            moved = 0;
        };

        el.addEventListener('touchstart', onStart);
        el.addEventListener('touchmove', onMove);
        el.addEventListener('touchend', onEnd);
    }

    /**
     * Load the slide at `index` and its neighbours, so the next slide is ready before it is shown
     */
    private loadAround(index: number): void {
        for (const i of [index, index + 1, index - 1]) {
            const slide = this.slides[i];
            if (slide && !slide.requested) {
                slide.requested = true;
                this.loadImageElement(slide.imgEl, slide.image);
            }
        }
    }

    /**
     * Load an image into an existing img element respecting remote settings
     */
    private loadImageElement(imgEl: HTMLImageElement, image: IImageSource) {
        // If external images are disabled, leave placeholder and mark as blocked
        if (image.type === 'external' && !this.allowRemoteImages) {
            imgEl.alt = image.displayName || 'External image blocked';
            imgEl.classList.add('gallery-external-blocked');
            // Update element state so processor can pick it up
            this.updateImageElement(imgEl.parentElement as HTMLElement, image, 'error');
            return;
        }

        // For local images we can set src directly
        if (image.type === 'local') {
            // Attach load/error handlers to update state
            imgEl.addEventListener('load', () => this.handleImageLoad(image));
            imgEl.addEventListener('error', () => this.handleImageError(image, new Error('Failed to load')));
            this.resolveImageUrl(image)
                .then(url => { imgEl.src = url; })
                .catch((e: unknown) => this.handleImageError(image, e instanceof Error ? e : new Error(String(e))));
            return;
        }

        // Remote images (fetched on demand or loaded from a URL): load through a temporary Image
        // to implement the timeout, and only attach the src once it has loaded.
        this.loadWithTimeout(image, (temp) => {
            try {
                imgEl.src = temp.src;
            } catch (error) { Logger.debug('Ignored error:', error); }
            this.handleImageLoad(image);
        }, (error) => this.handleImageError(image, error));
    }

    /**
     * Get view statistics for initial render detection
     */
    getStats(): { totalImages: number; loadedImages: number; pendingImages: number; errorImages: number } {
        let total = this._images.length;
        let loaded = this._images.filter(img => img.loadState === 'loaded').length;
        let error = this._images.filter(img => img.loadState === 'error').length;
        let pending = total - loaded - error;

        // Fallback: if model doesn't report states yet, infer from DOM
        if (total === 0 && this.trackEl) {
            const imgs = Array.from(this.trackEl.querySelectorAll('img'));
            total = imgs.length;
            loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
            error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
            pending = total - loaded - error;
        }

        return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
    }
}
