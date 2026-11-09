/**
 * Core interfaces for the Gallery Plugin
 * Based on contracts defined in contracts/interfaces.md
 */
import type { MediaType } from './media';

import type { ViewType, ViewTypeName } from './viewTypes';
import type { PaginationPosition } from './viewOptions';

export interface ILocalSourceConfig {
  type: 'local';
  path: string;
  recursive?: boolean;
  limit?: number;
  sort?: {
    by: 'name' | 'modified' | 'size';
    order: 'asc' | 'desc';
  };
  filenameFilter?: string; // Optional glob pattern for filenames
  filters?: {
    modifiedAfter?: string;
    modifiedBefore?: string;
    maxSizeKb?: number;
    minSizeKb?: number;
  };
}

export interface IExternalSourceConfig {
  type: 'external';
  /** `video: true` marks a video whose URL has no video file extension */
  urls: (string | { url: string; caption?: string; video?: boolean })[];
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
    tags?: string[];
    personIds?: string[];
    people?: string[];
    isFavorite?: boolean;
    /** Upload date (Immich asset.createdAt), not the date the photo was taken */
    createdAfter?: string;
    createdBefore?: string;
    /** Date the photo was taken (Immich fileCreatedAt, from EXIF) */
    takenAfter?: string;
    takenBefore?: string;
    assetType?: 'image' | 'video';
  };
  limit?: number;
  sort?: {
    by: 'createdAt';
    order: 'asc' | 'desc';
  };
}

export interface INextcloudConnection {
  key: string;          // stable reference for gallery blocks
  baseUrl: string;      // e.g. https://cloud.example.com
  username: string;
  appPassword: string;  // Nextcloud App Password
}

export interface INextcloudSourceConfig {
  type: 'nextcloud';
  connection: string;   // key referencing a saved connection
  path?: string;        // WebDAV path within user's files (default: '/')
  recursive?: boolean;  // scan subdirectories (default: true)
  limit?: number;
  sort?: {
    by: 'name' | 'lastModified' | 'size';
    order: 'asc' | 'desc';
  };
  filenameFilter?: string; // Optional glob pattern for filenames
  filters?: {
    modifiedAfter?: string;
    modifiedBefore?: string;
    maxSizeKb?: number;
    minSizeKb?: number;
    mimeTypes?: string[];
  };
}

export interface INextcloudShareSourceConfig {
  type: 'nextcloud-share';
  url: string;          // full share URL e.g. https://cloud.example.com/s/TOKEN
  password?: string;    // optional share password
  recursive?: boolean;  // include images in sub-folders of a folder share (default: true)
  filenameFilter?: string; // Optional glob pattern for filenames
  filters?: {
    mimeTypes?: string[];
    minSizeKb?: number;
    maxSizeKb?: number;
  };
  limit?: number;       // Max number of files to return
  sort?: {
    by: 'name' | 'lastModified' | 'size';
    order: 'asc' | 'desc';
  };
}

export type ISourceConfig = ILocalSourceConfig | IExternalSourceConfig | IImmichShareSourceConfig | IImmichSourceConfig | INextcloudSourceConfig | INextcloudShareSourceConfig;

/** Every source type a gallery block can use; also the type tag of the images it resolves to */
export type SourceType = ISourceConfig['type'];

export interface IViewConfig {
  /** View name as written; GalleryConfig normalizes aliases (grid) to their view type */
  type: ViewTypeName;
  [key: string]: unknown;
}

export interface IGalleryConfig {
  /** Target folder or file path */
  path: string;

  /** Display view type */
  view?: ViewTypeName | IViewConfig;

  /** Include subdirectories (default: true) */
  recursive?: boolean;

  /** Optional list of external image URLs */
  urls?: (string | { url: string; caption?: string })[];

  /** Sources to fetch images from */
  sources?: ISourceConfig[];

  /** Optional image limit */
  limit?: number;

  /** Optional sorting criteria */
  sort?: string;
}

