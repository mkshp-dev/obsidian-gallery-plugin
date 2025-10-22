import { MarkdownPostProcessorContext } from 'obsidian';
import { IGalleryConfig, IContentScanner, IGalleryView } from '../models/interfaces';
import { GalleryConfig } from '../models/GalleryConfig';
import { GalleryInstance } from '../models/GalleryInstance';
import { ParameterParser } from './ParameterParser';
import { ConfigValidator } from '../utils/ConfigValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ViewFactory } from '../views/ViewFactory';

/**
 * Gallery processor for handling obs-gallery code blocks
 * Coordinates parsing, validation, and rendering of galleries
 */
export class GalleryProcessor {
    private contentScanner: IContentScanner;
    private viewFactory: ViewFactory;
    private activeGalleries: Map<string, GalleryInstance> = new Map();

    constructor(contentScanner: IContentScanner, viewFactory: ViewFactory) {
        this.contentScanner = contentScanner;
        this.viewFactory = viewFactory;
    }

    /**
     * Process obs-gallery code block
     */
    async processCodeBlock(
        source: string, 
        el: HTMLElement, 
        ctx: MarkdownPostProcessorContext
    ): Promise<void> {
        try {
                        // Clear previous content and show loading
            (el as any).empty();
            
            // Create loading indicator
            const loadingEl = (el as any).createEl('div', {
                cls: 'gallery-loading',
                text: 'Loading gallery...'
            });

            // Parse configuration
            const config = await this.parseConfiguration(source);
            
            // Validate configuration
            this.validateConfiguration(config);
            
            // Create gallery
            await this.createGallery(config, el);
            
            // Remove loading state
            loadingEl.remove();
            
        } catch (error) {
            console.error('Error processing gallery code block:', error);
            this.handleProcessingError(error as Error, el);
        }
    }

