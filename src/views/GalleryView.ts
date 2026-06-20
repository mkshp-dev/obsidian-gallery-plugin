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
            const nodes = Array.from(this.container.querySelectorAll('[data-image-path]')) as HTMLElement[];
            for (const n of nodes) {
                try {
                    const val = n.getAttribute('data-image-path');
                    if (val === imagePath) return n;
                } catch {
                    // ignore malformed nodes
                }
            }
            return null;
        } catch (e) {
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
        const errorPlaceholder = ErrorPlaceholder.createImageLoadError(
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
}