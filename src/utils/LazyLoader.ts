/**
 * Lazy loading utility using Intersection Observer API
 * Optimizes gallery performance by loading images only when needed
 */

export interface ILazyLoadOptions {
  rootMargin?: string;
  threshold?: number | number[];
  loadingClass?: string;
  loadedClass?: string;
  errorClass?: string;
  placeholderSrc?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ILazyLoadResult {
  success: boolean;
  element: HTMLImageElement;
  error?: string;
  loadTime: number;
  retryCount: number;
}

export class LazyLoader {
  private observer: IntersectionObserver | null = null;
  private options: Required<ILazyLoadOptions>;
  private loadingElements = new Map<HTMLImageElement, { src: string; retryCount: number }>();
  private loadedElements = new Set<HTMLImageElement>();

  private static readonly DEFAULT_OPTIONS: Required<ILazyLoadOptions> = {
    rootMargin: '50px',
    threshold: 0.1,
    loadingClass: 'lazy-loading',
    loadedClass: 'lazy-loaded',
    errorClass: 'lazy-error',
    placeholderSrc: '',
    retryAttempts: 3,
    retryDelay: 1000
  };

  constructor(options: ILazyLoadOptions = {}) {
    this.options = { ...LazyLoader.DEFAULT_OPTIONS, ...options };
    this.initializeObserver();
  }

