import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';

/**
 * Thumbnail grid view renderer
 * Displays images in a responsive grid layout with lazy loading
 */
export class ThumbnailView extends GalleryView {
    private lazyLoadObserver: IntersectionObserver | null = null;
    /** Paths whose load has started or is queued in the current render */
    private loadedImages: Set<string> = new Set();
    private readonly maxConcurrentLoads = 10;
    private currentLoads = 0;
    /** Loads waiting for a free slot (at most maxConcurrentLoads run at once) */
    private loadQueue: Array<{ imagePath: string; container: HTMLElement }> = [];
    /** Bumped on every render so loads started for replaced DOM are ignored */
    private renderGeneration = 0;


    constructor(container: HTMLElement) {
        super('thumbnail', container);
        this.setupLazyLoading();
    }

    /**
     * Setup intersection observer for lazy loading
     */
    private setupLazyLoading(): void {
        if ('IntersectionObserver' in window) {
            this.lazyLoadObserver = this.createLazyLoadObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const imagePath = entry.target.getAttribute('data-image-path');
                        if (imagePath && !this.loadedImages.has(imagePath)) {
                            this.loadImage(imagePath, entry.target as HTMLElement);
                        }
                    }
                });
            });
        }
    }

    /**
     * Render thumbnail grid
     */
    render(): void {
        if (this._isDestroyed) return;

        // Clear existing content and forget loads tied to the previous DOM. Every render
        // (including page changes) creates new tiles, so each needs loading again.
        this.container.empty();
        this.lazyLoadObserver?.disconnect();
        this.loadedImages.clear();
        this.loadQueue = [];
        this.currentLoads = 0;
        this.renderGeneration++;
        
        if (this._images.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Create grid container
        const gridContainer = this.container.createDiv({
            cls: 'gallery-thumbnail-grid'
        });

        // Render each image thumbnail
        const pageImages = this.getPageImages();
        pageImages.forEach(image => {
            this.renderThumbnailItem(gridContainer, image);
        });

        this.renderPaginationControls(this.container);
        this.renderWarnings(this.container);

        Logger.debug(`Thumbnail view rendered with ${pageImages.length} of ${this._images.length} images`);
    }

    /**
     * Render empty state
     */
    private renderEmptyState(): void {
        const emptyEl = this.container.createDiv({ cls: 'gallery-empty' });
        emptyEl.createDiv({ 
            cls: 'gallery-empty-icon',
            text: '🖼️'
        });
        emptyEl.createDiv({ 
            cls: 'gallery-empty-message',
            text: 'No images found'
        });
    }

    /**
     * Render individual thumbnail item
     */
    private renderThumbnailItem(container: HTMLElement, image: IImageSource): void {
        const itemEl = container.createDiv({
            cls: 'gallery-thumbnail-item',
            attr: {
                'data-image-path': image.path,
                'data-image-type': image.type,
                'tabindex': '0'
            }
        });

        // Accessibility: expose as button. Its name comes from the image's alt text; an aria-label
        // would also show as an Obsidian tooltip on top of the hover caption.
        itemEl.setAttribute('role', 'button');

        // Add click handler for image expansion
        itemEl.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.expandImage(image);
        });
        itemEl.addEventListener('keydown', (e) => {
            // Activate on Enter or Space
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                this.expandImage(image);
                return;
            }

            // Keyboard navigation: Left/Right arrows move between thumbnails
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const parent = itemEl.parentElement;
                if (!parent) return;
                const items = Array.from(parent.querySelectorAll('.gallery-thumbnail-item')) as unknown as HTMLElement[];
                const idx = items.indexOf(itemEl);
                if (idx === -1) return;

                const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
                if (nextIdx >= 0 && nextIdx < items.length) {
                    items[nextIdx].focus();
                    e.preventDefault();
                }
            }
        });

        // Create placeholder image element
        const imgEl = itemEl.createEl('img', {
            cls: 'gallery-thumbnail-image',
            attr: {
                'alt': image.displayName || 'Gallery image',
                'loading': 'lazy'
            }
        });

        // Caption below the image, or a hover overlay when captions are off
        this.renderCaption(itemEl, image);

        // Set initial opacity to 0 for fade-in effect
        imgEl.setCssStyles({ opacity: '0' });

        // Add to lazy loading observer
        if (this.lazyLoadObserver) {
            this.lazyLoadObserver.observe(itemEl);
        } else {
            // Fallback: load immediately if no IntersectionObserver
            this.loadImage(image.path, itemEl);
        }

        // Add loading spinner
        this.showLoadingState(itemEl);
    }

    /**
     * Load image with concurrency control: at most maxConcurrentLoads run at once, the rest queue
     */
    private loadImage(imagePath: string, container: HTMLElement): void {
        if (this.loadedImages.has(imagePath)) {
            return;
        }
        this.loadedImages.add(imagePath);

        if (this.currentLoads >= this.maxConcurrentLoads) {
            this.loadQueue.push({ imagePath, container });
            return;
        }
        this.startLoad(imagePath, container);
    }

    private startLoad(imagePath: string, container: HTMLElement): void {
        const image = this._images.find(img => img.path === imagePath);
        if (!image) {
            return;
        }

        const generation = this.renderGeneration;
        const isCurrent = () => generation === this.renderGeneration && !this._isDestroyed;
        this.currentLoads++;

        // Frees the slot once the image has loaded or failed (fetch and decode both count)
        const done = () => {
            if (!isCurrent()) return;
            this.currentLoads--;
            const next = this.loadQueue.shift();
            if (next) this.startLoad(next.imagePath, next.container);
        };

        image.startLoading();

        // Block external images when remote loading is disabled
        if (image.type === 'external' && !this.allowRemoteImages) {
            this.onImageError(image, container, new Error('External images are blocked by settings'));
            done();
            return;
        }

        const onLoad = (img: HTMLImageElement) => {
            if (isCurrent()) this.onImageLoaded(image, container, img);
            done();
        };
        const onError = (error: Error) => {
            if (isCurrent()) this.onImageError(image, container, error);
            done();
        };

        if (image.type === 'local') {
            // Vault files: no network involved, so no timeout
            const img = new Image();
            img.onload = () => onLoad(img);
            img.onerror = () => onError(new Error('Failed to load image'));
            this.resolveImageUrl(image)
                .then(url => { img.src = url; })
                .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))));
        } else {
            // Remote images (fetched on demand or loaded from a URL) honor the remote load timeout
            this.loadWithTimeout(image, onLoad, onError);
        }
    }

    /**
     * Handle successful image load
     */
    private onImageLoaded(image: IImageSource, container: HTMLElement, img: HTMLImageElement): void {
        image.markLoaded({ width: img.naturalWidth, height: img.naturalHeight });
        
        // Update container image
        const imgEl = container.querySelector('img') as HTMLImageElement;
        if (imgEl) {
            imgEl.src = img.src;
            imgEl.setCssStyles({ opacity: '1' });
        }

        // We intentionally do not compute grid-row spans here anymore.
        // Thumbnails use a fixed-ish tile height and images are centered with
        // object-fit:contain to preserve aspect ratio while rendering smaller.

        // Remove loading state
        this.showLoadedState(container, image);
        this.handleImageLoad(image);
    }

    /**
     * Handle image load error
     */
    private onImageError(image: IImageSource, container: HTMLElement, error: Error): void {
        image.markError(error.message);
        this.showErrorState(container, image);
        this.handleImageError(image, error);
    }



    /**
     * Update view with new images
     */
    update(images: IImageSource[]): void {
        // Reset loaded images tracking
        this.loadedImages.clear();
        super.update(images);
    }

    /**
     * Destroy thumbnail view
     */
    destroy(): void {
        if (this.lazyLoadObserver) {
            this.lazyLoadObserver.disconnect();
            this.lazyLoadObserver = null;
        }
        
        this.loadedImages.clear();
        this.loadQueue = [];
        super.destroy();
    }

    /**
     * Check if image is visible (for external lazy loading checks)
     */
    isImageVisible(image: IImageSource): boolean {
        return super.isImageVisible(image);
    }

    /**
     * Get view statistics
     */
    getStats(): {
        totalImages: number;
        loadedImages: number;
        pendingImages: number;
        errorImages: number;
    } {
        const loaded = this._images.filter(img => img.loadState === 'loaded').length;
        const pending = this._images.filter(img => img.loadState === 'pending').length;
        const error = this._images.filter(img => img.loadState === 'error').length;

        return {
            totalImages: this._images.length,
            loadedImages: loaded,
            pendingImages: pending,
            errorImages: error
        };
    }
}