import { IImageMetadata, IImageSource, SourceType } from './interfaces';
import { ObjectUrlManager } from '../utils/ObjectUrlManager';
import { VideoPoster, VideoFileReader } from '../utils/VideoPoster';
import { MEDIA_EXTENSIONS, MediaType, isVideoPath } from './media';

/**
 * Fetches an image on demand and returns a URL for it that was acquired from
 * ObjectUrlManager. The ImageSource that runs it owns that reference and releases it on destroy.
 */
export type ImageUrlLoader = () => Promise<string>;

/** Reads an image's photo details (EXIF) on demand */
export type ImageMetadataLoader = () => Promise<IImageMetadata | undefined>;

/**
 * Represents an individual image source within a gallery
 * Manages loading state and metadata for both local and external images
 */
export class ImageSource implements IImageSource {
    public readonly path: string;
    public readonly type: SourceType;
    public readonly displayName: string;
    /** 'video' for videos; local files are typed by extension, remote sources call setMediaType */
    public mediaType: MediaType = 'image';
    /** Web page showing the item at its source (Immich), offered when the viewer won't play it */
    public openUrl?: string;
    public caption?: string;
    public size?: number;
    public mtime?: number;
    public dimensions?: { width: number; height: number };
    /** Photo details, once known (set directly by sources that list them, or read by the metadata loader) */
    public metadata?: IImageMetadata;
    public loadState: 'pending' | 'loading' | 'loaded' | 'error';
    public errorMessage?: string;
    public loadStartTime?: number;

    private _resourceUrl?: string;
    private loader?: ImageUrlLoader;
    private pendingLoad: Promise<string> | null = null;
    /** True once `_resourceUrl` came from `loader`, so destroy() must release it */
    private ownsResourceUrl = false;
    private destroyed = false;
    /** Fetches a larger version for the image viewer (remote sources whose gallery shows thumbnails) */
    private largeLoader?: ImageUrlLoader;
    private largeUrl?: string;
    private pendingLarge: Promise<string> | null = null;
    private metadataLoader?: ImageMetadataLoader;
    /** Video: the playable URL (local files), or a loader that fetches it (remote sources) */
    private videoUrl?: string;
    private videoLoader?: ImageUrlLoader;
    private ownsVideoUrl = false;
    private pendingVideo: Promise<string> | null = null;
    private videoFileReader?: VideoFileReader;
    private _durationSeconds?: number;
    private durationListeners: Array<(seconds: number) => void> = [];
    private pendingMetadata: Promise<IImageMetadata | undefined> | null = null;

    private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    private static readonly SUPPORTED_FORMATS = MEDIA_EXTENSIONS;

    /**
     * @param resourceUrl A ready-to-use URL for the image (e.g. a vault resource path)
     * @param loader Fetches the image when it is first displayed; used by remote sources so
     *               nothing is downloaded for images that are never shown
     */
    constructor(path: string, type: SourceType, displayName?: string, resourceUrl?: string, caption?: string, loader?: ImageUrlLoader) {
        this.path = path;
        this._resourceUrl = resourceUrl;
        this.loader = loader;
        this.type = type;
        this.displayName = displayName || this.extractDisplayName(path);
        this.caption = caption;
        this.loadState = 'pending';

        // Validate path format
        this.validatePath();

        // A local video plays from its resource URL; tiles show a still frame captured from it
        if (type === 'local' && isVideoPath(path)) {
            this.mediaType = 'video';
            this.videoUrl = resourceUrl;
            this._resourceUrl = undefined;
            if (!this.loader) this.loader = () => this.capturePoster();
        }
    }

    /** Video length in seconds, when known */
    get durationSeconds(): number | undefined {
        return this._durationSeconds;
    }

    set durationSeconds(seconds: number | undefined) {
        if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return;
        this._durationSeconds = seconds;
        const listeners = this.durationListeners;
        this.durationListeners = [];
        listeners.forEach(listener => listener(seconds));
    }

    onDurationKnown(listener: (seconds: number) => void): void {
        if (this._durationSeconds !== undefined) listener(this._durationSeconds);
        else this.durationListeners.push(listener);
    }

    /**
     * Mark a remote item as a video. `videoLoader` fetches the playable file for the image viewer
     * (its URL must come from ObjectUrlManager); the display loader keeps supplying the still frame.
     */
    setMediaType(mediaType: MediaType, videoLoader?: ImageUrlLoader): void {
        this.mediaType = mediaType;
        if (videoLoader) this.videoLoader = videoLoader;
    }

    /** Lets a local video's still frame be drawn from the file's bytes when its URL can't be read back */
    setVideoFileReader(reader: VideoFileReader): void {
        this.videoFileReader = reader;
    }

    private async capturePoster(): Promise<string> {
        const poster = await VideoPoster.capture(this.videoUrl ?? this.path, this.videoFileReader);
        this.durationSeconds = poster.duration;
        if (!this.dimensions && poster.width && poster.height) {
            this.dimensions = { width: poster.width, height: poster.height };
        }
        return poster.url;
    }