  /**
   * Initialize the Intersection Observer
   */
  private initializeObserver(): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      return;
    }

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );
  }

  /**
   * Handle intersection observer entries
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.observer?.unobserve(img);
      }
    });
  }

  /**
   * Add an image element for lazy loading
   */
  observe(img: HTMLImageElement, src: string): void {
    if (this.loadedElements.has(img)) {
      return; // Already loaded
    }

    // Store the actual src and set placeholder
    this.loadingElements.set(img, { src, retryCount: 0 });

    // Set placeholder if provided
    if (this.options.placeholderSrc) {
      img.src = this.options.placeholderSrc;
    }

    // Add loading class
    img.classList.add(this.options.loadingClass);

    // Use observer if available, otherwise load immediately
    if (this.observer) {
      this.observer.observe(img);
    } else {
      this.loadImage(img);
    }
  }

  /**
   * Load multiple images
   */
  observeMultiple(images: Array<{ element: HTMLImageElement; src: string }>): void {
    images.forEach(({ element, src }) => {
      this.observe(element, src);
    });
  }

  /**
   * Actually load the image
   */
  private async loadImage(img: HTMLImageElement): Promise<ILazyLoadResult> {
    const startTime = Date.now();
    const imageData = this.loadingElements.get(img);

    if (!imageData) {
      return {
        success: false,
        element: img,
        error: 'Image data not found',
        loadTime: 0,
        retryCount: 0
      };
    }

    const { src, retryCount } = imageData;

    try {
      await this.loadImageWithPromise(img, src);
      
      // Success
      this.loadingElements.delete(img);
      this.loadedElements.add(img);
      
      img.classList.remove(this.options.loadingClass);
      img.classList.add(this.options.loadedClass);

      return {
        success: true,
        element: img,
        loadTime: Date.now() - startTime,
        retryCount
      };

    } catch (error) {
      // Handle retry logic
      if (retryCount < this.options.retryAttempts) {
        const newRetryCount = retryCount + 1;
        this.loadingElements.set(img, { src, retryCount: newRetryCount });
        
        console.log(`Retrying image load (${newRetryCount}/${this.options.retryAttempts}):`, src);
        
        // Retry after delay
        setTimeout(() => {
          this.loadImage(img);
        }, this.options.retryDelay);

        return {
          success: false,
          element: img,
          error: `Loading failed, retrying (${newRetryCount}/${this.options.retryAttempts})`,
          loadTime: Date.now() - startTime,
          retryCount: newRetryCount
        };
      } else {
        // Max retries reached
        this.loadingElements.delete(img);
        
        img.classList.remove(this.options.loadingClass);
        img.classList.add(this.options.errorClass);
        
        // Set error placeholder or alt text
        img.alt = `Failed to load: ${src}`;

        return {
          success: false,
          element: img,
          error: error instanceof Error ? error.message : 'Unknown error',
          loadTime: Date.now() - startTime,
          retryCount
        };
      }
    }
  }

  /**
   * Load image with promise
   */
  private loadImageWithPromise(img: HTMLImageElement, src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tempImg = new Image();
      
      tempImg.onload = () => {
        img.src = src;
        resolve();
      };
      
      tempImg.onerror = () => {
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      // Set loading timeout
      const timeout = setTimeout(() => {
        tempImg.onload = null;
        tempImg.onerror = null;
        reject(new Error(`Image load timeout: ${src}`));
      }, 30000); // 30 second timeout
      
      tempImg.onload = () => {
        clearTimeout(timeout);
        img.src = src;
        resolve();
      };
      
      tempImg.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      tempImg.src = src;
    });
  }

  /**
   * Force load all observed images
   */
  async loadAll(): Promise<ILazyLoadResult[]> {
    const results: ILazyLoadResult[] = [];
    const promises: Promise<ILazyLoadResult>[] = [];

    for (const [img] of this.loadingElements) {
      promises.push(this.loadImage(img));
    }

    return Promise.all(promises);
  }

  /**
   * Stop observing an image
   */
  unobserve(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(img);
    }
    this.loadingElements.delete(img);
    this.loadedElements.delete(img);
  }

  /**
   * Stop observing all images
   */
  unobserveAll(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.loadingElements.clear();
    this.loadedElements.clear();
  }

  /**
   * Disconnect the observer
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.loadingElements.clear();
    this.loadedElements.clear();
  }

  /**
   * Check if IntersectionObserver is supported
   */
  static isSupported(): boolean {
    return 'IntersectionObserver' in window;
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loading: number;
    loaded: number;
    total: number;
    supportsObserver: boolean;
  } {
    return {
      loading: this.loadingElements.size,
      loaded: this.loadedElements.size,
      total: this.loadingElements.size + this.loadedElements.size,
      supportsObserver: LazyLoader.isSupported()
    };
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<ILazyLoadOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Reinitialize observer if options changed
    if (this.observer) {
      this.observer.disconnect();
      this.initializeObserver();
      
      // Re-observe all loading elements
      for (const [img] of this.loadingElements) {
        if (this.observer) {
          this.observer.observe(img);
        }
      }
    }
  }

  /**
   * Create a simple placeholder data URL
   */
  static createPlaceholderDataUrl(
    width: number = 200, 
    height: number = 150, 
    color: string = '#f0f0f0',
    textColor: string = '#999'
  ): string {
    // Fallback 1x1 transparent PNG data URI (used when canvas isn't available in test env)
    const FALLBACK_DATA_URI =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx || typeof canvas.toDataURL !== 'function') {
        return FALLBACK_DATA_URI;
      }

      // Background
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);

      // Border
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      // Loading text
      ctx.fillStyle = textColor;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading...', width / 2, height / 2);

      return canvas.toDataURL();
    } catch (e) {
      // In constrained environments (like jsdom in CI), canvas APIs may not be available.
      // Return a minimal transparent PNG data URI as a safe fallback.
      return FALLBACK_DATA_URI;
    }
  }

  /**
   * Retry failed images
   */
  retryFailed(): void {
    const failedImages = document.querySelectorAll(`.${this.options.errorClass}`);
    
    failedImages.forEach(img => {
      if (img instanceof HTMLImageElement) {
        const originalSrc = img.dataset.src;
        if (originalSrc) {
          img.classList.remove(this.options.errorClass);
          this.observe(img, originalSrc);
        }
      }
    });
  }

  /**
   * Set loading state for all images
   */
  setAllLoading(): void {
    this.loadingElements.forEach((_, img) => {
      img.classList.add(this.options.loadingClass);
      img.classList.remove(this.options.loadedClass, this.options.errorClass);
    });
  }

  /**
   * Create lazy loading setup for gallery
   */
  static createForGallery(
    container: HTMLElement, 
    images: Array<{ src: string; alt?: string }>,
    options: ILazyLoadOptions = {}
  ): LazyLoader {
    const loader = new LazyLoader(options);
    
    images.forEach(({ src, alt }, index) => {
      const img = document.createElement('img');
      img.alt = alt || `Gallery image ${index + 1}`;
      img.dataset.src = src;
      
      container.appendChild(img);
      loader.observe(img, src);
    });
    
    return loader;
  }
}