import { posthog } from '../analytics';
import { Logger } from "../utils/Logger";
import { IGalleryView, IImageSource, ObsidianDOMExtensions, CreateElementOptions } from '../models/interfaces';
import { ErrorPlaceholder } from './components/ErrorPlaceholder';

/**
 * Abstract base class for gallery view renderers
 * Provides common functionality for all view types
 */
export abstract class GalleryView implements IGalleryView {
    public readonly container: HTMLElement;
    protected _images: IImageSource[] = [];
    protected _type: 'thumbnail' | 'carousel' | 'grid';
    protected _isDestroyed: boolean = false;
    protected _observers: IntersectionObserver[] = [];
    // Runtime options (common)
    public remoteLoadTimeoutMs: number = 10000;
    public allowRemoteImages: boolean = false;
    
    protected lastFocusedElement: HTMLElement | null = null;
    protected activeModal: HTMLElement | null = null;
    protected slideshowInterval: number | null = null;
    protected slideshowPlaying: boolean = false;

    constructor(type: 'thumbnail' | 'carousel' | 'grid', container: HTMLElement) {
        this._type = type;
        this.container = container;
        this.initializeContainer();
    }

    /**
     * Get view type identifier
     */
    get type(): 'thumbnail' | 'carousel' | 'grid' {
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
        // If parent provides an external createEl helper (e.g., Obsidian API or test mock),
        // prefer delegating to it — but avoid delegating to a shim we previously attached,
        // which would cause infinite recursion. We mark our shims with __galleryShim.
        const obsParent = parent as unknown as ObsidianDOMExtensions;
        const parentShim = parent as unknown as { __galleryShim?: boolean };
        if (obsParent.createEl && typeof obsParent.createEl === 'function' && !parentShim.__galleryShim) {
            return obsParent.createEl(tag, props);
        }

        const el = activeDocument.createElement(tag);
        if (props) {
            if (props.cls) el.className = props.cls;
            if (props.text) el.textContent = props.text;
            if (props.attr && typeof props.attr === 'object') {
                const attrObj = props.attr;
                Object.keys(attrObj).forEach(k => el.setAttribute(k, String(attrObj[k])));
            }
        }
        // attach small helper shims so callers using Obsidian-style helpers won't break
        const obsEl = el as unknown as ObsidianDOMExtensions;
        obsEl.addClass = (c: string) => el.classList.add(c);
        obsEl.removeClass = (c: string) => el.classList.remove(c);
        // mark shim so callers know not to delegate back to it
        (el as unknown as { __galleryShim: boolean }).__galleryShim = true;
        obsEl.createEl = (t: string, p?: unknown) => this.createElement(el, t, p as CreateElementOptions);
        obsEl.createDiv = (p?: unknown) => this.createElement(el, 'div', p as CreateElementOptions);

        parent.appendChild(el);
        return el;
    }

    /**
     * Abstract method for rendering initial gallery
     * Must be implemented by subclasses
     */
    abstract render(): void;

