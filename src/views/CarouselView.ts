import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';

/**
 * CarouselView
 * Horizontal scrolling carousel with keyboard and mouse controls.
 */
export class CarouselView extends GalleryView {
    private viewport: HTMLElement | null = null;
    private containerEl: HTMLElement | null = null;
    private currentIndex = 0;
    private trackEl: HTMLElement | null = null;
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

            this.renderCaption(item, img, frame);

            // Click to expand
            item.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.expandImage(img);
            });
        });
        // Prev/Next controls (visual)
        const prev = this.createElement(this.containerEl, 'button', { cls: 'gallery-carousel-nav prev', text: '‹' });
        const next = this.createElement(this.containerEl, 'button', { cls: 'gallery-carousel-nav next', text: '›' });
        prev.setAttribute('aria-label', 'Previous image');
        next.setAttribute('aria-label', 'Next image');

        prev.addEventListener('click', () => this.prev());
        next.addEventListener('click', () => this.next());

        // Indicators
        const indicators = this.createElement(this.containerEl, 'div', { cls: 'gallery-carousel-indicators' });
        this._images.forEach((_, idx) => {
            const dot = this.createElement(indicators, 'button', { cls: 'gallery-carousel-indicator' });
            dot.setAttribute('aria-label', `Go to image ${idx + 1}`);
            dot.addEventListener('click', () => this.goTo(idx));
            // dot may have addClass shim from createElement — only add if non-empty
            if (idx === this.currentIndex) {
                const obsDot = dot as unknown as { addClass?(cls: string): void };
            if (obsDot.addClass) {
                obsDot.addClass('active');
            }
            }
        });

        // Keyboard support
        this.containerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Make container focusable for keyboard
        this.containerEl.setAttribute('tabindex', '0');

        // Touch support - basic swipe
        this.addTouchSupport(this.viewport);

        this.loadAround(this.currentIndex);
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
        const width = this.viewport.clientWidth;
        if (this.trackEl) { this.trackEl.style.transform = `translateX(-${index * width}px)`; }

        // Update indicators
        const indicators = this.containerEl?.querySelectorAll('.gallery-carousel-indicator') || [];
        indicators.forEach((node, idx) => {
            node.classList.toggle('active', idx === index);
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