    /** Get a URL the image viewer can play; remote videos are fetched on first use */
    async resolveVideoUrl(): Promise<string> {
        if (this.mediaType !== 'video') throw new Error(`Not a video: ${this.path}`);
        if (this.videoUrl) return this.videoUrl;
        if (!this.videoLoader) return this.getDisplayUrl();
        if (this.destroyed) throw new Error(`Image source was destroyed: ${this.path}`);

        if (!this.pendingVideo) {
            this.pendingVideo = this.videoLoader()
                .then(url => {
                    if (this.destroyed) {
                        ObjectUrlManager.releaseByUrl(url);
                        throw new Error(`Image source was destroyed: ${this.path}`);
                    }
                    this.videoUrl = url;
                    this.ownsVideoUrl = true;
                    return url;
                })
                .finally(() => {
                    this.pendingVideo = null;
                });
        }
        return this.pendingVideo;
    }

    /** Give back a fetched video, so it is downloaded again only if it is played again */
    releaseVideo(): void {
        if (this.ownsVideoUrl && this.videoUrl) {
            ObjectUrlManager.releaseByUrl(this.videoUrl);
            this.videoUrl = undefined;
            this.ownsVideoUrl = false;
        }
    }

    /** URL used to display the image; for loader-backed images, only set once the loader has run */
    get resourceUrl(): string | undefined {
        return this._resourceUrl;
    }

    /**
     * Extract display name from file path
     */
    private extractDisplayName(path: string): string {
        const fileName = path.split('/').pop() || path;
        // Remove file extension for display
        return fileName.replace(/\.[^/.]+$/, '');
    }

    /**
     * Validate image path and format
     */
    private validatePath(): void {
        if (!this.path || this.path.trim() === '') {
            throw new Error('Image path cannot be empty');
        }

        if (this.type === 'external') {
            // Validate URL format
            try {
                new URL(this.path);
            } catch {
                throw new Error(`Invalid URL format: ${this.path}`);
            }
        } else if (this.type === 'local') {
            // Validate local file format
            const extension = this.getFileExtension().toLowerCase();
            if (!ImageSource.SUPPORTED_FORMATS.includes(extension)) {
                throw new Error(`Unsupported image format: ${extension}. Supported formats: ${ImageSource.SUPPORTED_FORMATS.join(', ')}`);
            }
        }
        // No strict path extension validation for immich or immich-share as they use logical paths or share links.
    }

    /**
     * Get file extension from path
     */
    private getFileExtension(): string {
        // Remove query parameters and fragments from path for extension detection
        const cleanPath = this.path.split('?')[0].split('#')[0];
        const lastDot = cleanPath.lastIndexOf('.');
        return lastDot === -1 ? '' : cleanPath.substring(lastDot);
    }

    /**
     * Mark image as loading and record start time
     */
    startLoading(): void {
        this.loadState = 'loading';
        this.loadStartTime = Date.now();
        this.errorMessage = undefined;
    }

    /**
     * Mark image as successfully loaded
     */
    markLoaded(dimensions?: { width: number; height: number }): void {
        this.loadState = 'loaded';
        this.loadStartTime = undefined;
        this.errorMessage = undefined;

        if (dimensions) {
            this.dimensions = dimensions;
        }
    }

    /**
     * Mark image as failed to load
     */
    markError(error: string): void {
        this.loadState = 'error';
        this.loadStartTime = undefined;
        this.errorMessage = error;
    }

    /**
     * Check if loading has timed out (10 seconds for external URLs)
     */
    hasTimedOut(): boolean {
        if (this.type === 'local' || this.type === 'immich' || this.type === 'nextcloud' || !this.loadStartTime) {
            return false;
        }

        const timeoutMs = 10 * 1000; // 10 seconds
        return Date.now() - this.loadStartTime > timeoutMs;
    }

    /**
     * Get loading duration in milliseconds
     */
    getLoadingDuration(): number | null {
        if (!this.loadStartTime) {
            return null;
        }

        return Date.now() - this.loadStartTime;
    }

    /**
     * Check if image format is supported
     */
    static isSupportedFormat(path: string): boolean {
        // Remove query parameters and fragments from path for extension detection
        const cleanPath = path.split('?')[0].split('#')[0];
        const extension = cleanPath.substring(cleanPath.lastIndexOf('.')).toLowerCase();
        return ImageSource.SUPPORTED_FORMATS.includes(extension);
    }

    /**
     * Validate file size against maximum limit
     */
    validateSize(sizeBytes: number): boolean {
        this.size = sizeBytes;
        return sizeBytes <= ImageSource.MAX_FILE_SIZE;
    }