    /**
     * Apply runtime options to the view. Subclasses may override to react immediately.
     */
    setOptions(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean } = {}): void {
        if (typeof options.remoteLoadTimeoutMs === 'number') this.remoteLoadTimeoutMs = options.remoteLoadTimeoutMs;
        if (typeof options.allowRemoteImages === 'boolean') this.allowRemoteImages = options.allowRemoteImages;
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
        const windowHeight = window.innerHeight || activeDocument.documentElement.clientHeight;
        const windowWidth = window.innerWidth || activeDocument.documentElement.clientWidth;

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
            img.src = image.getDisplayUrl();
        }
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
        posthog.capture('image_expanded', { image_type: image.type });
        // Save the element that had focus so we can restore it later
        const active = activeDocument.activeElement;
        if (active && active.instanceOf(HTMLElement)) {
            this.lastFocusedElement = active;
        }

        // Create modal overlay using ownerDocument for compatibility with different rendering contexts
        const doc = this.container.ownerDocument || activeDocument;
        const modal = doc.createElement('div');
        modal.className = 'gallery-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', image.displayName || 'Image dialog');

        this.activeModal = modal;
        this.slideshowPlaying = false;
        if (this.slideshowInterval) {
            window.clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
        }

        // Add class for open animation styling
        window.setTimeout(() => {
            modal.classList.add('gallery-modal-open');
        }, 10);

        let currentImage = image;

        // Close logic
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
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
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigate(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigate(1);
            }
        };
        modal.addEventListener('keydown', modalKeyHandler);

        // Cleanup handler
        const cleanup = () => {
            try {
                modal.removeEventListener('keydown', closeOnEscape);
                doc.removeEventListener('focus', keepFocus, true);
                modal.removeEventListener('keydown', modalKeyHandler);
                if (this.slideshowInterval) {
                    window.clearInterval(this.slideshowInterval);
                    this.slideshowInterval = null;
                }
            } catch (error) { Logger.debug('Ignored error:', error); }
        };
        (modal as unknown as { __cleanup?: () => void }).__cleanup = cleanup;

        // Build HTML layout
        const content = this.createElement(modal, 'div', { cls: 'gallery-modal-content' });

        // TOOLBAR
        const toolbar = this.createElement(content, 'div', { cls: 'gallery-modal-toolbar' });

        // Play/Pause Slideshow Button
        const playBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn play-btn',
            attr: { 'aria-label': 'Play slideshow' }
        });
        playBtn.textContent = '▶'; // play symbol

        // Zoom Buttons
        const zoomOutBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn zoom-out-btn',
            attr: { 'aria-label': 'Zoom out' }
        });
        zoomOutBtn.textContent = '➖';

        const zoomInBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn zoom-in-btn',
            attr: { 'aria-label': 'Zoom in' }
        });
        zoomInBtn.textContent = '➕';

        const zoomResetBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn zoom-reset-btn',
            attr: { 'aria-label': 'Reset zoom' }
        });
        zoomResetBtn.textContent = '🔄';

        // Info Panel Button
        const infoBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn info-btn',
            attr: { 'aria-label': 'Toggle info' }
        });
        infoBtn.textContent = 'ℹ️';

        // Download/Open original Button
        const downloadBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-tool-btn download-btn',
            attr: { 'aria-label': 'Open original image' }
        });
        downloadBtn.textContent = '🔗';

        // Close Button
        const closeBtn = this.createElement(toolbar, 'button', {
            cls: 'gallery-modal-close-btn',
            attr: { 'aria-label': 'Close image dialog', 'role': 'button' }
        });
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.closeModal(modal));

        // Click to close modal when clicking outside content
        modal.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Set initial focus
        modal.setAttribute('tabindex', '-1');
        window.setTimeout(() => {
            try { modal.focus(); } catch (error) { Logger.debug('Ignored error:', error); }
        }, 0);

        // Prev/Next Nav elements
        const prevBtn = this.createElement(content, 'button', {
            cls: 'gallery-modal-nav prev',
            text: '\u2039'
        });
        prevBtn.setAttribute('aria-label', 'Previous image');
        prevBtn.addEventListener('click', () => navigate(-1));

        const nextBtn = this.createElement(content, 'button', {
            cls: 'gallery-modal-nav next',
            text: '\u203A'
        });
        nextBtn.setAttribute('aria-label', 'Next image');
        nextBtn.addEventListener('click', () => navigate(1));

        // Main Viewer Workspace (holds image and info side-by-side or stacked)
        const viewerArea = this.createElement(content, 'div', { cls: 'gallery-modal-viewer' });

        // Image container & Zoom track
        const imgContainer = this.createElement(viewerArea, 'div', { cls: 'gallery-modal-image-container gallery-modal-image' });
        const img = this.createElement(imgContainer, 'img', {
            attr: { 'alt': image.displayName }
        }) as HTMLImageElement;

        // Info / Metadata drawer
        const infoPanel = this.createElement(viewerArea, 'div', { cls: 'gallery-modal-info-panel' });
        
        // Populate metadata function
        const updateInfoPanel = (srcImage: IImageSource) => {
            this.emptyElement(infoPanel);
            
            const title = infoPanel.createEl('h3', { text: srcImage.displayName || 'Gallery Image' });
            title.className = 'info-title';

            const grid = infoPanel.createEl('div', { cls: 'info-grid' });

            const addRow = (label: string, val: string) => {
                const row = grid.createEl('div', { cls: 'info-row' });
                row.createEl('span', { cls: 'info-label', text: label });
                row.createEl('span', { cls: 'info-value', text: val });
            };

            addRow('Path', srcImage.path || 'Unknown');
            addRow('Type', srcImage.type || 'Unknown');

            if (srcImage.dimensions) {
                addRow('Dimensions', `${srcImage.dimensions.width} × ${srcImage.dimensions.height} px`);
            }
            if (srcImage.size) {
                addRow('File Size', this.formatFileSize(srcImage.size));
            }
        };

        // Zoom state variables
        let currentScale = 1;
        let isDragging = false;
        let startX = 0, startY = 0;
        let translateX = 0, translateY = 0;

        const updateZoomTransform = () => {
            img.setCssStyles({ transform: `translate(${translateX}px, ${translateY}px) scale(${currentScale})` });
            if (currentScale > 1) {
                img.setCssStyles({ cursor: isDragging ? 'grabbing' : 'grab' });
            } else {
                img.setCssStyles({ cursor: 'default' });
                translateX = 0;
                translateY = 0;
                img.setCssStyles({ transform: 'scale(1)' });
            }
        };

        // Zoom handlers
        const zoom = (factor: number) => {
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

        // Zoom wheel handler
        img.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoom(1.1);
            } else {
                zoom(1 / 1.1);
            }
        }, { passive: false });

        // Pan/Drag handlers
        img.addEventListener('mousedown', (e: MouseEvent) => {
            if (currentScale <= 1) return;
            e.preventDefault();
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            img.setCssStyles({ cursor: 'grabbing' });
        });

        doc.addEventListener('mousemove', (e: MouseEvent) => {
            if (!isDragging) return;
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            updateZoomTransform();
        });

        doc.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                updateZoomTransform();
            }
        });

        // Toggle info panel
        let infoVisible = false;
        infoBtn.addEventListener('click', () => {
            infoVisible = !infoVisible;
            infoBtn.classList.toggle('active', infoVisible);
            infoPanel.classList.toggle('visible', infoVisible);
        });

        // Download/Open Original
        downloadBtn.addEventListener('click', () => {
            const displayUrl = currentImage.getDisplayUrl();
            if (displayUrl) {
                posthog.capture('image_opened_original', { image_type: currentImage.type });
                const a = doc.createElement('a');
                a.href = displayUrl;
                a.target = '_blank';
                a.download = currentImage.displayName || 'image';
                a.click();
            }
        });

        // Image loader helper
        const loadModalImage = (imgEl: HTMLImageElement, srcImage: IImageSource) => {
            resetZoom();
            updateInfoPanel(srcImage);

            if (srcImage.type === 'external' && !this.allowRemoteImages) {
                imgEl.alt = 'External image blocked';
                imgEl.src = '';
                imgEl.classList.add('gallery-external-blocked');
                return;
            }

            imgEl.classList.remove('gallery-external-blocked');
            imgEl.setCssStyles({
                transition: 'opacity 0.2s ease-in-out',
                opacity: '0'
            });

            const temp = new Image();
            let timeoutHandle: number | undefined = undefined;

            const onLoad = () => {
                window.clearTimeout(timeoutHandle);
                try {
                    imgEl.src = temp.src;
                    imgEl.setCssStyles({ opacity: '1' });
                } catch (error) { Logger.debug('Ignored error:', error); }
                cleanup();
            };

            const onError = () => {
                window.clearTimeout(timeoutHandle);
                imgEl.alt = 'Failed to load';
                imgEl.src = '';
                imgEl.setCssStyles({ opacity: '1' });
                cleanup();
            };

            const cleanup = () => {
                temp.onload = null;
                temp.onerror = null;
            };

            temp.onload = onLoad;
            temp.onerror = onError;

            timeoutHandle = window.setTimeout(() => {
                onError();
            }, this.remoteLoadTimeoutMs ?? 10000);

            try { temp.src = srcImage.getDisplayUrl(); } catch { onError(); }
        };

        // Initial Load
        loadModalImage(img, image);

        // Slideshow Toggle function
        const toggleSlideshow = () => {
            this.slideshowPlaying = !this.slideshowPlaying;
            playBtn.classList.toggle('playing', this.slideshowPlaying);
            playBtn.textContent = this.slideshowPlaying ? '⏸' : '▶';

            if (this.slideshowPlaying) {
                posthog.capture('slideshow_started');
                this.slideshowInterval = window.setInterval(() => {
                    navigate(1, true);
                }, 4000);
            } else {
                if (this.slideshowInterval) {
                    window.clearInterval(this.slideshowInterval);
                    this.slideshowInterval = null;
                }
            }
        };
        playBtn.addEventListener('click', toggleSlideshow);

        // Navigation function
        const navigate = (delta: number, isSlideshow = false) => {
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
            }
        };

        // Append modal to body
        try {
            doc.body.appendChild(modal);
        } catch (appendErr) {
            Logger.warn('Failed to append modal to document body, falling back to activeDocument.body:', appendErr);
            activeDocument.body.appendChild(modal);
        }
    }

    /**
     * Close modal safely
     */
    protected closeModal(modal: HTMLElement): void {
        modal.classList.remove('gallery-modal-open');
        modal.classList.add('gallery-modal-closing');
        
        try {
            const cleanup = (modal as unknown as { __cleanup?: () => void }).__cleanup;
            if (cleanup) cleanup();
        } catch (error) { Logger.debug('Ignored error:', error); }

        window.setTimeout(() => {
            modal.remove();
            if (this.activeModal === modal) {
                this.activeModal = null;
            }
            if (this.lastFocusedElement) {
                try { this.lastFocusedElement.focus(); } catch (error) { Logger.debug('Ignored error:', error); }
                this.lastFocusedElement = null;
            }
        }, 200);
    }
}