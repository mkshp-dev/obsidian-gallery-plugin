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
    private lastFocusedElement: HTMLElement | null = null;

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

        // Render each image thumbnail (pass index for size variations)
        this._images.forEach((image, idx) => {
            this.renderThumbnailItem(gridContainer, image, idx);
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
    private renderThumbnailItem(container: HTMLElement, image: IImageSource, idx: number): void {
        const itemEl = container.createEl('div', {
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
        itemEl.addEventListener('click', () => this.expandImage(image));
        itemEl.addEventListener('keydown', (e) => {
            // Activate on Enter or Space
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.expandImage(image);
                return;
            }

            // Keyboard navigation: Left/Right arrows move between thumbnails
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const parent = itemEl.parentElement;
                if (!parent) return;
                const items = Array.from(parent.querySelectorAll('.gallery-thumbnail-item')) as HTMLElement[];
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

        // Caption overlay (visible on hover/focus)
        const caption = itemEl.createEl('div', { cls: 'gallery-thumbnail-caption' });
        caption.textContent = image.displayName || '';

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

            // Block external images when remote loading is disabled
                if (image.type === 'external' && !this.allowRemoteImages) {
                this.onImageError(image, container, new Error('External images are blocked by settings'));
            } else {
                // Set timeout for external URLs (use view-provided timeout when available)
                let timeoutHandle: any = null;
                if (image.type === 'external') {
                        const timeoutMs = this.remoteLoadTimeoutMs ?? 10000;
                    timeoutHandle = setTimeout(() => {
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
            imgEl.style.opacity = '1';
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
     * Expand image in modal/lightbox
     */
    private expandImage(image: IImageSource): void {
        // Save the element that had focus so we can restore it later
        const active = document.activeElement;
        if (active && active instanceof HTMLElement) {
            this.lastFocusedElement = active;
        }

        // Create modal overlay using ownerDocument for compatibility with different rendering contexts
    const doc = this.container.ownerDocument || document;
    const modal = doc.createElement('div');
        modal.className = 'gallery-modal';
        // Accessibility: treat modal as dialog
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', image.displayName || 'Image dialog');
        
        // Close on click outside
        modal.addEventListener('click', (e: MouseEvent) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

    // Track current image for modal navigation
    let currentImage = image;

    // Close on escape key and trap focus
        const closeOnEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                doc.removeEventListener('keydown', closeOnEscape as any);
                doc.removeEventListener('focus', keepFocus as any, true);
                doc.removeEventListener('keydown', modalKeyHandler as any);
            }
    };
    // Attach close handler to the modal (avoid document-level handler to prevent double firing)
    modal.addEventListener('keydown', closeOnEscape as any);

        // Keep focus inside modal (simple trap)
        const keepFocus = (e: Event) => {
            if (!modal.contains(doc.activeElement)) {
                // Focus the close button as a sensible default
                const btn = modal.querySelector('.gallery-modal-close') as HTMLElement | null;
                if (btn) btn.focus();
            }
        };
        doc.addEventListener('focus', keepFocus as any, true);

    // Modal keyboard handler for navigation (Left/Right) and Escape handled above
        const modalKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const currentIndex = this._images.findIndex(img => img.path === currentImage.path);
                if (currentIndex === -1) return;
                const nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
                if (nextIndex >= 0 && nextIndex < this._images.length) {
                    const nextImage = this._images[nextIndex];
                    // Update modal image and info
                    const imgEl = modal.querySelector('.gallery-modal-image img') as HTMLImageElement | null;
                    const titleEl = modal.querySelector('.gallery-modal-info h3') as HTMLElement | null;
                    if (imgEl && nextImage) {
                        imgEl.src = nextImage.getDisplayUrl();
                    }
                    if (titleEl && nextImage) {
                        titleEl.textContent = nextImage.displayName || '';
                    }
                    // Update reference image for further navigation
                    currentImage = nextImage;
                }
            }
        };
    // Attach keydown handler to the modal only to avoid duplicate handling
    modal.addEventListener('keydown', modalKeyHandler as any);

        // Attach cleanup function to modal for safe removal
        const cleanup = () => {
            try {
                modal.removeEventListener('keydown', closeOnEscape as any);
                doc.removeEventListener('focus', keepFocus as any, true);
                modal.removeEventListener('keydown', modalKeyHandler as any);
            } catch {}
        };
        (modal as any).__cleanup = cleanup;

        // Create modal content
        const content = (modal as any).createEl('div', { cls: 'gallery-modal-content' });

        // Close button
        const closeBtn = (content as any).createEl('button', {
            cls: 'gallery-modal-close',
            text: '×'
        });
        closeBtn.addEventListener('click', () => this.closeModal(modal));
        // Accessibility: make close button focusable and labelled
        closeBtn.setAttribute('aria-label', 'Close image dialog');
        closeBtn.setAttribute('role', 'button');

        // Make modal focusable and focus it so it receives key events
        modal.setAttribute('tabindex', '-1');
        setTimeout(() => {
            try {
                modal.focus();
            } catch {}
            // Also focus close button as a visible focus target
            try { closeBtn.focus(); } catch {}
        }, 0);

        // Create Prev/Next buttons for modal navigation (mouse-friendly)
        const prevBtn = (content as any).createEl('button', {
            cls: 'gallery-modal-nav prev',
            text: '\u2039' // single left-pointing angle quotation mark
        }) as HTMLElement;
        prevBtn.setAttribute('aria-label', 'Previous image');
        prevBtn.addEventListener('click', () => navigate(-1));

        const nextBtn = (content as any).createEl('button', {
            cls: 'gallery-modal-nav next',
            text: '\u203A' // single right-pointing angle quotation mark
        }) as HTMLElement;
        nextBtn.setAttribute('aria-label', 'Next image');
        nextBtn.addEventListener('click', () => navigate(1));

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
        const imgContainer = (content as any).createEl('div', { cls: 'gallery-modal-image' });
        const img = (imgContainer as any).createEl('img', {
            attr: {
                'alt': image.displayName
            }
        });

        // Load modal image respecting remote settings and timeout
        const loadModalImage = (imgEl: HTMLImageElement, srcImage: IImageSource) => {
            if (srcImage.type === 'external' && !(this as any).allowRemoteImages) {
                imgEl.alt = 'External image blocked';
                // Optionally show a placeholder class
                imgEl.classList.add('gallery-external-blocked');
                return;
            }

            const temp = new Image();
            let timeoutHandle: any = null;

            const onLoad = () => {
                clearTimeout(timeoutHandle);
                try { imgEl.src = temp.src; } catch {}
                (modal as any).addClass && (modal as any).addClass('gallery-modal-loaded');
                cleanup();
            };

            const onError = () => {
                clearTimeout(timeoutHandle);
                imgEl.alt = 'Failed to load';
                cleanup();
            };

            const cleanup = () => {
                temp.onload = null;
                temp.onerror = null;
            };

            temp.onload = onLoad;
            temp.onerror = onError;

                timeoutHandle = setTimeout(() => {
                    onError();
                }, this.remoteLoadTimeoutMs ?? 10000);

            try { temp.src = srcImage.getDisplayUrl(); } catch (e) { onError(); }
        };

        loadModalImage(img as HTMLImageElement, image);

        // Navigation helper: move by delta (-1 or 1)
        const navigate = (delta: number) => {
            const currentIndex = this._images.findIndex(imgSrc => imgSrc.path === currentImage.path);
            if (currentIndex === -1) return;
            const nextIndex = currentIndex + delta;
            if (nextIndex < 0 || nextIndex >= this._images.length) return;

            const nextImage = this._images[nextIndex];
            const modalImg = modal.querySelector('.gallery-modal-image img') as HTMLImageElement | null;
            const titleEl = modal.querySelector('.gallery-modal-info h3') as HTMLElement | null;
            if (modalImg && nextImage) {
                modalImg.src = nextImage.getDisplayUrl();
                modalImg.alt = nextImage.displayName || '';
            }
            if (titleEl && nextImage) {
                titleEl.textContent = nextImage.displayName || '';
            }
            currentImage = nextImage;
        };

        // Append modal to document body
        try {
            doc.body.appendChild(modal);
        } catch (appendErr) {
            console.warn('Failed to append modal to document body, falling back to document.body:', appendErr);
            document.body.appendChild(modal);
        }
    }

    /**
     * Close modal
     */
    private closeModal(modal: HTMLElement): void {
        (modal as any).addClass && (modal as any).addClass('gallery-modal-closing');
        // Call modal-specific cleanup if present
        try {
            const cleanup = (modal as any).__cleanup as (() => void) | undefined;
            if (cleanup) cleanup();
        } catch {}

        setTimeout(() => {
            modal.remove();
            // Restore focus to previously focused element
            if (this.lastFocusedElement) {
                try { this.lastFocusedElement.focus(); } catch {}
                this.lastFocusedElement = null;
            }
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