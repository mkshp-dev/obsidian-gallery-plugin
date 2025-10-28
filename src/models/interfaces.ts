/**
 * Core interfaces for the Gallery Plugin
 * Based on contracts defined in contracts/interfaces.md
 */

export interface IGalleryConfig {
  /** Target folder or file path */
  path: string;
  
  /** Display view type */
  view?: 'thumbnail' | 'carousel' | 'grid';
  
  /** Include subdirectories (default: true) */
  recursive?: boolean;
}

export interface IImageSource {
  /** Vault-relative path to image file */
  path: string;
  
  /** Browser-compatible resource URL for loading */
  resourceUrl?: string;
  
  /** Source type */
  type: 'local' | 'external';
  
  /** Display name for user */
  displayName: string;
  
  /** File size in bytes (local files only) */
  size?: number;
  
  /** Image dimensions when available */
  dimensions?: {
    width: number;
    height: number;
  };
  
  /** Current loading state */
  loadState: 'pending' | 'loading' | 'loaded' | 'error';
  
  /** Error message if loading failed */
  errorMessage?: string;
  
  /** Loading timestamp for timeout tracking */
  loadStartTime?: number;

  /** Mark image as loading and record start time */
  startLoading(): void;

  /** Mark image as successfully loaded */
  markLoaded(dimensions?: { width: number; height: number }): void;

  /** Mark image as failed to load */
  markError(error: string): void;

  /** Reset loading state to pending */
  reset(): void;

  /** Check if image can be retried */
  canRetry(): boolean;

  /** Get the URL that should be used for loading in the browser */
  getDisplayUrl(): string;

  /** Validate file size against maximum limit */
  validateSize(sizeBytes: number): boolean;
}

export interface IGalleryView {
  /** View type identifier */
  readonly type: 'thumbnail' | 'carousel' | 'grid';
  
  /** DOM container element */
  readonly container: HTMLElement;
  
  /** Current images being displayed */
  readonly images: IImageSource[];
  
  /** Render initial gallery */
  render(): void;
  
  /** Update with new image list */
  update(images: IImageSource[]): void;
  
  /** Clean up resources */
  destroy(): void;
  
  /** Handle successful image load */
  handleImageLoad(image: IImageSource): void;
  
  /** Handle image load error */
  handleImageError(image: IImageSource, error: Error): void;
  
  /** Check if image is in viewport (for lazy loading) */
  isImageVisible(image: IImageSource): boolean;
}

export interface IContentScanner {
  /** Scan path for images */
  scanPath(path: string, recursive?: boolean): Promise<IImageSource[]>;
  
  /** Check if file is supported image format */
  isImageFile(path: string): boolean;
  
  /** Extract image links from markdown file */
  extractLinksFromFile(file: any): Promise<IImageSource[]>; // any for TFile from Obsidian
  
  /** Validate image source accessibility */
  validateImageSource(source: IImageSource): Promise<boolean>;
  
  /** Clear cache for path */
  invalidateCache(path: string): void;

  /** Get cache statistics */
  getCacheStats?(): { entries: number; size: number };

  /** Cleanup resources */
  destroy?(): void;
}

export interface IGalleryInstance {
  /** Unique identifier for this gallery */
  readonly id: string;
  
  /** Gallery configuration */
  readonly config: IGalleryConfig;
  
  /** List of images to display */
  readonly images: IImageSource[];
  
  /** DOM container element */
  readonly container: HTMLElement;
  
  /** Current view renderer */
  readonly view: IGalleryView;
  
  /** Number of successfully loaded images */
  readonly loadedCount: number;
  
  /** Number of failed image loads */
  readonly errorCount: number;
  
  /** Update gallery with new images */
  update(images: IImageSource[]): void;
  
  /** Destroy gallery and clean up resources */
  destroy(): void;
}

export interface IConfigError {
  type: 'config';
  field: string;
  message: string;
  suggestion?: string;
}

export interface ILoadError {
  type: 'load';
  source: IImageSource;
  reason: 'timeout' | 'not_found' | 'invalid_format' | 'network_error' | 'too_large';
  message: string;
  retryable: boolean;
}

export interface IGalleryEvents {
  'gallery:created': { instance: IGalleryInstance };
  'gallery:updated': { instance: IGalleryInstance; changes: string[] };
  'gallery:destroyed': { instanceId: string };
  'image:loaded': { source: IImageSource };
  'image:error': { source: IImageSource; error: ILoadError };
  'view:changed': { instance: IGalleryInstance; newView: string };
}

/**
 * Factory interface for creating gallery views
 */
export interface IViewFactory {
  /** Create a view renderer of the specified type */
  createView(type: string, container: HTMLElement): IGalleryView;
  
  /** Get list of supported view types */
  getSupportedTypes(): string[];
  
  /** Register a new view type */
  registerViewType(type: string, viewClass: new (container: HTMLElement) => IGalleryView): void;
}