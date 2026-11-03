import { Logger } from "../utils/Logger";
import { IGalleryView, IImageSource, IImageMetadata, ObsidianDOMExtensions, CreateElementOptions, ViewRuntimeOptions } from '../models/interfaces';
import { setIcon } from 'obsidian';
import { ErrorPlaceholder } from './components/ErrorPlaceholder';
import { formatDuration } from '../models/media';
import type { ViewType } from '../models/viewTypes';

/**
 * Zoom factor for one wheel event in the image viewer: 1.25x per 100px of scroll (one mouse-wheel
 * notch), less for the small deltas touchpads send. Line and page deltas are converted to pixels,
 * and one event never zooms more than a notch.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number = 0): number {
    const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;
    const clamped = Math.max(-100, Math.min(100, px));
    return Math.pow(1.25, -clamped / 100);
}

/** Slideshow seconds per image from the setting: 1-60, the default (4) when it isn't a number */
export function slideshowSeconds(value: unknown): number {
    const seconds = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return 4;
    return Math.min(60, Math.max(1, seconds));
}

/** "14 Jul 2024, 18:32" in the reader's locale; undefined for a missing or invalid date */
export function formatTakenAt(date: Date | undefined): string | undefined {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
    try {
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return date.toLocaleString();
    }
}

/**
 * Abstract base class for gallery view renderers
 * Provides common functionality for all view types
 */
export abstract class GalleryView implements IGalleryView {
    public readonly container: HTMLElement;
    protected _images: IImageSource[] = [];
    protected _type: ViewType;
    protected _isDestroyed: boolean = false;
    protected _observers: IntersectionObserver[] = [];
    // Runtime options (common)
    public remoteLoadTimeoutMs: number = 10000;
    public allowRemoteImages: boolean = false;
    public showCaptions: boolean = true;
    public captionMaxLines: number = 1;
    public paginationEnabled: boolean = false;
    public itemsPerPage: number = 24;
    protected currentPage: number = 1;
    /** Per-gallery layout sizes from the block's view: options (px); views that support them apply them */
    protected layoutOptions: { rowHeight?: number; columnWidth?: number; gap?: number; height?: number } = {};
    /** Notes shown under the gallery, such as ignored view options */
    protected warnings: string[] = [];

    protected lastFocusedElement: HTMLElement | null = null;
    protected activeModal: HTMLElement | null = null;
    protected slideshowTimer: number | null = null;
    protected slideshowPlaying: boolean = false;
    /** Seconds the slideshow shows each image */
    public slideshowIntervalSeconds: number = 4;
    /** Largest remote video (MB) the viewer downloads to play; 0 = no limit */
    public maxRemoteVideoMb: number = 200;

    constructor(type: ViewType, container: HTMLElement) {
        this._type = type;
        this.container = container;
        this.initializeContainer();
    }

    /**
     * Get view type identifier
     */
    get type(): ViewType {
        return this._type;
    }

    /**
     * Get current images being displayed
     */
    get images(): IImageSource[] {
        return [...this._images];
    }

    /**
     * Initialize container with view-specific classes
     */
    protected initializeContainer(): void {
        // Be DOM-agnostic: support both Obsidian helper methods and plain DOM elements
        const obsContainer = this.container as unknown as ObsidianDOMExtensions;
        if (obsContainer.addClass && typeof obsContainer.addClass === 'function') {
            obsContainer.addClass('gallery-view');
            obsContainer.addClass(`gallery-${this._type}`);
        } else {
            this.container.classList.add('gallery-view');
            this.container.classList.add(`gallery-${this._type}`);
        }
        this.container.setAttribute('data-view-type', this._type);
    }

    /**
     * DOM-agnostic helpers for subclasses to use when Obsidian helpers are unavailable
     */
    protected emptyElement(el?: HTMLElement): void {
        const target = el || this.container;
        const obsTarget = target as unknown as ObsidianDOMExtensions;
        if (obsTarget.empty && typeof obsTarget.empty === 'function') {
            obsTarget.empty();
            return;
        }
        while (target.firstChild) target.removeChild(target.firstChild);
    }

    protected safeAddClass(el: HTMLElement, ...classes: string[]): void {
        // Filter out empty or falsy tokens to avoid DOMTokenList.add('') errors
        const toAdd = classes.filter(c => typeof c === 'string' && c.trim().length > 0);
        if (toAdd.length === 0) return;

        const obsEl = el as unknown as ObsidianDOMExtensions;
        if (obsEl.addClass && typeof obsEl.addClass === 'function') {
            toAdd.forEach(c => obsEl.addClass?.(c));
        } else {
            el.classList.add(...toAdd);
        }
    }

    protected safeRemoveClass(el: HTMLElement, ...classes: string[]): void {
        // Avoid passing empty tokens to remove
        const toRemove = classes.filter(c => typeof c === 'string' && c.trim().length > 0);
        if (toRemove.length === 0) return;

        const obsEl = el as unknown as ObsidianDOMExtensions;
        if (obsEl.removeClass && typeof obsEl.removeClass === 'function') {
            toRemove.forEach(c => obsEl.removeClass?.(c));
        } else {
            el.classList.remove(...toRemove);
        }
    }

    protected createElement(parent: HTMLElement, tag: string, props?: CreateElementOptions): HTMLElement {
        return parent.createEl(tag as keyof HTMLElementTagNameMap, props as DomElementInfo);
    }

    /**
     * Abstract method for rendering initial gallery
     * Must be implemented by subclasses
     */
    abstract render(): void;

