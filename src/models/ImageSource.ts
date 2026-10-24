import { IImageSource, SourceType } from './interfaces';
import { ObjectUrlManager } from '../utils/ObjectUrlManager';

/**
 * Fetches an image on demand and returns a URL for it that was acquired from
 * ObjectUrlManager. The ImageSource that runs it owns that reference and releases it on destroy.
 */
export type ImageUrlLoader = () => Promise<string>;

/**
 * Represents an individual image source within a gallery
 * Manages loading state and metadata for both local and external images
 */
export class ImageSource implements IImageSource {
    public readonly path: string;
    public readonly type: SourceType;
    public readonly displayName: string;
    public caption?: string;
    public size?: number;
    public mtime?: number;
    public dimensions?: { width: number; height: number };
    public loadState: 'pending' | 'loading' | 'loaded' | 'error';
    public errorMessage?: string;
    public loadStartTime?: number;

    private _resourceUrl?: string;
    private readonly loader?: ImageUrlLoader;
    private pendingLoad: Promise<string> | null = null;
    /** True once `_resourceUrl` came from `loader`, so destroy() must release it */
    private ownsResourceUrl = false;
    private destroyed = false;

    private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    private static readonly SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

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
    }
}