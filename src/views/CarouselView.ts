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

    constructor(container: HTMLElement) {
        super('carousel', container);
    }

    render(): void {
        if (this._isDestroyed) return;

        // Clear container
        this.container.empty();

        // Root carousel element
        this.containerEl = this.container.createEl('div', { cls: 'gallery-carousel' });

        // Viewport and track
        this.viewport = this.containerEl.createEl('div', { cls: 'gallery-carousel-viewport' });
        this.trackEl = this.viewport.createEl('div', { cls: 'gallery-carousel-container' });

        // Render items
        this._images.forEach((img) => {
            const item = this.trackEl!.createEl('div', { cls: 'gallery-carousel-item' });
            const el = item.createEl('img', { cls: 'gallery-carousel-image', attr: { src: img.getDisplayUrl(), alt: img.displayName } });
            // mark initial load state
            el.addEventListener('load', () => this.handleImageLoad(img));
            el.addEventListener('error', () => this.handleImageError(img, new Error('Failed to load')));
        });

        // Prev/Next controls (visual)
        const prev = this.containerEl.createEl('button', { cls: 'gallery-carousel-nav prev', text: '‹' });
        const next = this.containerEl.createEl('button', { cls: 'gallery-carousel-nav next', text: '›' });
        prev.setAttribute('aria-label', 'Previous image');
        next.setAttribute('aria-label', 'Next image');

        prev.addEventListener('click', () => this.prev());
        next.addEventListener('click', () => this.next());

        // Indicators
        const indicators = this.containerEl.createEl('div', { cls: 'gallery-carousel-indicators' });
        this._images.forEach((_, idx) => {
            const dot = indicators.createEl('button', { cls: 'gallery-carousel-indicator' });
            dot.setAttribute('aria-label', `Go to image ${idx + 1}`);
            dot.addEventListener('click', () => this.goTo(idx));
            if (idx === this.currentIndex) dot.addClass('active');
        });

        // Keyboard support
        this.containerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Make container focusable for keyboard
        this.containerEl.setAttribute('tabindex', '0');

        // Touch support - basic swipe
        this.addTouchSupport(this.viewport!);
    }

    update(images: IImageSource[]): void {
        super.update(images);
        // Re-render to reflect new images
        this.render();
    }

    destroy(): void {
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
        const width = this.viewport.clientWidth;
        (this.trackEl.style as any).transform = `translateX(-${index * width}px)`;

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
     * Get view statistics for initial render detection
     */
    getStats(): { totalImages: number; loadedImages: number; pendingImages: number; errorImages: number } {
        let total = this._images.length;
        let loaded = this._images.filter(img => img.loadState === 'loaded').length;
        let error = this._images.filter(img => img.loadState === 'error').length;
        let pending = total - loaded - error;

        // Fallback: if model doesn't report states yet, infer from DOM
        if (total === 0 && this.trackEl) {
            const imgs = Array.from(this.trackEl.querySelectorAll('img')) as HTMLImageElement[];
            total = imgs.length;
            loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
            error = imgs.filter(i => i.complete && i.naturalWidth === 0).length;
            pending = total - loaded - error;
        }

        return { totalImages: total, loadedImages: loaded, pendingImages: pending, errorImages: error };
    }
}