    /**
     * Apply runtime options to the view. Subclasses may override to react immediately.
     */
    setOptions(options: ViewRuntimeOptions = {}): void {
        if (typeof options.remoteLoadTimeoutMs === 'number') this.remoteLoadTimeoutMs = options.remoteLoadTimeoutMs;
        if (typeof options.allowRemoteImages === 'boolean') this.allowRemoteImages = options.allowRemoteImages;
        if (typeof options.showCaptions === 'boolean') this.showCaptions = options.showCaptions;
        if (typeof options.captionMaxLines === 'number') this.captionMaxLines = options.captionMaxLines;
        if (typeof options.slideshowInterval === 'number') this.slideshowIntervalSeconds = slideshowSeconds(options.slideshowInterval);
        if (typeof options.maxRemoteVideoMb === 'number' && options.maxRemoteVideoMb >= 0) this.maxRemoteVideoMb = options.maxRemoteVideoMb;
        if (typeof options.pagination === 'boolean') this.paginationEnabled = options.pagination;
        if (typeof options.itemsPerPage === 'number' && options.itemsPerPage > 0) this.itemsPerPage = Math.floor(options.itemsPerPage);
        // Passed together for each gallery, so a key that is present but undefined clears an earlier value
        if ('rowHeight' in options || 'columnWidth' in options || 'gap' in options || 'height' in options) {
            this.layoutOptions = { rowHeight: options.rowHeight, columnWidth: options.columnWidth, gap: options.gap, height: options.height };
        }
        if (options.warnings) this.warnings = [...options.warnings];
        // The frame belongs to the gallery's container, which the view renders into
        if (typeof options.frame === 'boolean') this.container.classList.toggle('gallery-frameless', !options.frame);
    }

    /**
     * Render the gallery's warnings (e.g. ignored view options) as muted lines. Views call this at
     * the end of render(), since rendering clears the container.
     */
    protected renderWarnings(parent: HTMLElement): void {
        for (const warning of this.warnings) {
            this.createElement(parent, 'div', { cls: 'gallery-warning-compact', text: `⚠️ gallery: ${warning}` });
        }
    }

    /**
     * Total number of pages for the current image list, given itemsPerPage.
     * Always at least 1.
     */
    protected get totalPages(): number {
        if (!this.paginationEnabled || this.itemsPerPage <= 0) return 1;
        return Math.max(1, Math.ceil(this._images.length / this.itemsPerPage));
    }

    /**
     * The slice of images to render for the current page. Returns the full
     * list unchanged when pagination is disabled.
     */
    protected getPageImages(): IImageSource[] {
        if (!this.paginationEnabled || this.itemsPerPage <= 0) return this._images;

        // Clamp currentPage in case the image list shrank since the last render
        const pages = this.totalPages;
        if (this.currentPage > pages) this.currentPage = pages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this._images.slice(start, start + this.itemsPerPage);
    }

    /**
     * Navigate to a specific page (clamped to valid range) and re-render.
     */
    protected goToPage(page: number): void {
        const pages = this.totalPages;
        const clamped = Math.min(Math.max(1, page), pages);
        if (clamped === this.currentPage) return;
        this.currentPage = clamped;
        this.render();

        // Scroll the gallery back into view so the new page is visible
        // rather than leaving the viewport scrolled to where the old page ended.
        try {
            this.container.scrollIntoView({ block: 'nearest' });
        } catch (error) { Logger.debug('Ignored error:', error); }
    }

