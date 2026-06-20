import { Vault, TFile, TFolder } from 'obsidian';
import { IContentScanner, IImageSource } from '../models/interfaces';
import { ImageSource } from '../models/ImageSource';
import { FolderScanner } from './FolderScanner';

/**
 * Content scanner service for discovering images in vault
 * Integrates with Obsidian Vault API for file system access
 */
export class ContentScanner implements IContentScanner {
    private vault: Vault;
    private folderScanner: FolderScanner;
    private cache: Map<string, { images: IImageSource[], timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    constructor(vault: Vault) {
        this.vault = vault;
        this.folderScanner = new FolderScanner(vault);
        this.setupVaultWatcher();
    }

    /**
     * Setup vault file watcher to invalidate cache
     */
    private setupVaultWatcher(): void {
        // Listen for file changes to invalidate cache
        this.vault.on('create', (file) => this.onVaultChange(file.path));
        this.vault.on('delete', (file) => this.onVaultChange(file.path));
        this.vault.on('rename', (file, oldPath) => {
            this.onVaultChange(oldPath);
            this.onVaultChange(file.path);
        });
    }

    /**
     * Handle vault changes by invalidating relevant cache entries
     */
    private onVaultChange(filePath: string): void {
        // Invalidate cache for affected directories
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        this.invalidateCache(dirPath);
        this.folderScanner.invalidateCache(dirPath);
        
        // Also invalidate parent directories if recursive scanning
        let parentPath = dirPath;
        while (parentPath.includes('/')) {
            parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
            this.invalidateCache(parentPath);
            this.folderScanner.invalidateCache(parentPath);
        }
    }

    /**
     * Scan path for images
     */
    async scanPath(path: string, recursive: boolean = true): Promise<IImageSource[]> {
        const cacheKey = `${path}:${recursive}`;
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            return [...cached.images];
        }

        try {
            let images: IImageSource[] = [];
            
            // Check if path is a file or folder
            const abstractFile = this.vault.getAbstractFileByPath(path);
            
            if (!abstractFile) {
                throw new Error(`Path not found: ${path}`);
            }

            if (abstractFile instanceof TFile) {
                // Single file - check if it's an image or extract links
                if (this.isImageFile(abstractFile.path)) {
                    images = [ImageSource.fromLocalPath(abstractFile.path)];
                } else {
                    // Extract image links from markdown file
                    images = await this.extractLinksFromFile(abstractFile);
                }
            } else if (abstractFile instanceof TFolder) {
                // Folder - use specialized FolderScanner for better performance
                images = await this.folderScanner.scanFolder(abstractFile.path, recursive);
            }

            // Cache results
            this.cache.set(cacheKey, {
                images: [...images],
                timestamp: Date.now()
            });

            return images;
            
        } catch (error) {
            console.error('Error scanning path:', path, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to scan path "${path}": ${errorMessage}`);
        }
    }

    /**
     * Get folder statistics (delegated to FolderScanner)
     */
    async getFolderStats(folderPath: string, recursive: boolean = true) {
        return await this.folderScanner.getFolderStats(folderPath, recursive);
    }

    /**
     * Find images by pattern (delegated to FolderScanner)
     */
    async findImagesByPattern(folderPath: string, pattern: RegExp, recursive: boolean = true): Promise<IImageSource[]> {
        return await this.folderScanner.findImagesByPattern(folderPath, pattern, recursive);
    }

    /**
     * Get recently added images (delegated to FolderScanner)
     */
    async getRecentImages(folderPath: string, hours: number = 24, recursive: boolean = true): Promise<IImageSource[]> {
        return await this.folderScanner.getRecentImages(folderPath, hours, recursive);
    }

    /**
     * Validate folder access (delegated to FolderScanner)
     */
    async validateFolderAccess(folderPath: string) {
        return await this.folderScanner.validateFolderAccess(folderPath);
    }

    /**
     * Check if file is supported image format
     */
    isImageFile(path: string): boolean {
        // Remove query parameters and fragments from path for extension detection
        // Optimized: indexOf is much faster than string splitting for large directories
        let cleanPath = path;
        const qIndex = cleanPath.indexOf('?');
        if (qIndex !== -1) cleanPath = cleanPath.substring(0, qIndex);
        const hIndex = cleanPath.indexOf('#');
        if (hIndex !== -1) cleanPath = cleanPath.substring(0, hIndex);

        const extension = cleanPath.substring(cleanPath.lastIndexOf('.')).toLowerCase();
        return this.SUPPORTED_EXTENSIONS.includes(extension);
    }

    /**
     * Extract image links from markdown file
     */
    async extractLinksFromFile(file: TFile): Promise<IImageSource[]> {
        try {
            const content = await this.vault.read(file);
            const images: IImageSource[] = [];
            
            // Extract markdown image links: ![alt](path)
            const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let match;
            
            while ((match = markdownImageRegex.exec(content)) !== null) {
                const [, alt, imagePath] = match;
                const cleanPath = imagePath.trim();
                
                if (this.isValidImageLink(cleanPath)) {
                    const imageSource = this.isExternalUrl(cleanPath)
                        ? ImageSource.fromUrl(cleanPath, alt || undefined)
                        : ImageSource.fromLocalPath(cleanPath, alt || undefined);
                    
                    images.push(imageSource);
                }
            }
            
            // Extract wiki-style links: [[image.jpg]]
            const wikiLinkRegex = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
            
            while ((match = wikiLinkRegex.exec(content)) !== null) {
                const [, linkPath, displayName] = match;
                const cleanPath = linkPath.trim();
                
                if (this.isImageFile(cleanPath)) {
                    const imageSource = ImageSource.fromLocalPath(cleanPath, displayName || undefined);
                    images.push(imageSource);
                }
            }
            
            // Extract attachment references
            const attachmentRegex = /\[\[([^|\]]+\.(jpg|jpeg|png|gif|webp))(?:\|([^\]]+))?\]\]/gi;
            
            while ((match = attachmentRegex.exec(content)) !== null) {
                const [, attachmentPath, , displayName] = match;
                const imageSource = ImageSource.fromLocalPath(attachmentPath, displayName || undefined);
                images.push(imageSource);
            }
            
            // Remove duplicates based on path (O(N) performance optimization)
            const seenPaths = new Set<string>();
            const uniqueImages: IImageSource[] = [];
            for (const image of images) {
                if (!seenPaths.has(image.path)) {
                    seenPaths.add(image.path);
                    uniqueImages.push(image);
                }
            }
            
            return uniqueImages;
            
        } catch (error) {
            console.error('Error extracting links from file:', file.path, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to extract links from "${file.path}": ${errorMessage}`);
        }
    }

