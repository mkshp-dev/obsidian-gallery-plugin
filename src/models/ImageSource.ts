import { IImageSource } from './interfaces';

/**
 * Represents an individual image source within a gallery
 * Manages loading state and metadata for both local and external images
 */
export class ImageSource implements IImageSource {
    public readonly path: string;
    public readonly resourceUrl?: string;
    public readonly type: 'local' | 'external';
    public readonly displayName: string;
    public size?: number;
    public dimensions?: { width: number; height: number };
    public loadState: 'pending' | 'loading' | 'loaded' | 'error';
    public errorMessage?: string;
    public loadStartTime?: number;

    private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    private static readonly SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    constructor(path: string, type: 'local' | 'external', displayName?: string, resourceUrl?: string) {
        this.path = path;
        this.resourceUrl = resourceUrl;
        this.type = type;
        this.displayName = displayName || this.extractDisplayName(path);
        this.loadState = 'pending';
        
        // Validate path format
        this.validatePath();
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
        } else {
            // Validate local file format
            const extension = this.getFileExtension().toLowerCase();
            if (!ImageSource.SUPPORTED_FORMATS.includes(extension)) {
                throw new Error(`Unsupported image format: ${extension}. Supported formats: ${ImageSource.SUPPORTED_FORMATS.join(', ')}`);
            }
        }
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
        if (this.type === 'local' || !this.loadStartTime) {
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
    static fromLocalPath(path: string, displayName?: string, resourceUrl?: string): ImageSource {
        return new ImageSource(path, 'local', displayName, resourceUrl);
    }

    /**
     * Create ImageSource from external URL
     */
    static fromUrl(url: string, displayName?: string): ImageSource {
        return new ImageSource(url, 'external', displayName);
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
     * For local files, returns resourceUrl if available, otherwise path
     * For external files, returns path
     */
    getDisplayUrl(): string {
        if (this.type === 'local' && this.resourceUrl) {
            return this.resourceUrl;
        }
        return this.path;
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
}