import { IGalleryInstance, IGalleryConfig, IImageSource, IGalleryView } from './interfaces';

/**
 * Represents a rendered gallery within a markdown document
 * Manages the lifecycle and state of a single gallery instance
 */
export class GalleryInstance implements IGalleryInstance {
    public readonly id: string;
    public readonly config: IGalleryConfig;
    public readonly container: HTMLElement;
    public readonly view: IGalleryView;
    
    private _images: IImageSource[] = [];
    private _loadedCount: number = 0;
    private _errorCount: number = 0;
    private _isDestroyed: boolean = false;

    constructor(
        config: IGalleryConfig,
        container: HTMLElement,
        view: IGalleryView,
        images: IImageSource[] = []
    ) {
        this.id = this.generateId();
        this.config = config;
        this.container = container;
        this.view = view;
        this._images = [...images];
        
        // Initialize container
    this.initializeContainer();
        
        // Update counters
        this.updateCounters();
    }

    /**
     * Generate unique identifier for this gallery instance
     */
    private generateId(): string {
        return `gallery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize container with gallery class and data attributes
     */
    private initializeContainer(): void {
        // Support both Obsidian container helpers and plain DOM elements
        this.addClass(this.container, 'gallery-container');
        try { this.container.setAttribute('data-gallery-id', this.id); } catch {}
        try { this.container.setAttribute('data-gallery-type', this.config.view || 'thumbnail'); } catch {}
        try { this.container.setAttribute('data-gallery-path', this.config.path); } catch {}
    }

    /**
     * Update loaded and error counters based on current image states
     */
    private updateCounters(): void {
        this._loadedCount = this._images.filter(img => img.loadState === 'loaded').length;
        this._errorCount = this._images.filter(img => img.loadState === 'error').length;
    }

    /**
     * Get current images array (readonly)
     */
    get images(): IImageSource[] {
        return [...this._images];
    }

    /**
     * Get number of successfully loaded images
     */
    get loadedCount(): number {
        return this._loadedCount;
    }

    /**
     * Get number of failed image loads
     */
    get errorCount(): number {
        return this._errorCount;
    }

    /**
     * Get total number of images
     */
    get totalCount(): number {
        return this._images.length;
    }

    /**
     * Get loading progress as percentage
     */
    get loadingProgress(): number {
        if (this._images.length === 0) return 100;
        return (this._loadedCount / this._images.length) * 100;
    }

    /**
     * Check if gallery is fully loaded (all images loaded or errored)
     */
    get isFullyLoaded(): boolean {
        return this._images.length > 0 && 
               this._images.every(img => img.loadState === 'loaded' || img.loadState === 'error');
    }

    /**
     * Check if gallery has any errors
     */
    get hasErrors(): boolean {
        return this._errorCount > 0;
    }

    /**
     * Check if gallery is empty
     */
    get isEmpty(): boolean {
        return this._images.length === 0;
    }

    /**
     * Update gallery with new images
     */
    update(images: IImageSource[]): void {
        if (this._isDestroyed) {
            console.warn('Cannot update destroyed gallery instance');
            return;
        }

        // Store previous images for comparison
        const previousImages = this._images;
        this._images = [...images];
        
        // Update counters
        this.updateCounters();
        
        // Update view
        try {
            this.view.update(this._images);
        } catch (error) {
            console.error('Error updating gallery view:', error);
            this.showError('Failed to update gallery view');
        }

        // Trigger update event
        this.triggerEvent('gallery:updated', {
            instance: this,
            changes: this.getChanges(previousImages, images)
        });
    }

    /**
     * Get list of changes between old and new image arrays
     */
    private getChanges(oldImages: IImageSource[], newImages: IImageSource[]): string[] {
        const changes: string[] = [];
        
        if (oldImages.length !== newImages.length) {
            changes.push('image_count');
        }
        
        // Check for new images
        const oldPaths = new Set(oldImages.map(img => img.path));
        const newPaths = new Set(newImages.map(img => img.path));
        
        const added = newImages.filter(img => !oldPaths.has(img.path));
        const removed = oldImages.filter(img => !newPaths.has(img.path));
        
        if (added.length > 0) changes.push('images_added');
        if (removed.length > 0) changes.push('images_removed');
        
        return changes;
    }

    /**
     * Show error message in gallery container
     */
    private showError(message: string): void {
        this.emptyElement(this.container);
        const err = this.createElement(this.container, 'div', { cls: 'gallery-error', text: message });
        return;
    }

    /**
     * Trigger gallery event
     */
    private triggerEvent(eventType: string, data: any): void {
        const event = new CustomEvent(eventType, { detail: data });
        this.container.dispatchEvent(event);
    }

    /**
     * Helper to create an element into a parent supporting Obsidian helpers or plain DOM
     */
    private createElement(parent: HTMLElement, tag: string = 'div', options?: any): HTMLElement {
        const anyParent = parent as any;
        if (anyParent.createEl && typeof anyParent.createEl === 'function') {
            return anyParent.createEl(tag, options || {});
        }

        const el = document.createElement(tag);
        if (options) {
            if (options.cls) el.className = options.cls;
            if (options.text) el.textContent = options.text;
            if (options.attr) {
                for (const k of Object.keys(options.attr)) {
                    try { el.setAttribute(k, String(options.attr[k])); } catch {}
                }
            }
        }
        parent.appendChild(el);
        return el;
    }

    private addClass(el: HTMLElement, cls: string) {
        const anyEl = el as any;
        if (anyEl.addClass && typeof anyEl.addClass === 'function') {
            anyEl.addClass(cls);
            return;
        }
        try { el.classList.add(cls); } catch {}
    }

    private removeClass(el: HTMLElement, cls: string) {
        const anyEl = el as any;
        if (anyEl.removeClass && typeof anyEl.removeClass === 'function') {
            anyEl.removeClass(cls);
            return;
        }
        try { el.classList.remove(cls); } catch {}
    }

    private emptyElement(el: HTMLElement) {
        const anyEl = el as any;
        if (anyEl.empty && typeof anyEl.empty === 'function') {
            try { anyEl.empty(); return; } catch {}
        }
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    /**
     * Refresh gallery by re-rendering current state
     */
    refresh(): void {
        if (this._isDestroyed) return;
        
        try {
            this.view.render();
            this.updateCounters();
        } catch (error) {
            console.error('Error refreshing gallery:', error);
            this.showError('Failed to refresh gallery');
        }
    }

    /**
     * Add new image to gallery
     */
    addImage(image: IImageSource): void {
        if (this._isDestroyed) return;
        
        // Check if image already exists
        if (this._images.some(img => img.path === image.path)) {
            console.warn('Image already exists in gallery:', image.path);
            return;
        }
        
        this._images.push(image);
        this.updateCounters();
        this.view.update(this._images);
    }

    /**
     * Remove image from gallery
     */
    removeImage(imagePath: string): boolean {
        if (this._isDestroyed) return false;
        
        const initialLength = this._images.length;
        this._images = this._images.filter(img => img.path !== imagePath);
        
        if (this._images.length < initialLength) {
            this.updateCounters();
            this.view.update(this._images);
            return true;
        }
        
        return false;
    }

    /**
     * Get image by path
     */
    getImage(path: string): IImageSource | undefined {
        return this._images.find(img => img.path === path);
    }

    /**
     * Get gallery statistics
     */
    getStats(): {
        total: number;
        loaded: number;
        loading: number;
        pending: number;
        error: number;
        progress: number;
    } {
        const loading = this._images.filter(img => img.loadState === 'loading').length;
        const pending = this._images.filter(img => img.loadState === 'pending').length;
        
        return {
            total: this._images.length,
            loaded: this._loadedCount,
            loading,
            pending,
            error: this._errorCount,
            progress: this.loadingProgress
        };
    }

    /**
     * Destroy gallery and clean up resources
     */
    destroy(): void {
        if (this._isDestroyed) return;
        
        // Trigger destroy event
        this.triggerEvent('gallery:destroyed', { instanceId: this.id });
        
        // Clean up view
        try {
            this.view.destroy();
        } catch (error) {
            console.error('Error destroying gallery view:', error);
        }
        
    // Clear container (support plain DOM)
    this.emptyElement(this.container);
    this.removeClass(this.container, 'gallery-container');
    try { this.container.removeAttribute('data-gallery-id'); } catch {}
    try { this.container.removeAttribute('data-gallery-type'); } catch {}
    try { this.container.removeAttribute('data-gallery-path'); } catch {}
        
        // Clear references
        this._images = [];
        this._loadedCount = 0;
        this._errorCount = 0;
        this._isDestroyed = true;
    }

    /**
     * Check if gallery instance is destroyed
     */
    get isDestroyed(): boolean {
        return this._isDestroyed;
    }
}