import { Vault, TFolder, TFile } from 'obsidian';
import { IImageSource } from '../models/interfaces';
import { ImageSource } from '../models/ImageSource';

/**
 * Folder scanner for discovering images in vault folders
 * Handles recursive scanning with performance optimization
 */
export class FolderScanner {
    private vault: Vault;
    private readonly SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    private readonly MAX_SCAN_DEPTH = 10; // Prevent infinite recursion
    private scanCache: Map<string, { images: IImageSource[], timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(vault: Vault) {
        this.vault = vault;
    }

    /**
     * Scan folder for images with optional recursion
     */
    async scanFolder(folderPath: string, recursive: boolean = true): Promise<IImageSource[]> {
        const cacheKey = `${folderPath}:${recursive}`;
        
        // Check cache first
        const cached = this.scanCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            return [...cached.images];
        }

        try {
            const images = await this.performScan(folderPath, recursive);
            
            // Cache results
            this.scanCache.set(cacheKey, {
                images: [...images],
                timestamp: Date.now()
            });
            
            return images;
            
        } catch (error) {
            console.error('Error scanning folder:', folderPath, error);
            throw new Error(`Failed to scan folder "${folderPath}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Perform the actual folder scan
     */
    private async performScan(folderPath: string, recursive: boolean, depth: number = 0): Promise<IImageSource[]> {
        // Prevent infinite recursion
        if (depth > this.MAX_SCAN_DEPTH) {
            console.warn('Maximum scan depth reached for folder:', folderPath);
            return [];
        }

        const folder = this.vault.getAbstractFileByPath(folderPath);
        
        if (!folder) {
            throw new Error(`Folder not found: ${folderPath}`);
        }
        
        if (!(folder instanceof TFolder)) {
            throw new Error(`Path is not a folder: ${folderPath}`);
        }

        const images: IImageSource[] = [];
        
        // Get all children of the folder
        const children = folder.children;
        
        for (const child of children) {
            if (child instanceof TFile) {
                // Check if it's an image file
                if (this.isImageFile(child.path)) {
                    try {
                        const imageSource = await this.createImageSource(child);
                        images.push(imageSource);
                    } catch (error) {
                        console.warn('Failed to process image file:', child.path, error);
                        // Continue with other files
                    }
                }
            } else if (child instanceof TFolder && recursive) {
                // Recursively scan subdirectory
                try {
                    const subImages = await this.performScan(child.path, recursive, depth + 1);
                    images.push(...subImages);
                } catch (error) {
                    console.warn('Failed to scan subdirectory:', child.path, error);
                    // Continue with other directories
                }
            }
        }
        
        // Sort images by name for consistent ordering
        return images.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    /**
     * Check if file is a supported image format
     */
    private isImageFile(path: string): boolean {
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
     * Create ImageSource from TFile with metadata
     */
    private async createImageSource(file: TFile): Promise<IImageSource> {
        // Convert vault path to resource URL for browser compatibility
        const resourcePath = this.vault.adapter.getResourcePath(file.path);
        // Keep original path for validation, pass resource URL separately
        const imageSource = ImageSource.fromLocalPath(file.path, file.basename, resourcePath);
        
        // Get file size
        try {
            const stat = await this.vault.adapter.stat(file.path);
            if (stat && stat.size) {
                if (!imageSource.validateSize(stat.size)) {
                    console.warn('Image exceeds size limit:', file.path, 'Size:', stat.size);
                }
            }
        } catch (error) {
            console.warn('Could not get file stats for:', file.path, error);
        }
        
        return imageSource;
    }

    /**
     * Get folder statistics
     */
    async getFolderStats(folderPath: string, recursive: boolean = true): Promise<{
        totalFiles: number;
        imageFiles: number;
        totalSize: number;
        subdirectories: number;
        supportedFormats: Map<string, number>;
    }> {
        const folder = this.vault.getAbstractFileByPath(folderPath);
        
        if (!folder || !(folder instanceof TFolder)) {
            throw new Error(`Invalid folder path: ${folderPath}`);
        }

        const stats = {
            totalFiles: 0,
            imageFiles: 0,
            totalSize: 0,
            subdirectories: 0,
            supportedFormats: new Map<string, number>()
        };

        await this.collectStats(folder, recursive, stats);
        
        return stats;
    }

    /**
     * Recursively collect folder statistics
     */
    private async collectStats(
        folder: TFolder, 
        recursive: boolean, 
        stats: any,
        depth: number = 0
    ): Promise<void> {
        if (depth > this.MAX_SCAN_DEPTH) return;

        for (const child of folder.children) {
            if (child instanceof TFile) {
                stats.totalFiles++;
                
                if (this.isImageFile(child.path)) {
                    stats.imageFiles++;
                    
                    // Count format
                    const cleanPath = child.path.split('?')[0].split('#')[0];
                    const ext = cleanPath.substring(cleanPath.lastIndexOf('.')).toLowerCase();
                    stats.supportedFormats.set(ext, (stats.supportedFormats.get(ext) || 0) + 1);
                    
                    // Add size
                    try {
                        const stat = await this.vault.adapter.stat(child.path);
                        if (stat && stat.size) {
                            stats.totalSize += stat.size;
                        }
                    } catch (error) {
                        // Ignore stat errors
                    }
                }
            } else if (child instanceof TFolder) {
                stats.subdirectories++;
                
                if (recursive) {
                    await this.collectStats(child, recursive, stats, depth + 1);
                }
            }
        }
    }

    /**
     * Find images matching pattern
     */
    async findImagesByPattern(
        folderPath: string, 
        pattern: RegExp, 
        recursive: boolean = true
    ): Promise<IImageSource[]> {
        const allImages = await this.scanFolder(folderPath, recursive);
        return allImages.filter(image => 
            pattern.test(image.displayName) || pattern.test(image.path)
        );
    }

    /**
     * Get recently added images
     */
    async getRecentImages(
        folderPath: string, 
        hours: number = 24,
        recursive: boolean = true
    ): Promise<IImageSource[]> {
        const images = await this.scanFolder(folderPath, recursive);
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        
        const recentImages: IImageSource[] = [];
        
        for (const image of images) {
            try {
                const file = this.vault.getAbstractFileByPath(image.path);
                if (file instanceof TFile && file.stat.mtime > cutoffTime) {
                    recentImages.push(image);
                }
            } catch (error) {
                // Skip files with stat errors
            }
        }
        
        return recentImages.sort((a, b) => {
            const fileA = this.vault.getAbstractFileByPath(a.path) as TFile;
            const fileB = this.vault.getAbstractFileByPath(b.path) as TFile;
            return fileB.stat.mtime - fileA.stat.mtime;
        });
    }

    /**
     * Validate folder access
     */
    async validateFolderAccess(folderPath: string): Promise<{
        exists: boolean;
        isFolder: boolean;
        readable: boolean;
        imageCount?: number;
    }> {
        try {
            const folder = this.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                return { exists: false, isFolder: false, readable: false };
            }
            
            if (!(folder instanceof TFolder)) {
                return { exists: true, isFolder: false, readable: false };
            }
            
            // Try to read folder contents
            const images = await this.scanFolder(folderPath, false);
            
            return {
                exists: true,
                isFolder: true,
                readable: true,
                imageCount: images.length
            };
            
        } catch (error) {
            return { exists: false, isFolder: false, readable: false };
        }
    }

    /**
     * Clear cache for specific folder
     */
    invalidateCache(folderPath: string): void {
        const keysToDelete: string[] = [];
        
        for (const key of this.scanCache.keys()) {
            if (key.startsWith(`${folderPath}:`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.scanCache.delete(key));
    }

    /**
     * Clear all cache
     */
    clearCache(): void {
        this.scanCache.clear();
    }

    /**
     * Get supported file extensions
     */
    getSupportedExtensions(): string[] {
        return [...this.SUPPORTED_EXTENSIONS];
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { entries: number; totalImages: number } {
        let totalImages = 0;
        
        for (const entry of this.scanCache.values()) {
            totalImages += entry.images.length;
        }
        
        return {
            entries: this.scanCache.size,
            totalImages
        };
    }
}