    /**
     * Get formatted file size string
     */
    getFormattedSize(): string | null {
        if (!this.size) return null;

        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.size;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Create ImageSource from local file path
     */
    static fromLocalPath(path: string, displayName?: string, resourceUrl?: string, caption?: string): ImageSource {
        return new ImageSource(path, 'local', displayName, resourceUrl, caption);
    }

    /**
     * Create ImageSource from external URL
     */
    static fromUrl(url: string, displayName?: string, caption?: string): ImageSource {
        return new ImageSource(url, 'external', displayName, undefined, caption);
    }

    /**
     * Reset loading state to pending
     */
    reset(): void {
        this.loadState = 'pending';
        this.loadStartTime = undefined;
        this.errorMessage = undefined;
    }

    /**
     * Get the URL that should be used for loading in the browser
     * For local files and authenticated immich assets, returns resourceUrl if available, otherwise path
     * For external files, returns path
     */
    getDisplayUrl(): string {
        if (this._resourceUrl) {
            return this._resourceUrl;
        }
        return this.path;
    }

    /**
     * Get the URL to display, running the loader first if the image has one and it has not run.
     * The loader runs at most once at a time; if it fails, the next call tries again.
     */
    async resolveDisplayUrl(): Promise<string> {
        if (this._resourceUrl || !this.loader) {
            return this.getDisplayUrl();
        }
        if (this.destroyed) {
            throw new Error(`Image source was destroyed: ${this.path}`);
        }

        if (!this.pendingLoad) {
            this.pendingLoad = this.loader()
                .then(url => {
                    if (this.destroyed) {
                        // Destroyed while fetching: give the reference straight back
                        ObjectUrlManager.releaseByUrl(url);
                        throw new Error(`Image source was destroyed: ${this.path}`);
                    }
                    this._resourceUrl = url;
                    this.ownsResourceUrl = true;
                    return url;
                })
                .finally(() => {
                    this.pendingLoad = null;
                });
        }
        return this.pendingLoad;
    }

    /**
     * Give the image a larger version for the image viewer. Without one, the viewer uses the
     * display URL. The URL the loader returns must come from ObjectUrlManager; it is released on destroy.
     */
    setLargeLoader(loader: ImageUrlLoader): void {
        this.largeLoader = loader;
    }

    /**
     * Get a URL for viewing the image large, fetching the larger version on first use.
     * Falls back to the display URL when the image has no larger version.
     */
    async resolveLargeUrl(): Promise<string> {
        if (!this.largeLoader) return this.resolveDisplayUrl();
        if (this.largeUrl) return this.largeUrl;
        if (this.destroyed) throw new Error(`Image source was destroyed: ${this.path}`);

        if (!this.pendingLarge) {
            this.pendingLarge = this.largeLoader()
                .then(url => {
                    if (this.destroyed) {
                        ObjectUrlManager.releaseByUrl(url);
                        throw new Error(`Image source was destroyed: ${this.path}`);
                    }
                    this.largeUrl = url;
                    return url;
                })
                .finally(() => {
                    this.pendingLarge = null;
                });
        }
        return this.pendingLarge;
    }

    /** Give the image a way to read its photo details when the viewer first asks for them */
    setMetadataLoader(loader: ImageMetadataLoader): void {
        this.metadataLoader = loader;
    }

    /** True when the image can read its photo details on demand */
    hasMetadataLoader(): boolean {
        return !!this.metadataLoader;
    }

    /**
     * Get the photo details, running the metadata loader on first use. Never rejects: a failed
     * read resolves to undefined and the next call tries again.
     */
    async resolveMetadata(): Promise<IImageMetadata | undefined> {
        if (this.metadata || !this.metadataLoader || this.destroyed) return this.metadata;
        if (!this.pendingMetadata) {
            this.pendingMetadata = this.metadataLoader()
                .then(metadata => {
                    // An empty result is kept too, so a photo without EXIF isn't read again
                    if (metadata) this.metadata = metadata;
                    return this.metadata;
                })
                .catch(() => undefined)
                .finally(() => {
                    this.pendingMetadata = null;
                });
        }
        return this.pendingMetadata;
    }

    /**
     * Check if image can be retried (only if in error state)
     */
    canRetry(): boolean {
        return this.loadState === 'error';
    }

    /**
     * Get current state for debugging
     */
    getState(): object {
        return {
            path: this.path,
            type: this.type,
            mediaType: this.mediaType,
            displayName: this.displayName,
            loadState: this.loadState,
            size: this.size,
            dimensions: this.dimensions,
            errorMessage: this.errorMessage,
            loadingDuration: this.getLoadingDuration()
        };
    }

    /**
     * Destroys the image source, releasing the blob URL its loader acquired (if any).
     * Safe to call more than once.
     */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this.ownsResourceUrl && this._resourceUrl) {
            ObjectUrlManager.releaseByUrl(this._resourceUrl);
            // The URL may now be revoked, so stop handing it out
            this._resourceUrl = undefined;
            this.ownsResourceUrl = false;
        }
        if (this.largeUrl) {
            ObjectUrlManager.releaseByUrl(this.largeUrl);
            this.largeUrl = undefined;
        }
        this.releaseVideo();
        this.durationListeners = [];
    }
}