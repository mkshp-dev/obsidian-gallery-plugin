/**
 * Gallery View Adapter
 * Bridges the existing view system with the main plugin logic
 */

import { ThumbnailView } from '../views/ThumbnailView';
import { IImageSource, IGalleryConfig } from '../models/interfaces';
import { LazyLoader } from '../utils/LazyLoader';
import { ErrorManager } from '../views/components/ErrorPlaceholder';

export interface IImageItem {
  path: string;
  name: string;
  originalPath?: string;
  alt?: string;
}

/**
 * ImageSource implementation that matches the interface (legacy adapter)
 */
class LegacyImageSource implements IImageSource {
  path: string;
  resourceUrl?: string;
  type: 'local' | 'external';
  displayName: string;
  size?: number;
  dimensions?: { width: number; height: number };
  loadState: 'pending' | 'loading' | 'loaded' | 'error' = 'pending';
  errorMessage?: string;
  loadStartTime?: number;

  constructor(item: IImageItem) {
    this.path = item.path;
    this.type = item.path.startsWith('http') ? 'external' : 'local';
    this.displayName = item.name;
  }

  startLoading(): void {
    this.loadState = 'loading';
    this.loadStartTime = Date.now();
  }

  markLoaded(dimensions?: { width: number; height: number }): void {
    this.loadState = 'loaded';
    if (dimensions) {
      this.dimensions = dimensions;
    }
  }

  markError(error: string): void {
    this.loadState = 'error';
    this.errorMessage = error;
  }

  reset(): void {
    this.loadState = 'pending';
    this.errorMessage = undefined;
    this.loadStartTime = undefined;
  }

  canRetry(): boolean {
    return this.loadState === 'error';
  }

  getDisplayUrl(): string {
    if (this.type === 'local' && this.resourceUrl) {
      return this.resourceUrl;
    }
    return this.path;
  }

  validateSize(maxSize: number): boolean {
    return !this.size || this.size <= maxSize;
  }

  isLoaded(): boolean {
    return this.loadState === 'loaded';
  }

  hasError(): boolean {
    return this.loadState === 'error';
  }

  getLoadDuration(): number {
    if (!this.loadStartTime) return 0;
    return Date.now() - this.loadStartTime;
  }
}

export class GalleryViewAdapter {
  private thumbnailView: ThumbnailView | null = null;
  private lazyLoader: LazyLoader | null = null;
  private onImageClick?: (image: IImageItem) => void;

  constructor(private container: HTMLElement, lazyLoader?: LazyLoader) {
    this.lazyLoader = lazyLoader || null;
  }

  /**
   * Convert our image format to the interface format expected by existing views
   */
  private convertImagesToSources(images: IImageItem[]): IImageSource[] {
    return images.map(image => new LegacyImageSource(image));
  }

  /**
   * Render images using the existing ThumbnailView
   */
  async render(images: IImageItem[], config: { view?: string } = {}): Promise<void> {
    // Create thumbnail view instance
    this.thumbnailView = new ThumbnailView(this.container);
    
    // Convert images to the expected format
    const imageSources = this.convertImagesToSources(images);
    
    // Update the view with images (uses update method from base class)
    this.thumbnailView.update(imageSources);
    
    // Set up click handler if we have one
    if (this.onImageClick) {
      this.setupClickHandler();
    }
  }

  /**
   * Set up click handler to bridge between view system and our modal logic
   */
  private setupClickHandler(): void {
    if (!this.thumbnailView || !this.onImageClick) return;

    // The existing ThumbnailView should emit click events
    // We need to listen for them and convert back to our format
    this.container.addEventListener('click', (e) => {
      const imageElement = e.target as HTMLElement;
      const thumbnailItem = imageElement.closest('.gallery-thumbnail-item');
      
      if (thumbnailItem && this.onImageClick) {
        const imagePath = imageElement.getAttribute('data-image-path') || 
                         imageElement.getAttribute('src') || '';
        const imageAlt = imageElement.getAttribute('alt') || '';
        
        // Convert back to our image format
        const image: IImageItem = {
          path: imagePath,
          name: imageAlt,
          alt: imageAlt
        };
        
        this.onImageClick(image);
      }
    });
  }

  /**
   * Set click handler for thumbnail clicks
   */
  setOnImageClick(handler: (image: IImageItem) => void): void {
    this.onImageClick = handler;
    this.setupClickHandler();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.thumbnailView) {
      this.thumbnailView.destroy();
      this.thumbnailView = null;
    }
  }

  /**
   * Get view statistics
   */
  getStats() {
    return this.thumbnailView?.getStats() || {
      totalImages: 0,
      loadedImages: 0,
      errorImages: 0
    };
  }

  /**
   * Refresh the view
   */
  refresh(): void {
    // Re-render with current images (trigger update)
    if (this.thumbnailView && this.thumbnailView['_images']) {
      this.thumbnailView.update(this.thumbnailView['_images']);
    }
  }

  /**
   * Show validation errors using professional error handling
   */
  showValidationErrors(validationErrors: Array<{path: string, errors: string[]}>): void {
    if (!this.container) return;

    const errorManager = new ErrorManager(this.container);

    // Clear any existing validation errors
    errorManager.hideAllErrors();

    // Show validation errors with professional error placeholders
    validationErrors.forEach((item, index) => {
      const errorKey = `validation-${index}`;
      errorManager.showError(errorKey, {
        message: `Validation failed for ${item.path}`,
        details: item.errors.join('; '),
        canRetry: false,
        timestamp: new Date()
      }, {
        type: 'validation',
        size: 'medium',
        showDetails: true,
        showRetry: false
      });
    });
  }

  /**
   * Clear all validation errors
   */
  clearValidationErrors(): void {
    if (!this.container) return;
    
    const errorManager = new ErrorManager(this.container);
    errorManager.hideAllErrors();
  }
}