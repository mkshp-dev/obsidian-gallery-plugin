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
    private lastFocusedElement: HTMLElement | null = null;
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
        this.viewport = this.createElement(this.containerEl!, 'div', { cls: 'gallery-carousel-viewport' });
        this.trackEl = this.createElement(this.viewport, 'div', { cls: 'gallery-carousel-container' });

        // Render items
        this._images.forEach((img) => {
            const item = this.createElement(this.trackEl!, 'div', { cls: 'gallery-carousel-item', attr: { 'data-image-path': img.path } });
            const el = this.createElement(item, 'img', { cls: 'gallery-carousel-image', attr: { alt: img.displayName } });

            // Defer actual loading to view-level logic so we can honor
            // `allowRemoteImages` and `remoteLoadTimeoutMs` settings.
            this.loadImageElement(el as HTMLImageElement, img);

            // Click to expand
            item.addEventListener('click', () => this.expandImage(img));
        });
        // Prev/Next controls (visual)
        const prev = this.createElement(this.containerEl!, 'button', { cls: 'gallery-carousel-nav prev', text: '‹' });
        const next = this.createElement(this.containerEl!, 'button', { cls: 'gallery-carousel-nav next', text: '›' });
        prev.setAttribute('aria-label', 'Previous image');
        next.setAttribute('aria-label', 'Next image');

        prev.addEventListener('click', () => this.prev());
        next.addEventListener('click', () => this.next());

        // Indicators
        const indicators = this.createElement(this.containerEl!, 'div', { cls: 'gallery-carousel-indicators' });
        this._images.forEach((_, idx) => {
            const dot = this.createElement(indicators, 'button', { cls: 'gallery-carousel-indicator' });
            dot.setAttribute('aria-label', `Go to image ${idx + 1}`);
            dot.addEventListener('click', () => this.goTo(idx));
            // dot may have addClass shim from createElement — only add if non-empty
            if (idx === this.currentIndex) {
                (dot as any).addClass?.('active');
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
        if (image.type !== 'external') {
            try {
                imgEl.src = image.getDisplayUrl();
            } catch (e) {
                this.handleImageError(image, e as Error);
            }
            // Attach load/error handlers to update state
            imgEl.addEventListener('load', () => this.handleImageLoad(image));
            imgEl.addEventListener('error', () => this.handleImageError(image, new Error('Failed to load')));
            return;
        }

        // External images: use a temporary Image to implement timeout and
        // avoid attaching src directly until successfully loaded.
        const temp = new Image();
        let timeoutHandle: any = null;

        const onLoad = () => {
            clearTimeout(timeoutHandle);
            try {
                imgEl.src = temp.src;
            } catch {}
            this.handleImageLoad(image);
            cleanup();
        };

        const onError = (err?: Error) => {
            clearTimeout(timeoutHandle);
            this.handleImageError(image, err || new Error('Failed to load'));
            cleanup();
        };

        const cleanup = () => {
            temp.onload = null;
            temp.onerror = null;
        };

        temp.onload = onLoad;
        temp.onerror = () => onError(new Error('Failed to load'));

        // Timeout
        timeoutHandle = setTimeout(() => {
            onError(new Error('Image loading timed out'));
        }, this.remoteLoadTimeoutMs ?? 10000);

        // Start loading
        try {
            temp.src = image.getDisplayUrl();
        } catch (e) {
            onError(e as Error);
        }
    }

    /**
     * Expand image into a modal/lightbox. Similar behavior to ThumbnailView.
     */
    public expandImage(image: IImageSource): void {
        const active = document.activeElement;
        if (active && active instanceof HTMLElement) {
            this.lastFocusedElement = active;
        }

        const doc = this.container.ownerDocument || document;
        const modal = doc.createElement('div');
        modal.className = 'gallery-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', image.displayName || 'Image dialog');

        modal.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) this.closeModal(modal);
        });

        let currentImage = image;

        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                doc.removeEventListener('keydown', closeOnEscape as any);
                doc.removeEventListener('focus', keepFocus as any, true);
                doc.removeEventListener('keydown', modalKeyHandler as any);
            }
        };
        modal.addEventListener('keydown', closeOnEscape as any);

        const keepFocus = (e: Event) => {
            if (!modal.contains(doc.activeElement)) {
                const btn = modal.querySelector('.gallery-modal-close') as HTMLElement | null;
                if (btn) btn.focus();
            }
        };
        doc.addEventListener('focus', keepFocus as any, true);

        const modalKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const currentIndex = this._images.findIndex((img: IImageSource) => img.path === currentImage.path);
                if (currentIndex === -1) return;
                const nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
                if (nextIndex >= 0 && nextIndex < this._images.length) {
                    const nextImage = this._images[nextIndex];
                    const imgEl = modal.querySelector('.gallery-modal-image img') as HTMLImageElement | null;
                    const titleEl = modal.querySelector('.gallery-modal-info h3') as HTMLElement | null;
                    if (imgEl && nextImage) {
                        // load via temp to respect timeout
                        const temp = new Image();
                        const timeout = setTimeout(() => { temp.onload = null; temp.onerror = null; imgEl.alt = 'Failed to load'; }, this.remoteLoadTimeoutMs ?? 10000);
                        temp.onload = () => { clearTimeout(timeout); try { imgEl.src = temp.src; } catch {} };
                        temp.onerror = () => { clearTimeout(timeout); imgEl.alt = 'Failed to load'; };
                        try { temp.src = nextImage.getDisplayUrl(); } catch { imgEl.alt = 'Failed to load'; }
                    }
                    if (titleEl && nextImage) titleEl.textContent = nextImage.displayName || '';
                    currentImage = nextImage;
                }
            }
        };
        modal.addEventListener('keydown', modalKeyHandler as any);

        (modal as any).__cleanup = () => {
            try {
                modal.removeEventListener('keydown', closeOnEscape as any);
                doc.removeEventListener('focus', keepFocus as any, true);
                modal.removeEventListener('keydown', modalKeyHandler as any);
            } catch {}
        };

    const content = this.createElement(modal, 'div', { cls: 'gallery-modal-content' });
    const closeBtn = this.createElement(content, 'button', { cls: 'gallery-modal-close', text: '×' });
    closeBtn.addEventListener('click', () => this.closeModal(modal));
    closeBtn.setAttribute('aria-label', 'Close image dialog');
    closeBtn.setAttribute('role', 'button');

        modal.setAttribute('tabindex', '-1');
        setTimeout(() => { try { modal.focus(); } catch {} try { closeBtn.focus(); } catch {} }, 0);

        const prevBtn = this.createElement(content, 'button', { cls: 'gallery-modal-nav prev', text: '\u2039' }) as HTMLElement;
        prevBtn.setAttribute('aria-label', 'Previous image'); prevBtn.addEventListener('click', () => navigate(-1));
        const nextBtn = this.createElement(content, 'button', { cls: 'gallery-modal-nav next', text: '\u203A' }) as HTMLElement;
        nextBtn.setAttribute('aria-label', 'Next image'); nextBtn.addEventListener('click', () => navigate(1));

    const info = this.createElement(content, 'div', { cls: 'gallery-modal-info' });
    this.createElement(info, 'h3', { text: image.displayName });
    const imgContainer = this.createElement(content, 'div', { cls: 'gallery-modal-image' });
    const img = this.createElement(imgContainer, 'img', { attr: { alt: image.displayName } });

        // load respecting allowRemoteImages and timeout
        const loadModalImage = (imgEl: HTMLImageElement, srcImage: IImageSource) => {
            if (srcImage.type === 'external' && !this.allowRemoteImages) {
                imgEl.alt = 'External image blocked';
                imgEl.classList.add('gallery-external-blocked');
                return;
            }
            const temp = new Image();
            let timeoutHandle: any = null;
            const onLoad = () => { clearTimeout(timeoutHandle); try { imgEl.src = temp.src; } catch {} cleanup(); };
            const onError = () => { clearTimeout(timeoutHandle); imgEl.alt = 'Failed to load'; cleanup(); };
            const cleanup = () => { temp.onload = null; temp.onerror = null; };
            temp.onload = onLoad; temp.onerror = onError;
            timeoutHandle = setTimeout(() => onError(), this.remoteLoadTimeoutMs ?? 10000);
            try { temp.src = srcImage.getDisplayUrl(); } catch (e) { onError(); }
        };

        loadModalImage(img as HTMLImageElement, image);

        const navigate = (delta: number) => {
            const currentIndex = this._images.findIndex((imgSrc: IImageSource) => imgSrc.path === currentImage.path);
            if (currentIndex === -1) return;
            const nextIndex = currentIndex + delta;
            if (nextIndex < 0 || nextIndex >= this._images.length) return;
            const nextImage = this._images[nextIndex];
            const modalImg = modal.querySelector('.gallery-modal-image img') as HTMLImageElement | null;
            const titleEl = modal.querySelector('.gallery-modal-info h3') as HTMLElement | null;
            if (modalImg && nextImage) { loadModalImage(modalImg, nextImage); modalImg.alt = nextImage.displayName || ''; }
            if (titleEl && nextImage) titleEl.textContent = nextImage.displayName || '';
            currentImage = nextImage;
        };

        try { doc.body.appendChild(modal); } catch (appendErr) { try { document.body.appendChild(modal); } catch {} }
    }

    /**
     * Close modal and cleanup focus.
     */
    private closeModal(modal: HTMLElement): void {
        try {
            // add class if shim exists
            if ((modal as any).addClass && typeof (modal as any).addClass === 'function') {
                (modal as any).addClass('gallery-modal-closing');
            } else {
                modal.classList.add('gallery-modal-closing');
            }
        } catch {}

        try {
            const cleanup = (modal as any).__cleanup;
            if (cleanup && typeof cleanup === 'function') cleanup();
        } catch {}

        setTimeout(() => {
            try { modal.remove(); } catch {}
            if (this.lastFocusedElement) {
                try { this.lastFocusedElement.focus(); } catch {}
                this.lastFocusedElement = null;
            }
        }, 200);
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
