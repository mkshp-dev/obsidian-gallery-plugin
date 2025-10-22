/**
 * Image loading utility with timeout and error handling
 * Provides robust image loading for gallery components
 */

export interface IImageLoadResult {
  success: boolean;
  element?: HTMLImageElement;
  error?: string;
  loadTime?: number;
}

export interface IImageLoadOptions {
  timeout?: number;
  crossOrigin?: string | null;
  referrerPolicy?: string;
  loading?: 'lazy' | 'eager';
}

export class ImageLoader {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_OPTIONS: IImageLoadOptions = {
    timeout: ImageLoader.DEFAULT_TIMEOUT,
    crossOrigin: null,
    referrerPolicy: 'no-referrer-when-downgrade',
    loading: 'lazy'
  };

  /**
   * Load an image with timeout and error handling
   */
  static async loadImage(src: string, options: IImageLoadOptions = {}): Promise<IImageLoadResult> {
    const startTime = Date.now();
    const config = { ...this.DEFAULT_OPTIONS, ...options };

    return new Promise((resolve) => {
      const img = new Image();
      let isResolved = false;

      // Timeout handler
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve({
            success: false,
            error: `Image loading timeout after ${config.timeout}ms`,
            loadTime: Date.now() - startTime
          });
        }
      }, config.timeout);

      // Success handler
      img.onload = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: true,
            element: img,
            loadTime: Date.now() - startTime
          });
        }
      };

      // Error handler
      img.onerror = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'Failed to load image',
            loadTime: Date.now() - startTime
          });
        }
      };

      // Abort handler (for fetch-based loading)
      img.onabort = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'Image loading was aborted',
            loadTime: Date.now() - startTime
          });
        }
      };

      // Configure image properties
      if (config.crossOrigin !== null) {
        img.crossOrigin = config.crossOrigin || 'anonymous';
      }
      
      if (config.referrerPolicy) {
        img.referrerPolicy = config.referrerPolicy;
      }

      if (config.loading) {
        img.loading = config.loading;
      }

      // Start loading
      img.src = src;
    });
  }

  /**
   * Load multiple images concurrently with individual timeout handling
   */
  static async loadImages(sources: string[], options: IImageLoadOptions = {}): Promise<IImageLoadResult[]> {
    const promises = sources.map(src => this.loadImage(src, options));
    return Promise.all(promises);
  }

  /**
   * Load images with progress callback
   */
  static async loadImagesWithProgress(
    sources: string[], 
    onProgress: (loaded: number, total: number, result: IImageLoadResult) => void,
    options: IImageLoadOptions = {}
  ): Promise<IImageLoadResult[]> {
    const results: IImageLoadResult[] = [];
    let loaded = 0;

    for (const src of sources) {
      const result = await this.loadImage(src, options);
      results.push(result);
      loaded++;
      onProgress(loaded, sources.length, result);
    }

    return results;
  }

  /**
   * Preload image and return a promise that resolves when ready
   */
  static async preloadImage(src: string, options: IImageLoadOptions = {}): Promise<boolean> {
    const result = await this.loadImage(src, options);
    return result.success;
  }

  /**
   * Check if an image URL is loadable (quick validation)
   */
  static async validateImageUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const contentType = response.headers.get('Content-Type');
      return contentType ? contentType.startsWith('image/') : false;

    } catch (error) {
      return false;
    }
  }

  /**
   * Create a placeholder image element while loading
   */
  static createPlaceholder(width: number = 200, height: number = 200, text: string = 'Loading...'): HTMLImageElement {
    const img = new Image();
    
    // Create a simple placeholder using data URL
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Gray background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      
      // Border
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);
      
      // Text
      ctx.fillStyle = '#666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);
    }
    
    img.src = canvas.toDataURL();
    img.alt = text;
    
    return img;
  }

  /**
   * Create an error placeholder image
   */
  static createErrorPlaceholder(width: number = 200, height: number = 200, errorMessage: string = 'Failed to load'): HTMLImageElement {
    const img = new Image();
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Light red background
      ctx.fillStyle = '#fee';
      ctx.fillRect(0, 0, width, height);
      
      // Red border
      ctx.strokeStyle = '#fcc';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);
      
      // Error text
      ctx.fillStyle = '#c44';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Split long error messages
      const lines = errorMessage.length > 20 ? 
        [errorMessage.substring(0, 18) + '...'] : 
        [errorMessage];
      
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, height / 2 + (index * 16));
      });
    }
    
    img.src = canvas.toDataURL();
    img.alt = errorMessage;
    
    return img;
  }

  /**
   * Get default timeout value
   */
  static getDefaultTimeout(): number {
    return this.DEFAULT_TIMEOUT;
  }
}