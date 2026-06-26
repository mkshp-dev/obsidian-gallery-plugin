/**
 * Core interfaces for the Gallery Plugin
 * Based on contracts defined in contracts/interfaces.md
 */

export interface ILocalSourceConfig {
  type: 'local';
  path: string;
  recursive?: boolean;
}

export interface IExternalSourceConfig {
  type: 'external';
  urls: string[];
}

export interface IImmichShareSourceConfig {
  type: 'immich-share';
  url: string;
  password?: string;
}

export interface IImmichConnection {
  key: string;
  baseUrl: string;
  apiKey: string;
}

export interface IImmichSourceConfig {
  type: 'immich';
  connection: string;
  filters?: {
    albumIds?: string[];
    tagIds?: string[];
    isFavorite?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    assetType?: 'image' | 'video';
  };
  limit?: number;
  sort?: {
    by: 'createdAt';
    order: 'asc' | 'desc';
  };
}

export type ISourceConfig = ILocalSourceConfig | IExternalSourceConfig | IImmichShareSourceConfig | IImmichSourceConfig;

export interface IViewConfig {
  type: 'thumbnail' | 'carousel' | 'grid';
  [key: string]: unknown;
}

export interface IGalleryConfig {
  /** Target folder or file path */
  path: string;
  
  /** Display view type */
  view?: 'thumbnail' | 'carousel' | 'grid' | IViewConfig;
  
  /** Include subdirectories (default: true) */
  recursive?: boolean;
  
  /** Optional list of external image URLs */
  urls?: string[];

  /** Sources to fetch images from */
  sources?: ISourceConfig[];

  /** Optional image limit */
  limit?: number;

  /** Optional sorting criteria */
  sort?: string;
}

export interface IImageSource {
  /** Vault-relative path to image file */
  path: string;
  
  /** Browser-compatible resource URL for loading */
  resourceUrl?: string;
  
  /** Source type */
  type: 'local' | 'external' | 'immich-share' | 'immich';
  
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

  /** Destroys the image source, cleaning up any resources (like blob URLs) */
  destroy?(): void;
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

  /** Optional runtime settings API */
  setOptions?(options: { remoteLoadTimeoutMs?: number; allowRemoteImages?: boolean }): void;

  /** Optional runtime property for remote load timeout */
  remoteLoadTimeoutMs?: number;

  /** Optional runtime property for allowing remote images */
  allowRemoteImages?: boolean;

  /** Optional method to retrieve view status/stats */
  getStats?(): {
    totalImages: number;
    loadedImages: number;
    pendingImages?: number;
    errorImages: number;
  };
}

export interface IContentScanner {
  /** Scan path for images */
  scanPath(path: string, recursive?: boolean): Promise<IImageSource[]>;
  
  /** Check if file is supported image format */
  isImageFile(path: string): boolean;
  
  /** Extract image links from markdown file */
  extractLinksFromFile(file: unknown): Promise<IImageSource[]>; // any for TFile from Obsidian
  
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

/**
 * Obsidian DOM extensions added at runtime
 */
export interface ObsidianDOMExtensions {
  createEl(tag: string, o?: unknown): HTMLElement;
  createDiv(o?: string | { cls?: string }): HTMLElement;
  addClass(cls: string): void;
  removeClass(cls: string): void;
  empty(): void;
}

/**
 * Options for custom createElement helper
 */
export interface CreateElementOptions {
  cls?: string;
  text?: string;
  attr?: Record<string, string | number | boolean | null | undefined>;
  href?: string;
}