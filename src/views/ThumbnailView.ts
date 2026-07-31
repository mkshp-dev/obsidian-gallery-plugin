import { Logger } from "../utils/Logger";
import { GalleryView } from './GalleryView';
import { IImageSource } from '../models/interfaces';

/**
 * Thumbnail grid view renderer
 * Displays images in a responsive grid layout with lazy loading
 */
export class ThumbnailView extends GalleryView {
    private lazyLoadObserver: IntersectionObserver | null = null;
    private loadedImages: Set<string> = new Set();
    private readonly maxConcurrentLoads = 10;
    private currentLoads = 0;


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
                            void this.loadImage(imagePath, entry.target as HTMLElement);
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

        // Clear existing content
        this.container.empty();
        
        if (this._images.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Create grid container
        const gridContainer = this.container.createDiv({
            cls: 'gallery-thumbnail-grid'
        });

        // Render each image thumbnail (pass index for size variations)
        this._images.forEach((image, idx) => {
            this.renderThumbnailItem(gridContainer, image, idx);
        });

        Logger.debug(`Thumbnail view rendered with ${this._images.length} images`);
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
    private renderThumbnailItem(container: HTMLElement, image: IImageSource, idx: number): void {
        const itemEl = container.createDiv({
            cls: 'gallery-thumbnail-item',
            attr: {
                'data-image-path': image.path,
                'data-image-type': image.type,
                'tabindex': '0'
            }
        });

        // Add occasional larger/tall items for a more varied masonry look
        // Use less frequent intervals so large items are rarer and don't
        // dominate vertical space.
        if (idx % 12 === 0) {
            itemEl.classList.add('gallery-thumbnail-item--large');
        } else if (idx % 23 === 0) {
            itemEl.classList.add('gallery-thumbnail-item--tall');
        }

        // Accessibility: expose as button and provide an accessible name
        itemEl.setAttribute('role', 'button');
        itemEl.setAttribute('aria-label', image.displayName || 'Gallery image');

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
                'alt': image.displayName,
                'loading': 'lazy'
            }
        });

        // Caption overlay (visible on hover/focus only when persistent captions are disabled)
        if (!this.showCaptions) {
            itemEl.createDiv({ cls: 'gallery-thumbnail-caption', text: image.displayName || '' });
        }

        // Persistent subtitle caption (always visible when enabled)
        this.renderCaption(itemEl, image);

        // Set initial opacity to 0 for fade-in effect
        imgEl.setCssStyles({ opacity: '0' });

        // Add to lazy loading observer
        if (this.lazyLoadObserver) {
            this.lazyLoadObserver.observe(itemEl);
        } else {
            // Fallback: load immediately if no IntersectionObserver
            void this.loadImage(image.path, itemEl);
        }

        // Add loading spinner
        this.showLoadingState(itemEl);
    }

    /**
     * Load image with concurrency control
     */
    private async loadImage(imagePath: string, container: HTMLElement): Promise<void> {
        if (this.loadedImages.has(imagePath) || this.currentLoads >= this.maxConcurrentLoads) {
            return;
        }

        this.currentLoads++;
        this.loadedImages.add(imagePath);

        const image = this._images.find(img => img.path === imagePath);
        if (!image) {
            this.currentLoads--;
            return;
        }

        try {
            image.startLoading();
            
            // Create new image element for loading
            const img = new Image();
            // Set timeout for external URLs (use view-provided timeout when available)
            let timeoutHandle: number | undefined = undefined;

            img.onload = () => {
                window.clearTimeout(timeoutHandle);
                this.onImageLoaded(image, container, img);
            };

            img.onerror = () => {
                window.clearTimeout(timeoutHandle);
                this.onImageError(image, container, new Error('Failed to load image'));
            };

            // Block external images when remote loading is disabled
            if (image.type === 'external' && !this.allowRemoteImages) {
                this.onImageError(image, container, new Error('External images are blocked by settings'));
            } else {
                if (image.type === 'external') {
                    const timeoutMs = this.remoteLoadTimeoutMs ?? 10000;
                    timeoutHandle = window.setTimeout(() => {
                        if (image.loadState === 'loading') {
                            img.onload = null;
                            img.onerror = null;
                            this.onImageError(image, container, new Error('Image loading timed out'));
                        }
                    }, timeoutMs);
                }

                img.src = image.getDisplayUrl();
            }

        } catch (error) {
            this.onImageError(image, container, error as Error);
        } finally {
            this.currentLoads--;
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