    /**
     * Render Prev/Next pagination controls into the given parent. No-op when
     * pagination is disabled or there's only a single page.
     */
    protected renderPaginationControls(parent: HTMLElement): void {
        if (!this.paginationEnabled || this.itemsPerPage <= 0) return;
        const pages = this.totalPages;
        if (pages <= 1) return;

        const bar = this.createElement(parent, 'div', { cls: 'gallery-pagination' });

        const prevBtn = this.createElement(bar, 'button', {
            cls: 'gallery-pagination-btn gallery-pagination-prev',
            attr: { 'aria-label': 'Previous page', 'title': 'Previous page' },
            text: '‹ Prev'
        }) as HTMLButtonElement;
        prevBtn.disabled = this.currentPage <= 1;
        prevBtn.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            this.goToPage(this.currentPage - 1);
        });

        this.createElement(bar, 'span', {
            cls: 'gallery-pagination-status',
            text: `Page ${this.currentPage} of ${pages}`
        });

        const nextBtn = this.createElement(bar, 'button', {
            cls: 'gallery-pagination-btn gallery-pagination-next',
            attr: { 'aria-label': 'Next page', 'title': 'Next page' },
            text: 'Next ›'
        }) as HTMLButtonElement;
        nextBtn.disabled = this.currentPage >= pages;
        nextBtn.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            this.goToPage(this.currentPage + 1);
        });
    }

    /**
     * Render an image's caption, the same way in every view:
     * - captions on: below the image (`is-below`), taking up space in the layout
     * - captions off: over the bottom of the image (`is-overlay`), shown only on hover or keyboard
     *   focus, and not at all on touch screens
     * `overlayParent` is the element the overlay is positioned over; pass the image's frame when
     * the image is smaller than `parent`.
     */
    protected renderCaption(parent: HTMLElement, image: IImageSource, overlayParent: HTMLElement = parent): HTMLElement | null {
        // Every view adds its caption here, so videos get their badge here too
        if (image.mediaType === 'video') this.renderVideoBadge(overlayParent, image);
        const captionText = image.caption ?? image.displayName;
        if (!captionText) return null;

        const below = this.showCaptions;
        const captionEl = this.createElement(below ? parent : overlayParent, 'div', {
            cls: `gallery-caption ${below ? 'is-below' : 'is-overlay'}`,
            text: captionText
        });
        captionEl.style.setProperty('--gallery-caption-max-lines', String(this.captionMaxLines));
        // The image's alt text already names the tile; don't have screen readers say it twice
        if (captionText === image.displayName) captionEl.setAttribute('aria-hidden', 'true');
        return captionEl;
    }

    /**
     * Mark a tile as a video: a play icon and the length, over the still frame
     */
    protected renderVideoBadge(parent: HTMLElement, image: IImageSource): HTMLElement {
        parent.classList.add('is-video');
        const badge = this.createElement(parent, 'div', {
            cls: 'gallery-video-badge',
            attr: { 'role': 'img', 'aria-label': 'Video' }
        });
        const icon = this.createElement(badge, 'span', { cls: 'gallery-video-badge-icon' });
        setIcon(icon, 'play');
        const time = this.createElement(badge, 'span', { cls: 'gallery-video-badge-time' });
        image.onDurationKnown?.(seconds => {
            const text = formatDuration(seconds);
            if (!text) return;
            time.textContent = text;
            badge.setAttribute('aria-label', `Video, ${text}`);
        });
        return badge;
    }

    /**
     * Update with new image list
     */
    update(images: IImageSource[]): void {
        if (this._isDestroyed) {
            Logger.warn('Cannot update destroyed view');
            return;
        }

        this._images = [...images];
        this.currentPage = 1;
        this.render();
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this._isDestroyed) return;

        // Disconnect all observers
        this._observers.forEach(observer => observer.disconnect());
        this._observers = [];

        // Clear container
        this.emptyElement(this.container);
        this.safeRemoveClass(this.container, 'gallery-view');
        this.safeRemoveClass(this.container, `gallery-${this._type}`);
        this.container.removeAttribute('data-view-type');

        // Clear references
        this._images = [];
        this._isDestroyed = true;
    }

    /**
     * Handle successful image load
     */
    handleImageLoad(image: IImageSource): void {
        if (this._isDestroyed) return;

        // Find corresponding DOM element and update
        const imageElement = this.findImageElement(image.path);
        if (imageElement) {
            this.updateImageElement(imageElement, image, 'loaded');
        }

        // Trigger loaded event
        this.triggerImageEvent('image:loaded', { source: image });
    }

    /**
     * Handle image load error
     */
    handleImageError(image: IImageSource, error: Error): void {
        if (this._isDestroyed) return;

        // Update image state
        image.markError(error.message);

        // Find corresponding DOM element and update
        const imageElement = this.findImageElement(image.path);
        if (imageElement) {
            this.updateImageElement(imageElement, image, 'error');
        }

        // Trigger error event
        this.triggerImageEvent('image:error', {
            source: image,
            error: {
                type: 'load',
                source: image,
                reason: this.getErrorReason(error),
                message: error.message,
                retryable: true
            }
        });
    }

    /**
     * Get error reason from error object
     */
    protected getErrorReason(error: Error): 'timeout' | 'not_found' | 'invalid_format' | 'network_error' | 'too_large' {
        const message = error.message.toLowerCase();

        if (message.includes('timeout')) return 'timeout';
        if (message.includes('not found') || message.includes('404')) return 'not_found';
        if (message.includes('format') || message.includes('invalid')) return 'invalid_format';
        if (message.includes('too large') || message.includes('size')) return 'too_large';

        return 'network_error';
    }

    /**
     * Check if image is in viewport (for lazy loading)
     */
    isImageVisible(image: IImageSource): boolean {
        const imageElement = this.findImageElement(image.path);
        if (!imageElement) return false;

        const rect = imageElement.getBoundingClientRect();
        const windowHeight = window.innerHeight || (typeof window !== 'undefined' ? window.document.documentElement.clientHeight : 0);
        const windowWidth = window.innerWidth || (typeof window !== 'undefined' ? window.document.documentElement.clientWidth : 0);

        return (
            rect.top < windowHeight &&
            rect.bottom > 0 &&
            rect.left < windowWidth &&
            rect.right > 0
        );
    }

    /**
     * Find DOM element for specific image path
     */
    protected findImageElement(imagePath: string): HTMLElement | null {
        if (!imagePath) return null;

        // Avoid using CSS.escape / complex selectors to prevent SelectorSyntaxError in jsdom.
        // Instead, iterate elements with the attribute and compare the attribute value directly.
        try {
            const nodes = Array.from(this.container.querySelectorAll('[data-image-path]')) as unknown as HTMLElement[];
            for (const n of nodes) {
                try {
                    const val = n.getAttribute('data-image-path');
                    if (val === imagePath) return n;
                } catch {
                    // ignore malformed nodes
                }
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Update image element based on loading state
     */
    protected updateImageElement(element: HTMLElement, image: IImageSource, state: 'loading' | 'loaded' | 'error'): void {
        // Remove existing state classes
        this.safeRemoveClass(element, 'image-loading', 'image-loaded', 'image-error');

        // Add new state class
        this.safeAddClass(element, `image-${state}`);

        switch (state) {
            case 'loading':
                this.showLoadingState(element);
                break;
            case 'loaded':
                this.showLoadedState(element, image);
                break;
            case 'error':
                this.showErrorState(element, image);
                break;
        }
    }

    /**
     * Show loading state for image element
     */
    protected showLoadingState(element: HTMLElement): void {
        const existingSpinner = element.querySelector('.gallery-loading-spinner');
        if (!existingSpinner) {
            this.createElement(element, 'div', { cls: 'gallery-loading-spinner' });
        }
    }

    /**
     * Show loaded state for image element
     */
    protected showLoadedState(element: HTMLElement, image: IImageSource): void {
        // Remove loading spinner
        const spinner = element.querySelector('.gallery-loading-spinner');
        if (spinner) spinner.remove();

        // Show actual image
        const img = element.querySelector('img');
        if (img) {
            img.setCssStyles({ opacity: '1' });
        }
    }

    /**
     * Show error state for image element
     */
    protected showErrorState(element: HTMLElement, image: IImageSource): void {
        // Remove loading spinner
        const spinner = element.querySelector('.gallery-loading-spinner');
        if (spinner) spinner.remove();

        // Clear existing error placeholders
        const existingError = element.querySelector('.gallery-error-placeholder');
        if (existingError) existingError.remove();

        // Create professional error placeholder
        ErrorPlaceholder.createImageLoadError(
            element,
            image.path,
            () => this.retryImageLoad(image)
        );

        // Add image-specific styling
        this.safeAddClass(element, 'gallery-item-error');
    }

    /**
     * Retry loading a failed image
     */
    protected retryImageLoad(image: IImageSource): void {
        image.reset();
        image.startLoading();

        // Find element and update to loading state
        const element = this.findImageElement(image.path);
        if (element) {
            this.updateImageElement(element, image, 'loading');

            // Trigger actual reload (implementation depends on view type)
            this.reloadImage(element, image);
        }
    }

    /**
     * Reload image in DOM element
     * Should be overridden by subclasses if needed
     */
    protected reloadImage(element: HTMLElement, image: IImageSource): void {
        const img = element.querySelector('img');
        if (img) {
            this.resolveImageUrl(image)
                .then(url => { img.src = url; })
                .catch((e: unknown) => this.handleImageError(image, e instanceof Error ? e : new Error(String(e))));
        }
    }

    /**
     * Get the URL to display for an image, fetching it first for sources that load on demand
     * (Immich, Nextcloud). Views call this only when they are about to show the image.
     */
    protected resolveImageUrl(image: IImageSource): Promise<string> {
        return image.resolveDisplayUrl ? image.resolveDisplayUrl() : Promise.resolve(image.getDisplayUrl());
    }

    /**
     * Load an image into a temporary Image, honoring remoteLoadTimeoutMs, and report the outcome.
     * The timeout covers both fetching the URL and decoding the image.
     */
    protected loadWithTimeout(image: IImageSource, onLoad: (temp: HTMLImageElement) => void, onError: (error: Error) => void): void {
        // A local or external video's still frame waits its turn to be captured, and the capture
        // has its own limits (falling back to a placeholder), so the remote timeout doesn't apply
        const timed = !((image.type === 'local' || image.type === 'external') && image.mediaType === 'video');
        const temp = new Image();
        let settled = false;
        const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutHandle);
            temp.onload = null;
            temp.onerror = null;
            fn();
        };

        const timeoutHandle = timed
            ? window.setTimeout(() => settle(() => onError(new Error('Image loading timed out'))), this.remoteLoadTimeoutMs ?? 10000)
            : undefined;
        temp.onload = () => settle(() => onLoad(temp));
        temp.onerror = () => settle(() => onError(new Error('Failed to load')));

        this.resolveImageUrl(image)
            .then(url => { if (!settled) temp.src = url; })
            .catch((e: unknown) => settle(() => onError(e instanceof Error ? e : new Error(String(e)))));
    }

    /**
     * Trigger image-related event
     */
    protected triggerImageEvent(eventType: string, data: unknown): void {
        const event = new CustomEvent(eventType, { detail: data });
        this.container.dispatchEvent(event);
    }

    /**
     * Create intersection observer for lazy loading
     */
    protected createLazyLoadObserver(callback: (entries: IntersectionObserverEntry[]) => void): IntersectionObserver {
        const observer = new IntersectionObserver(callback, {
            rootMargin: '50px', // Start loading 50px before image enters viewport
            threshold: 0.1
        });

        this._observers.push(observer);
        return observer;
    }

    /**
     * Get view-specific configuration
     */
    protected getViewConfig(): unknown {
        return {};
    }

    /**
     * Check if view is destroyed
     */
    get isDestroyed(): boolean {
        return this._isDestroyed;
    }

    /**
     * Format file size for display
     */
    protected formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Expand image in modal/lightbox with full control bar, transitions, slideshow, and zoom.
     */
    protected expandImage(image: IImageSource): void {
        // Save the element that had focus so we can restore it later
        const doc = this.container.ownerDocument || (typeof window !== 'undefined' ? window.document : new Document());
        const active = doc.activeElement;
        if (active && active.instanceOf(HTMLElement)) {
            this.lastFocusedElement = active;
        }

        // Create modal overlay using ownerDocument for compatibility with different rendering contexts
        // Create modal overlay using Obsidian createDiv helper
        const body = doc.body;
        const modal = body.createDiv({
            cls: 'gallery-modal',
            attr: {
                'role': 'dialog',
                'aria-modal': 'true',
                'aria-label': image.displayName || 'Image dialog'
            }
        });

        this.activeModal = modal;
        this.slideshowPlaying = false;
        if (this.slideshowTimer) {
            window.clearTimeout(this.slideshowTimer);
            this.slideshowTimer = null;
        }

        // Add class for open animation styling
        window.setTimeout(() => {
            modal.classList.add('gallery-modal-open');
        }, 10);

        let currentImage = image;

        // Close logic
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal(modal);
            }
        };
        modal.addEventListener('keydown', closeOnEscape);

        const keepFocus = (e: Event) => {
            if (!modal.contains(doc.activeElement)) {
                const btn = modal.querySelector('.gallery-modal-close-btn');
                if (btn && btn.instanceOf(HTMLElement)) btn.focus();
            }
        };
        doc.addEventListener('focus', keepFocus, true);

        // Keyboard handler for navigation (Left/Right)
        const modalKeyHandler = (e: KeyboardEvent) => {
            // A focused video uses the arrow keys to seek
            if (e.target instanceof HTMLVideoElement) return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigate(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigate(1);
            }
        };
        modal.addEventListener('keydown', modalKeyHandler);

        // Cleanup handler; `disposers` collects teardown for listeners added further down
        const disposers: Array<() => void> = [];
        const cleanup = () => {
            try {
                disposers.forEach(dispose => dispose());
                stopVideo();
                modal.removeEventListener('keydown', closeOnEscape);
                doc.removeEventListener('focus', keepFocus, true);
                modal.removeEventListener('keydown', modalKeyHandler);
                if (this.slideshowTimer) {
                    window.clearTimeout(this.slideshowTimer);
                    this.slideshowTimer = null;
                }
            } catch (error) { Logger.debug('Ignored error:', error); }
        };
        (modal as unknown as { __cleanup?: () => void }).__cleanup = cleanup;

        // Build the layout: a full-screen stage, a toolbar floating over its top edge, arrows on its
        // sides, the caption at its bottom, and a details panel that slides in from the right
        const content = this.createElement(modal, 'div', { cls: 'gallery-modal-content' });
        const hasSeveral = this._images.length > 1;
        if (!hasSeveral) content.classList.add('is-single');

        const iconButton = (parent: HTMLElement, cls: string, icon: string, label: string) => {
            const btn = this.createElement(parent, 'button', {
                cls: `gallery-modal-tool-btn ${cls}`,
                attr: { 'aria-label': label, 'title': label }
            }) as HTMLButtonElement;
            setIcon(btn, icon);
            return btn;
        };

        // TOOLBAR: position and name on the left, tools on the right
        const toolbar = this.createElement(content, 'div', { cls: 'gallery-modal-toolbar' });
        const titleEl = this.createElement(toolbar, 'div', { cls: 'gallery-modal-title' });
        const counterEl = this.createElement(titleEl, 'span', { cls: 'gallery-modal-counter' });
        const nameEl = this.createElement(titleEl, 'span', { cls: 'gallery-modal-name' });
        const tools = this.createElement(toolbar, 'div', { cls: 'gallery-modal-tools' });

        const playBtn = iconButton(tools, 'play-btn', 'play', 'Play slideshow');
        if (!hasSeveral) playBtn.classList.add('is-hidden');
        const zoomOutBtn = iconButton(tools, 'zoom-out-btn', 'zoom-out', 'Zoom out');
        const zoomInBtn = iconButton(tools, 'zoom-in-btn', 'zoom-in', 'Zoom in');

        const zoomResetBtn = iconButton(tools, 'zoom-reset-btn', 'rotate-ccw', 'Reset zoom');
        const infoBtn = iconButton(tools, 'info-btn', 'info', 'Show details');

        const downloadBtn = iconButton(tools, 'download-btn', 'external-link', 'Open or save image');
        const closeBtn = iconButton(tools, 'gallery-modal-close-btn', 'x', 'Close');
        closeBtn.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeModal(modal);
        });

        // Set initial focus
        modal.setAttribute('tabindex', '-1');
        window.setTimeout(() => {
            try { modal.focus(); } catch (error) { Logger.debug('Ignored error:', error); }
        }, 0);

        // Main Viewer Workspace (holds the stage and the details panel side by side)
        const viewerArea = this.createElement(content, 'div', { cls: 'gallery-modal-viewer' });

        // Image container & Zoom track
        const imgContainer = this.createElement(viewerArea, 'div', { cls: 'gallery-modal-image-container gallery-modal-image' });
        const img = this.createElement(imgContainer, 'img', {
            attr: { 'alt': image.displayName }
        }) as HTMLImageElement;
        // Videos play here instead of the img; it stays hidden for images
        const videoEl = this.createElement(imgContainer, 'video', {
            cls: 'gallery-modal-video is-hidden',
            attr: { 'controls': '', 'playsinline': '', 'preload': 'metadata' }
        }) as HTMLVideoElement;
        // Shown over the still frame when a video won't be played here (too large to download)
        const videoNotice = this.createElement(imgContainer, 'div', { cls: 'gallery-modal-video-notice is-hidden' });
        const captionEl = this.createElement(imgContainer, 'div', { cls: 'gallery-modal-caption' });

        // The video on screen, so it can be stopped and its download let go when the viewer moves on
        let playingVideo: IImageSource | null = null;
        const stopVideo = () => {
            try {
                videoEl.pause();
                videoEl.removeAttribute('src');
                videoEl.removeAttribute('poster');
                videoEl.load();
            } catch (error) { Logger.debug('Ignored error:', error); }
            playingVideo?.releaseVideo?.();
            playingVideo = null;
            videoNotice.classList.add('is-hidden');
            this.emptyElement(videoNotice);
        };

        // Prev/Next arrows, centred on the stage; hidden for a single image
        const prevBtn = this.createElement(imgContainer, 'button', {
            cls: 'gallery-modal-nav prev',
            attr: { 'aria-label': 'Previous image', 'title': 'Previous image' }
        });
        const nextBtn = this.createElement(imgContainer, 'button', {
            cls: 'gallery-modal-nav next',
            attr: { 'aria-label': 'Next image', 'title': 'Next image' }
        });
        prevBtn.addEventListener('click', (e: MouseEvent) => { e.stopPropagation(); navigate(-1); });
        nextBtn.addEventListener('click', (e: MouseEvent) => { e.stopPropagation(); navigate(1); });

        // Click on the backdrop around the photo closes the viewer
        imgContainer.addEventListener('click', (e: MouseEvent) => {
            if (e.target === imgContainer) {
                e.preventDefault();
                e.stopPropagation();
                this.closeModal(modal);
            }
        });

        // Info / Metadata drawer
        const infoPanel = this.createElement(viewerArea, 'div', { cls: 'gallery-modal-info-panel' });

        // Populate metadata function
        const updateInfoPanel = (srcImage: IImageSource) => {
            this.emptyElement(infoPanel);

            const title = this.createElement(infoPanel, 'h3', { text: srcImage.displayName || 'Gallery Image' });
            title.className = 'info-title';

            const grid = this.createElement(infoPanel, 'div', { cls: 'info-grid' });

            const addRow = (label: string, val: string) => {
                const row = this.createElement(grid, 'div', { cls: 'info-row' });
                this.createElement(row, 'span', { cls: 'info-label', text: label });
                this.createElement(row, 'span', { cls: 'info-value', text: val });
            };

            addRow('Path', srcImage.path || 'Unknown');
            addRow('Type', srcImage.type || 'Unknown');

            if (srcImage.caption) {
                addRow('Caption', srcImage.caption);
            }

            if (srcImage.dimensions) {
                addRow('Dimensions', `${srcImage.dimensions.width} × ${srcImage.dimensions.height} px`);
            }
            if (srcImage.size) {
                addRow('File Size', this.formatFileSize(srcImage.size));
            }
            const duration = srcImage.mediaType === 'video' ? formatDuration(srcImage.durationSeconds) : undefined;
            if (duration) addRow('Duration', duration);
            // When the file was last changed (vault files, Nextcloud); photos also show when they were taken
            const modified = typeof srcImage.mtime === 'number' ? formatTakenAt(new Date(srcImage.mtime)) : undefined;
            if (modified) addRow('Modified', modified);

            // Photo details (EXIF): shown when known, read on demand while the panel is open.
            // Missing fields are left out and a failed read just leaves the rows above.
            const addPhotoRows = (metadata: IImageMetadata | undefined) => {
                if (!metadata) return;
                const taken = formatTakenAt(metadata.takenAt);
                if (taken) addRow('Taken', taken);
                if (metadata.camera) addRow('Camera', metadata.camera);
                if (metadata.lens) addRow('Lens', metadata.lens);
            };
            if (srcImage.metadata || !srcImage.resolveMetadata || !infoVisible) {
                addPhotoRows(srcImage.metadata);
                return;
            }
            const token = modalLoadToken;
            srcImage.resolveMetadata()
                .then(metadata => {
                    // Still the same image, and the panel hasn't been rebuilt since
                    if (token === modalLoadToken && currentImage === srcImage && grid.isConnected) addPhotoRows(metadata);
                })
                .catch((error: unknown) => Logger.debug('Could not read photo details:', error));
        };

        // Toolbar text and caption for the image on screen
        const updateHeader = (srcImage: IImageSource) => {
            const index = this._images.findIndex(imgSrc => imgSrc.path === srcImage.path);
            counterEl.textContent = hasSeveral && index >= 0 ? `${index + 1} / ${this._images.length}` : '';
            nameEl.textContent = srcImage.displayName || '';
            captionEl.textContent = srcImage.caption ?? '';
            captionEl.classList.toggle('is-empty', !srcImage.caption);
            modal.setAttribute('aria-label', srcImage.displayName || 'Image dialog');
        };

        // Controls fade out after a few seconds without mouse movement, and come back on any input
        let idleTimer: number | undefined;
        const wakeControls = () => {
            content.classList.remove('is-idle');
            window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(() => content.classList.add('is-idle'), 2500);
        };
        content.addEventListener('mousemove', wakeControls);
        modal.addEventListener('keydown', wakeControls);
        disposers.push(() => window.clearTimeout(idleTimer));
        wakeControls();

        // Zoom state variables
        let currentScale = 1;
        let isDragging = false;
        let startX = 0, startY = 0;
        let translateX = 0, translateY = 0;

        const updateZoomTransform = () => {
            content.classList.toggle('is-zoomed', currentScale > 1);
            img.setCssStyles({ transform: `translate(${translateX}px, ${translateY}px) scale(${currentScale})` });
            if (currentScale > 1) {
                img.setCssStyles({ cursor: isDragging ? 'grabbing' : 'grab' });
            } else {
                img.setCssStyles({ cursor: 'zoom-in' });
                translateX = 0;
                translateY = 0;
                img.setCssStyles({ transform: 'scale(1)' });
            }
        };

        // Zoom handlers
        const zoom = (factor: number) => {
            if (currentImage.mediaType === 'video') return;
            currentScale = Math.max(1, Math.min(8, currentScale * factor));
            updateZoomTransform();
        };

        const resetZoom = () => {
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            updateZoomTransform();
        };

        zoomInBtn.addEventListener('click', () => zoom(1.3));
        zoomOutBtn.addEventListener('click', () => zoom(1 / 1.3));
        zoomResetBtn.addEventListener('click', resetZoom);

        // Double-click toggles between fitted and 2.5x
        img.addEventListener('dblclick', (e: MouseEvent) => {
            e.preventDefault();
            if (currentScale > 1) resetZoom(); else zoom(2.5);
        });

        // Zoom wheel handler: zoom in proportion to the scroll distance, about 1.25x per mouse-wheel
        // notch (100px). Touchpads and smooth-scrolling mice send many small events per gesture, so a
        // fixed step per event made the zoom jump.
        img.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            zoom(wheelZoomFactor(e.deltaY, e.deltaMode));
        }, { passive: false });

        // Pan/Drag handlers. The move/up listeners are on the document so a drag can leave the
        // image; they are removed when the viewer closes.
        img.addEventListener('mousedown', (e: MouseEvent) => {
            if (currentScale <= 1) return;
            e.preventDefault();
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            img.setCssStyles({ cursor: 'grabbing' });
        });
        const onDragMove = (e: MouseEvent) => {
            if (!isDragging) return;
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateZoomTransform();
        };
        const onDragEnd = () => {
            if (isDragging) {
                isDragging = false;
                updateZoomTransform();
            }
        };
        doc.addEventListener('mousemove', onDragMove);
        doc.addEventListener('mouseup', onDragEnd);
        disposers.push(() => {
            doc.removeEventListener('mousemove', onDragMove);
            doc.removeEventListener('mouseup', onDragEnd);
        });

        // Touch: pinch with two fingers to zoom, drag with one to pan while zoomed in, and swipe
        // left/right to change image (not while zoomed in or after a pinch)
        let touchStartX = 0;
        let touchStartY = 0;
        let pinchStartDistance = 0;
        let pinchStartScale = 1;
        let wasPinched = false;
        let touchOnVideo = false;
        const touchDistance = (touches: TouchList) =>
            Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        imgContainer.addEventListener('touchstart', (e: TouchEvent) => {
            touchOnVideo = e.target === videoEl;
            if (touchOnVideo) return;
            if (e.touches.length === 2) {
                wasPinched = true;
                pinchStartDistance = touchDistance(e.touches);
                pinchStartScale = currentScale;
                return;
            }
            if (e.touches.length !== 1) return;
            wasPinched = false;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            startX = touchStartX - translateX;
            startY = touchStartY - translateY;
        }, { passive: true });
        imgContainer.addEventListener('touchmove', (e: TouchEvent) => {
            if (touchOnVideo) return;
            if (e.touches.length === 2 && pinchStartDistance > 0) {
                e.preventDefault();
                currentScale = Math.max(1, Math.min(8, pinchStartScale * touchDistance(e.touches) / pinchStartDistance));
                updateZoomTransform();
            } else if (e.touches.length === 1 && currentScale > 1 && !wasPinched) {
                e.preventDefault();
                translateX = e.touches[0].clientX - startX;
                translateY = e.touches[0].clientY - startY;
                updateZoomTransform();
            }
        }, { passive: false });
        imgContainer.addEventListener('touchend', (e: TouchEvent) => {
            if (e.touches.length < 2) pinchStartDistance = 0;
            if (touchOnVideo || wasPinched || currentScale > 1 || !hasSeveral) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
        });

        // Toggle info panel
        let infoVisible = false;
        infoBtn.addEventListener('click', () => {
            infoVisible = !infoVisible;
            infoBtn.classList.toggle('active', infoVisible);
            infoPanel.classList.toggle('visible', infoVisible);
            // Photo details are read only while the panel is open
            if (infoVisible) updateInfoPanel(currentImage);
            const label = infoVisible ? 'Hide details' : 'Show details';
            infoBtn.setAttribute('aria-label', label);
            infoBtn.setAttribute('title', label);
        });

        // Open/save the image, at the size the viewer shows rather than the gallery's thumbnail
        downloadBtn.addEventListener('click', () => {
            const target = currentImage;
            const resolveUrl = target.mediaType === 'video' && target.resolveVideoUrl
                ? target.resolveVideoUrl()
                : target.resolveLargeUrl ? target.resolveLargeUrl() : this.resolveImageUrl(target);
            resolveUrl.then(displayUrl => {
                if (!displayUrl) return;
                const a = doc.body.createEl('a', {
                    href: displayUrl,
                    attr: { target: '_blank', download: target.displayName || 'image' }
                });
                a.click();
                a.remove();
            }).catch((error: unknown) => Logger.debug('Could not open original image:', error));
        });

        // Image loader helper. Each load gets a token so a slow fetch for an image the user has
        // already navigated away from cannot overwrite the current one.
        let modalLoadToken = 0;
        const loadModalImage = (imgEl: HTMLImageElement, srcImage: IImageSource) => {
            const token = ++modalLoadToken;
            resetZoom();
            stopVideo();
            updateInfoPanel(srcImage);
            updateHeader(srcImage);

            // Remote images and videos stay unloaded until they are allowed in settings
            const blocked = srcImage.type === 'external' && !this.allowRemoteImages;
            const isVideo = !blocked && srcImage.mediaType === 'video' && !!srcImage.resolveVideoUrl;
            content.classList.toggle('is-video', isVideo);
            videoEl.classList.toggle('is-hidden', !isVideo);
            imgEl.classList.toggle('is-hidden', isVideo);
            if (isVideo) {
                loadModalVideo(srcImage, token);
                return;
            }

            if (blocked) {
                imgEl.alt = srcImage.mediaType === 'video' ? 'External video blocked' : 'External image blocked';
                imgEl.src = '';
                imgEl.classList.add('gallery-external-blocked');
                return;
            }

            imgEl.classList.remove('gallery-external-blocked');
            imgEl.setCssStyles({
                transition: 'opacity 0.2s ease-in-out',
                opacity: '0'
            });

            this.loadWithTimeout(srcImage, (temp) => {
                if (token !== modalLoadToken) return;
                try {
                    imgEl.src = temp.src;
                    imgEl.setCssStyles({ opacity: '1' });
                } catch (error) { Logger.debug('Ignored error:', error); }
                loadLargeVersion(imgEl, srcImage, token);
                preloadNeighbours(srcImage);
            }, () => {
                if (token !== modalLoadToken) return;
                imgEl.alt = 'Failed to load';
                imgEl.src = '';
                imgEl.setCssStyles({ opacity: '1' });
            });
        };

        // Videos: the still frame shows while the video downloads (remote) or opens (local), then
        // it plays. Each step checks the token, so a slow download can't start after moving on.
        const loadModalVideo = (srcImage: IImageSource, token: number) => {
            if (isTooLargeToPlay(srcImage)) {
                showVideoTooLarge(srcImage, token);
                return;
            }
            this.resolveImageUrl(srcImage)
                .then(poster => { if (token === modalLoadToken && poster) videoEl.poster = poster; })
                .catch((error: unknown) => Logger.debug('No still frame for video:', error));
            srcImage.resolveVideoUrl!()
                .then(url => {
                    if (token !== modalLoadToken) {
                        srcImage.releaseVideo?.();
                        return;
                    }
                    playingVideo = srcImage;
                    videoEl.src = url;
                    try {
                        // Browsers may refuse to start with sound until the user interacts; the controls still work
                        videoEl.play()?.catch((error: unknown) => Logger.debug('Video did not start on its own:', error));
                    } catch (error) { Logger.debug('Video did not start on its own:', error); }
                })
                .catch((error: unknown) => {
                    Logger.warn('Could not load video:', srcImage.path, error);
                    showVideoFailure(srcImage, token, "This video couldn't be loaded.");
                });
            videoEl.setAttribute('aria-label', srcImage.displayName || 'Video');
        };

        // Remote videos download in full before playing, so large ones aren't downloaded at all.
        // Videos of unknown size are played.
        const isTooLargeToPlay = (srcImage: IImageSource): boolean => {
            const limit = this.maxRemoteVideoMb * 1024 * 1024;
            // Local and external videos stream into the player, so they play at any size
            return srcImage.type !== 'local' && srcImage.type !== 'external' && limit > 0 && typeof srcImage.size === 'number' && srcImage.size > limit;
        };
        const showVideoTooLarge = (srcImage: IImageSource, token: number) => {
            showVideoFailure(srcImage, token, `This video is too large to play here (${this.formatFileSize(srcImage.size ?? 0)}).`);
        };

        // A video that won't play here: its still frame (or nothing), with a short message and,
        // for Immich and Nextcloud, a button that opens it there
        const showVideoFailure = (srcImage: IImageSource, token: number, message: string) => {
            if (token !== modalLoadToken) return;
            videoEl.classList.add('is-hidden');
            img.classList.remove('is-hidden');
            img.alt = srcImage.displayName || 'Video';
            this.resolveImageUrl(srcImage)
                .then(poster => { if (token === modalLoadToken) { img.src = poster; img.setCssStyles({ opacity: '1' }); } })
                .catch(() => { img.src = ''; });

            this.emptyElement(videoNotice);
            this.createElement(videoNotice, 'div', { cls: 'gallery-modal-video-notice-text', text: message });
            if (srcImage.openUrl) {
                const openUrl = srcImage.openUrl;
                const service = srcImage.type.startsWith('nextcloud') ? 'Nextcloud' : srcImage.type.startsWith('immich') ? 'Immich' : '';
                const link = this.createElement(videoNotice, 'button', { cls: 'gallery-modal-video-notice-btn', text: service ? `Open in ${service}` : 'Open' });
                link.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    window.open(openUrl, '_blank');
                });
            }
            videoNotice.classList.remove('is-hidden');
            // A slideshow moves on after the usual interval
            if (this.slideshowPlaying) scheduleNext();
        };
        // Sources that don't list a video's length or size (Nextcloud) learn them once it plays;
        // tile badges update, and layouts use the size the next time they render
        videoEl.addEventListener('loadedmetadata', () => {
            if (!playingVideo) return;
            if (playingVideo.durationSeconds === undefined && Number.isFinite(videoEl.duration)) {
                playingVideo.durationSeconds = videoEl.duration;
            }
            if (!playingVideo.dimensions && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                playingVideo.dimensions = { width: videoEl.videoWidth, height: videoEl.videoHeight };
            }
        });

        // The file opened but the player can't decode it (an unsupported codec, say)
        videoEl.addEventListener('error', () => {
            if (playingVideo && playingVideo === currentImage && videoEl.getAttribute('src')) {
                Logger.warn('Could not play video:', currentImage.path, videoEl.error?.message);
                showVideoFailure(currentImage, modalLoadToken, "This video can't be played here. Its format may not be supported on this device.");
            }
        });

        // Galleries of remote thumbnails show the thumbnail first, then swap in the larger
        // version once it has downloaded and decoded, unless the user has moved on.
        const loadLargeVersion = (imgEl: HTMLImageElement, srcImage: IImageSource, token: number) => {
            if (!srcImage.resolveLargeUrl) return;
            srcImage.resolveLargeUrl()
                .then(url => {
                    if (token !== modalLoadToken || url === imgEl.src) return;
                    const large = new Image();
                    large.onload = () => {
                        if (token === modalLoadToken) imgEl.src = url;
                    };
                    large.src = url;
                })
                .catch((error: unknown) => Logger.debug('Could not load the larger image:', error));
        };

        // Fetch the images either side in the background, so stepping through is instant
        const preloadNeighbours = (srcImage: IImageSource) => {
            if (!hasSeveral) return;
            const index = this._images.findIndex(imgSrc => imgSrc.path === srcImage.path);
            if (index < 0) return;
            const count = this._images.length;
            for (const neighbour of [this._images[(index + 1) % count], this._images[(index - 1 + count) % count]]) {
                if (!neighbour || neighbour === srcImage) continue;
                if (neighbour.type === 'external' && !this.allowRemoteImages) continue;
                const resolve = neighbour.resolveLargeUrl ? neighbour.resolveLargeUrl() : this.resolveImageUrl(neighbour);
                resolve
                    .then(url => { new Image().src = url; })
                    .catch((error: unknown) => Logger.debug('Could not preload image:', error));
            }
        };

        // Initial Load
        loadModalImage(img, image);

        // Slideshow Toggle function
        const toggleSlideshow = () => {
            this.slideshowPlaying = !this.slideshowPlaying;
            playBtn.classList.toggle('playing', this.slideshowPlaying);
            setIcon(playBtn, this.slideshowPlaying ? 'pause' : 'play');
            const playTitle = this.slideshowPlaying ? 'Pause slideshow' : 'Play slideshow';
            playBtn.setAttribute('title', playTitle);
            playBtn.setAttribute('aria-label', playTitle);

            if (this.slideshowPlaying) {
                scheduleNext();
            } else if (this.slideshowTimer) {
                window.clearTimeout(this.slideshowTimer);
                this.slideshowTimer = null;
            }
        };
        playBtn.addEventListener('click', toggleSlideshow);

        // The slideshow shows an image for the set interval; a video plays to the end
        const scheduleNext = () => {
            if (this.slideshowTimer) window.clearTimeout(this.slideshowTimer);
            this.slideshowTimer = null;
            if (!this.slideshowPlaying) return;
            // A video moves on when it ends (see 'ended'), unless it already has
            if (currentImage.mediaType === 'video' && !videoEl.classList.contains('is-hidden') && !videoEl.ended) return;
            this.slideshowTimer = window.setTimeout(() => navigate(1, true), slideshowSeconds(this.slideshowIntervalSeconds) * 1000);
        };
        videoEl.addEventListener('ended', () => {
            if (this.slideshowPlaying) navigate(1, true);
        });

        // Navigation function
        const navigate = (delta: number, isSlideshow = false) => {
            if (!hasSeveral) return;
            // Pause slideshow if manually triggered navigation, or keep it going if slideshow triggered
            if (!isSlideshow && this.slideshowPlaying) {
                toggleSlideshow();
            }

            const currentIndex = this._images.findIndex(imgSrc => imgSrc.path === currentImage.path);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex + delta;
            if (nextIndex < 0) {
                nextIndex = this._images.length - 1; // loop around
            } else if (nextIndex >= this._images.length) {
                nextIndex = 0; // loop around
            }

            const nextImage = this._images[nextIndex];
            if (nextImage) {
                currentImage = nextImage;
                loadModalImage(img, nextImage);
                if (this.slideshowPlaying) scheduleNext();
            }
        };

        // Append modal to body
        try {
            doc.body.appendChild(modal);
        } catch (appendErr) {
            Logger.warn('Failed to append modal to document body, falling back to alternative:', appendErr);
            if (doc.body) {
                doc.body.appendChild(modal);
            } else if (typeof window !== 'undefined' && window.document.body) {
                window.document.body.appendChild(modal);
            }
        }
    }

    /**
     * Close modal safely
     */
    protected closeModal(modal: HTMLElement): void {
        modal.classList.remove('gallery-modal-open');
        modal.classList.add('gallery-modal-closing');
        modal.setCssStyles({ display: 'none' });

        try {
            const cleanup = (modal as unknown as { __cleanup?: () => void }).__cleanup;
            if (cleanup) cleanup();
        } catch (error) { Logger.debug('Ignored error:', error); }

        modal.remove();
        if (this.activeModal === modal) {
            this.activeModal = null;
        }
        if (this.lastFocusedElement) {
            try { this.lastFocusedElement.focus(); } catch (error) { Logger.debug('Ignored error:', error); }
            this.lastFocusedElement = null;
        }
    }
}