    /**
     * Check if link is a valid image reference
     */
    private isValidImageLink(link: string): boolean {
        if (!link || link.trim() === '') return false;
        
        // Check if it's an external URL
        if (this.isExternalUrl(link)) {
            return true; // Let ImageSource constructor validate URL
        }
        
        // Check if it's a local image file
        return this.isImageFile(link);
    }

    /**
     * Check if path is external URL
     */
    private isExternalUrl(path: string): boolean {
        try {
            const url = new URL(path);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Validate image source accessibility
     */
    async validateImageSource(source: IImageSource): Promise<boolean> {
        try {
            if (source.type === 'local') {
                // Check if local file exists
                const file = this.vault.getAbstractFileByPath(source.path);
                return file instanceof TFile && this.isImageFile(file.path);
            } else {
                // For external URLs, we'll validate during actual loading
                // Here we just check if it's a valid URL format
                try {
                    new URL(source.path);
                    return true;
                } catch {
                    return false;
                }
            }
        } catch (error) {
            console.error('Error validating image source:', source.path, error);
            return false;
        }
    }

    /**
     * Clear cache for specific path
     */
    invalidateCache(path: string): void {
        // Remove entries that match or are children of the path
        for (const key of this.cache.keys()) {
            const keyPath = key.split(':')[0];
            if (keyPath === path || keyPath.startsWith(path + '/')) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache entries
     */
    clearCache(): void {
        this.cache.clear();
        this.folderScanner.clearCache();
    }

    /**
     * Get cache statistics (combined from both scanners)
     */
    getCacheStats(): { entries: number; size: number; folderCacheEntries: number; folderCacheImages: number } {
        let totalSize = 0;
        for (const entry of this.cache.values()) {
            totalSize += entry.images.length;
        }
        
        const folderStats = this.folderScanner.getCacheStats();
        
        return {
            entries: this.cache.size,
            size: totalSize,
            folderCacheEntries: folderStats.entries,
            folderCacheImages: folderStats.totalImages
        };
    }

    /**
     * Get supported image extensions
     */
    getSupportedExtensions(): string[] {
        return [...this.SUPPORTED_EXTENSIONS];
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.clearCache();
        // Note: Obsidian handles vault event cleanup automatically
    }
}