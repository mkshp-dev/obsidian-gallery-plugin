import { IGalleryView, IImageSource } from '../models/interfaces';

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
        this.container.addClass('gallery-view');
        this.container.addClass(`gallery-${this._type}`);
        this.container.setAttribute('data-view-type', this._type);
    }

    /**
     * Abstract method for rendering initial gallery
     * Must be implemented by subclasses
     */
    abstract render(): void;

    /**
     * Update with new image list
     */
    update(images: IImageSource[]): void {
        if (this._isDestroyed) {
            console.warn('Cannot update destroyed view');
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
        this.container.empty();
        this.container.removeClass('gallery-view');
        this.container.removeClass(`gallery-${this._type}`);
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
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

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
        return this.container.querySelector(`[data-image-path="${CSS.escape(imagePath)}"]`);
    }

    /**
     * Update image element based on loading state
     */
    protected updateImageElement(element: HTMLElement, image: IImageSource, state: 'loading' | 'loaded' | 'error'): void {
        // Remove existing state classes
        element.removeClass('image-loading', 'image-loaded', 'image-error');
        
        // Add new state class
        element.addClass(`image-${state}`);
        
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
            element.createEl('div', { cls: 'gallery-loading-spinner' });
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
            img.style.opacity = '1';
        }
    }

    /**
     * Show error state for image element
     */
    protected showErrorState(element: HTMLElement, image: IImageSource): void {
        // Remove loading spinner
        const spinner = element.querySelector('.gallery-loading-spinner');
        if (spinner) spinner.remove();

        // Show error placeholder
        const existingError = element.querySelector('.gallery-error-placeholder');
        if (!existingError) {
            const errorEl = element.createEl('div', { 
                cls: 'gallery-error-placeholder',
                text: image.errorMessage || 'Failed to load image'
            });
            
            // Add retry button for retryable errors
            if (image.canRetry()) {
                const retryBtn = errorEl.createEl('button', {
                    text: 'Retry',
                    cls: 'gallery-retry-btn'
                });
                
                retryBtn.addEventListener('click', () => {
                    this.retryImageLoad(image);
                });
            }
        }
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
            img.src = image.path;
        }
    }

    /**
     * Trigger image-related event
     */
    protected triggerImageEvent(eventType: string, data: any): void {
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
    protected getViewConfig(): any {
        return {};
    }

    /**
     * Check if view is destroyed
     */
    get isDestroyed(): boolean {
        return this._isDestroyed;
    }
}