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

        // Clear existing content
        this.container.empty();
        
        if (this._images.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Create grid container
        const gridContainer = this.container.createEl('div', {
            cls: 'gallery-thumbnail-grid'
        });

        // Render each image thumbnail
        this._images.forEach(image => {
            this.renderThumbnailItem(gridContainer, image);
        });

        console.log(`Thumbnail view rendered with ${this._images.length} images`);
    }

    /**
     * Render empty state
     */
    private renderEmptyState(): void {
        const emptyEl = this.container.createEl('div', { cls: 'gallery-empty' });
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-icon',
            text: '🖼️'
        });
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-message',
            text: 'No images found'
        });
    }

    /**
     * Render individual thumbnail item
     */
    private renderThumbnailItem(container: HTMLElement, image: IImageSource): void {
        const itemEl = container.createEl('div', {
            cls: 'gallery-thumbnail-item',
            attr: {
                'data-image-path': image.path,
                'data-image-type': image.type,
                'tabindex': '0'
            }
        });

        // Add click handler for image expansion
        itemEl.addEventListener('click', () => this.expandImage(image));
        itemEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.expandImage(image);
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

        // Set initial opacity to 0 for fade-in effect
        imgEl.style.opacity = '0';

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
            img.onload = () => {
                this.onImageLoaded(image, container, img);
            };
            
            img.onerror = () => {
                this.onImageError(image, container, new Error('Failed to load image'));
            };

            // Set timeout for external URLs
            if (image.type === 'external') {
                setTimeout(() => {
                    if (image.loadState === 'loading') {
                        img.onload = null;
                        img.onerror = null;
                        this.onImageError(image, container, new Error('Image loading timed out'));
                    }
                }, 10000); // 10 second timeout
            }

            img.src = image.path;

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
            imgEl.style.opacity = '1';
        }

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
     * Expand image in modal/lightbox
     */
    private expandImage(image: IImageSource): void {
        // Create modal overlay
        const modal = document.body.createEl('div', { cls: 'gallery-modal' });
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Close on escape key
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);

        // Create modal content
        const content = modal.createEl('div', { cls: 'gallery-modal-content' });
        
        // Close button
        const closeBtn = content.createEl('button', { 
            cls: 'gallery-modal-close',
            text: '×'
        });
        closeBtn.addEventListener('click', () => this.closeModal(modal));

        // Image info
        const info = content.createEl('div', { cls: 'gallery-modal-info' });
        info.createEl('h3', { text: image.displayName });
        
        if (image.dimensions) {
            info.createEl('p', { 
                text: `${image.dimensions.width} × ${image.dimensions.height}` 
            });
        }
        
        if (image.size) {
            info.createEl('p', { text: this.formatFileSize(image.size) });
        }

        // Image container
        const imgContainer = content.createEl('div', { cls: 'gallery-modal-image' });
        const img = imgContainer.createEl('img', {
            attr: { 
                'src': image.path,
                'alt': image.displayName
            }
        });

        img.addEventListener('load', () => {
            modal.addClass('gallery-modal-loaded');
        });
    }

    /**
     * Close modal
     */
    private closeModal(modal: HTMLElement): void {
        modal.addClass('gallery-modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 200);
    }

    /**
     * Format file size for display
     */
    private formatFileSize(bytes: number): string {
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