/** Photo details for the image viewer's Details panel; any field may be missing */
export interface IImageMetadata {
  /** When the photo was taken, as the camera's local time */
  takenAt?: Date;
  /** Camera maker and model, e.g. "Canon EOS R5" */
  camera?: string;
  /** Lens model */
  lens?: string;
}

export interface IImageSource {
  /** Vault-relative path to image file */
  path: string;

  /** Browser-compatible resource URL for loading */
  resourceUrl?: string;

  /** Source type */
  type: SourceType;

  /** Optional image caption */
  caption?: string;

  /** Display name for user */
  displayName: string;

  /** File size in bytes (local files only) */
  size?: number;

  /** Last modified timestamp in ms (local files only) */
  mtime?: number;

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

  /**
   * Get the display URL, fetching the image first if it is loaded on demand (remote sources).
   * Views should prefer this over getDisplayUrl when about to show an image.
   */
  resolveDisplayUrl?(): Promise<string>;

  /**
   * Get a URL for viewing the image large (the image viewer). Remote sources whose galleries show
   * thumbnails fetch a larger version; others return the display URL.
   */
  resolveLargeUrl?(): Promise<string>;

  /**
   * 'video' for videos: views show a still frame (from the display URL) with a play badge,
   * and the image viewer plays the video from resolveVideoUrl. Missing means 'image'.
   */
  mediaType?: MediaType;

  /** Video length in seconds, when known */
  durationSeconds?: number;

  /** Call `listener` with the video's length once it is known (straight away if it already is) */
  onDurationKnown?(listener: (seconds: number) => void): void;

  /** Web page showing the item at its source (Immich), offered when the viewer won't play it */
  openUrl?: string;

  /** Get a URL the image viewer can play, fetching the video first for remote sources */
  resolveVideoUrl?(): Promise<string>;

  /** Let go of a fetched video once the viewer moves on, so large videos don't stay in memory */
  releaseVideo?(): void;

  /** Photo details already known for the image (remote sources that send them with the listing) */
  metadata?: IImageMetadata;

  /**
   * Get the photo details, reading them on first use (local files read their EXIF data).
   * Resolves to undefined when there are none; never rejects.
   */
  resolveMetadata?(): Promise<IImageMetadata | undefined>;

  /** Validate file size against maximum limit */
  validateSize(sizeBytes: number): boolean;

  /** Destroys the image source, cleaning up any resources (like blob URLs) */
  destroy?(): void;
}

/** Settings and per-gallery `view:` options passed to a view before it renders */
export interface ViewRuntimeOptions {
  remoteLoadTimeoutMs?: number;
  allowRemoteImages?: boolean;
  showCaptions?: boolean;
  captionMaxLines?: number;
  /** Image viewer: seconds between images when the slideshow plays */
  slideshowInterval?: number;
  /** Image viewer: largest remote video (MB) downloaded to play; 0 = no limit */
  maxRemoteVideoMb?: number;
  pagination?: boolean;
  itemsPerPage?: number;
  /** Where the Prev/Next bar sits: above or below the gallery */
  paginationPosition?: PaginationPosition;
  /** Draw the gallery's frame: border, background, shadow and padding */
  frame?: boolean;
  /** Justified: target row height in px */
  rowHeight?: number;
  /** Masonry: minimum column width in px */
  columnWidth?: number;
  /** Masonry and justified: space between images in px */
  gap?: number;
  /** Carousel: stage height in px */
  height?: number;
  /** Notes shown under the gallery, e.g. ignored view options */
  warnings?: string[];
}

export interface IGalleryView {
  /** View type identifier */
  readonly type: ViewType;

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
  setOptions?(options: ViewRuntimeOptions): void;

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

  /** Paths of photo and video files under a folder that galleries can't show (HEIC, RAW, ...) */
  listSkippedFiles?(path: string, recursive?: boolean): string[];

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

  /** Vault-relative path of the note containing this gallery's code block, used to re-resolve relative source paths on refresh */
  readonly notePath?: string;

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