    /**
     * Parse configuration from code block content
     */
    private async parseConfiguration(source: string): Promise<IGalleryConfig> {
        try {
            return ParameterParser.parseAndValidate(source);
        } catch (error) {
            throw new Error(`Configuration parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validate gallery configuration
     */
    private validateConfiguration(config: IGalleryConfig): void {
        try {
            ConfigValidator.validateOrThrow(config);
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create gallery from configuration
     */
    async createGallery(config: IGalleryConfig, container: HTMLElement): Promise<void> {
        try {
            // Scan for images
            const images = await this.contentScanner.scanPath(config.path, config.recursive);
            
            if (images.length === 0) {
                this.showEmptyGallery(container, config.path);
                return;
            }

            // Create view
            const view = this.viewFactory.createView(config.view || 'thumbnail', container);
            
            // Create gallery instance
            const gallery = new GalleryInstance(config, container, view, images);
            
            // Store active gallery
            this.activeGalleries.set(gallery.id, gallery);
            
            // Setup cleanup when container is removed
            this.setupGalleryCleanup(gallery);
            
            // Render gallery
            view.render();
            
            console.log(`Gallery created: ${gallery.id} with ${images.length} images`);
            
        } catch (error) {
            console.error('Error creating gallery:', error);
            throw new Error(`Gallery creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Show empty gallery state
     */
    private showEmptyGallery(container: HTMLElement, path: string): void {
        const emptyEl = (container as any).createEl('div', { cls: 'gallery-empty' });
        
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-icon',
            text: '🖼️'
        });
        
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-message',
            text: 'No images found'
        });
        
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-path',
            text: `Path: ${path}`
        });
        
        emptyEl.createEl('div', { 
            cls: 'gallery-empty-help',
            text: 'Make sure the path exists and contains supported image files (JPG, PNG, GIF, WebP)'
        });
    }

    /**
     * Setup gallery cleanup when container is removed from DOM
     */
    private setupGalleryCleanup(gallery: GalleryInstance): void {
        // Use MutationObserver to detect when gallery container is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === gallery.container || 
                        (node instanceof Element && node.contains(gallery.container))) {
                        this.destroyGallery(gallery.id);
                        observer.disconnect();
                    }
                });
            });
        });

        // Observe the parent document for changes
        if (gallery.container.ownerDocument) {
            observer.observe(gallery.container.ownerDocument.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Handle processing errors
     */
    private handleProcessingError(error: Error, container: HTMLElement): void {
        // Clear container
        (container as any).empty();
        
        // Check if it's a configuration error
        if (error.message.includes('Configuration')) {
            const configError = {
                type: 'config' as const,
                field: 'general',
                message: error.message,
                suggestion: 'Check the gallery configuration syntax and parameters'
            };
            ErrorHandler.handleConfigError(configError, container);
        } else {
            // General plugin error
            ErrorHandler.handlePluginError(error, 'code block processing', container);
        }
    }

    /**
     * Refresh gallery by re-scanning content
     */
    async refreshGallery(galleryId: string): Promise<void> {
        const gallery = this.activeGalleries.get(galleryId);
        if (!gallery) {
            console.warn('Gallery not found for refresh:', galleryId);
            return;
        }

        try {
            // Clear cache for this path
            this.contentScanner.invalidateCache(gallery.config.path);
            
            // Re-scan for images
            const images = await this.contentScanner.scanPath(
                gallery.config.path, 
                gallery.config.recursive
            );
            
            // Update gallery
            gallery.update(images);
            
            console.log(`Gallery refreshed: ${galleryId} with ${images.length} images`);
            
        } catch (error) {
            console.error('Error refreshing gallery:', error);
            ErrorHandler.handlePluginError(error as Error, 'gallery refresh', gallery.container);
        }
    }

    /**
     * Destroy gallery and cleanup resources
     */
    destroyGallery(galleryId: string): void {
        const gallery = this.activeGalleries.get(galleryId);
        if (gallery) {
            gallery.destroy();
            this.activeGalleries.delete(galleryId);
            console.log(`Gallery destroyed: ${galleryId}`);
        }
    }

    /**
     * Get active gallery by ID
     */
    getGallery(galleryId: string): GalleryInstance | undefined {
        return this.activeGalleries.get(galleryId);
    }

    /**
     * Get all active galleries
     */
    getAllGalleries(): GalleryInstance[] {
        return Array.from(this.activeGalleries.values());
    }

    /**
     * Get galleries for specific path
     */
    getGalleriesForPath(path: string): GalleryInstance[] {
        return this.getAllGalleries().filter(gallery => 
            gallery.config.path === path
        );
    }

    /**
     * Refresh all galleries
     */
    async refreshAllGalleries(): Promise<void> {
        const refreshPromises = Array.from(this.activeGalleries.keys())
            .map(id => this.refreshGallery(id));
        
        await Promise.allSettled(refreshPromises);
        console.log('All galleries refreshed');
    }

    /**
     * Destroy all galleries
     */
    destroyAllGalleries(): void {
        const galleryIds = Array.from(this.activeGalleries.keys());
        galleryIds.forEach(id => this.destroyGallery(id));
        console.log(`Destroyed ${galleryIds.length} galleries`);
    }

    /**
     * Get processor statistics
     */
    getStats(): {
        activeGalleries: number;
        totalImages: number;
        cacheStats: any;
    } {
        const galleries = this.getAllGalleries();
        const totalImages = galleries.reduce((sum, gallery) => 
            sum + gallery.totalCount, 0
        );
        
        return {
            activeGalleries: galleries.length,
            totalImages,
            cacheStats: this.contentScanner.getCacheStats?.() || null
        };
    }

    /**
     * Export gallery configuration
     */
    exportGalleryConfig(galleryId: string): IGalleryConfig | null {
        const gallery = this.getGallery(galleryId);
        return gallery ? gallery.config : null;
    }

    /**
     * Validate configuration without creating gallery
     */
    async validateGalleryConfig(source: string): Promise<{ 
        isValid: boolean; 
        config?: IGalleryConfig; 
        errors: string[] 
    }> {
        const errors: string[] = [];
        let config: IGalleryConfig | undefined;
        
        try {
            config = await this.parseConfiguration(source);
            this.validateConfiguration(config);
            return { isValid: true, config, errors: [] };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            return { isValid: false, errors };
        }
    }

    /**
     * Cleanup processor resources
     */
    destroy(): void {
        this.destroyAllGalleries();
        this.contentScanner.destroy?.();
        console.log('Gallery processor destroyed');
    }
}