import { Plugin, TFile } from 'obsidian';
import { FileSizeValidator } from './src/utils/FileSizeValidator';
import { ImageLoader } from './src/utils/ImageLoader';
import { VaultWatcher } from './src/utils/VaultWatcher';
import { ImageValidator } from './src/utils/ImageValidator';
import { LazyLoader } from './src/utils/LazyLoader';

export default class GalleryPlugin extends Plugin {
    private vaultWatcher: VaultWatcher | null = null;
    private lazyLoader: LazyLoader | null = null;
    
    async onload() {
        console.log('Loading Gallery Plugin');

        // Initialize lazy loader
        this.lazyLoader = new LazyLoader({
            rootMargin: '100px',
            threshold: 0.1,
            retryAttempts: 3,
            retryDelay: 1000
        });

        // Initialize vault watcher for automatic gallery updates
        this.vaultWatcher = new VaultWatcher(
            this.app.vault,
            {
                onFileAdded: () => this.refreshGalleries(),
                onFileDeleted: () => this.refreshGalleries(),
                onFileRenamed: () => this.refreshGalleries(),
                onFileModified: () => this.refreshGalleries()
            },
            {
                debounceMs: 1000,
                enableLogging: false
            }
        );
        this.vaultWatcher.start();

        // Register the obs-gallery code block processor
        this.registerMarkdownCodeBlockProcessor(
            'obs-gallery',
            (source: string, el: HTMLElement, ctx) => {
                this.processGallery(source, el);
            }
        );

        console.log('Gallery Plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Gallery Plugin');
        
        // Clean up vault watcher
        if (this.vaultWatcher) {
            this.vaultWatcher.stop();
            this.vaultWatcher = null;
        }
        
        // Clean up lazy loader
        if (this.lazyLoader) {
            this.lazyLoader.disconnect();
            this.lazyLoader = null;
        }
    }

    /**
     * Refresh all active galleries when vault files change
     */
    private refreshGalleries(): void {
        console.log('Refreshing galleries due to vault changes');
        
        // Find all gallery containers and refresh them
        const galleryContainers = document.querySelectorAll('.gallery-container');
        galleryContainers.forEach(container => {
            const codeBlock = container.closest('.block-language-obs-gallery');
            if (codeBlock) {
                // Find the original source and reprocess
                const sourceEl = codeBlock.querySelector('code');
                if (sourceEl && container.parentElement) {
                    const source = sourceEl.textContent || '';
                    container.parentElement.innerHTML = ''; // Clear existing content
                    this.processGallery(source, container.parentElement);
                }
            }
        });
    }

    /**
     * Validate image array using ImageValidator
     */
    private async validateImages(images: Array<{ path: string; name: string; originalPath?: string }>): Promise<any[]> {
        const validationPromises = images.map(async (image) => {
            try {
                // Use original path for validation if available, otherwise use path
                const pathToValidate = image.originalPath || image.path;
                
                // Check if it's a local file or external URL
                if (pathToValidate.startsWith('http://') || pathToValidate.startsWith('https://')) {
                    const urlValidation = ImageValidator.validateImageUrl(pathToValidate);
                    return {
                        isValid: urlValidation.isValid,
                        errors: urlValidation.isValid ? [] : [urlValidation.message || 'Invalid URL'],
                        warnings: urlValidation.message && urlValidation.isValid ? [urlValidation.message] : []
                    };
                } else {
                    // For local files, use the existing validation method
                    const validation = await ImageValidator.validateImage(pathToValidate);
                    return {
                        isValid: validation.isValid,
                        errors: validation.errors,
                        warnings: validation.warnings
                    };
                }
            } catch (error) {
                return {
                    isValid: false,
                    errors: [error instanceof Error ? error.message : 'Validation failed'],
                    warnings: []
                };
            }
        });

        return Promise.all(validationPromises);
    }

    /**
     * Render images with lazy loading
     */
    private async renderImagesWithLazyLoading(
        images: Array<{ path: string; name: string; originalPath?: string }>, 
        container: HTMLElement
    ): Promise<void> {
        if (!this.lazyLoader) {
            // Fallback to immediate loading
            this.renderImagesImmediate(images, container);
            return;
        }

        for (const image of images) {
            const itemEl = container.createDiv({ cls: 'gallery-thumbnail-item' });
            const imgEl = itemEl.createEl('img', {
                cls: 'gallery-thumbnail-image',
                attr: { 
                    alt: image.name,
                    'data-src': image.path
                }
            });
            
            // Set up lazy loading
            this.lazyLoader.observe(imgEl, image.path);
            
            // Add click handler
            itemEl.addEventListener('click', (e: Event) => {
                console.log('Thumbnail clicked!', image.name);
                e.preventDefault();
                e.stopPropagation();
                this.showImageModal(image);
            });
            
            // Add cursor pointer style
            itemEl.style.cursor = 'pointer';
        }
    }

    /**
     * Render images immediately (fallback)
     */
    private renderImagesImmediate(
        images: Array<{ path: string; name: string; originalPath?: string }>, 
        container: HTMLElement
    ): void {
        images.forEach(image => {
            const itemEl = container.createDiv({ cls: 'gallery-thumbnail-item' });
            const imgEl = itemEl.createEl('img', {
                cls: 'gallery-thumbnail-image',
                attr: { 
                    src: image.path,
                    alt: image.name,
                    loading: 'lazy'
                }
            });
            
            // Add click handler
            itemEl.addEventListener('click', (e: Event) => {
                console.log('Thumbnail clicked!', image.name);
                e.preventDefault();
                e.stopPropagation();
                this.showImageModal(image);
            });
            
            // Add cursor pointer style
            itemEl.style.cursor = 'pointer';
        });
    }

    private processGallery(source: string, container: HTMLElement): void {
        try {
            // Parse simple configuration
            const config = this.parseConfig(source);
            
            // Create gallery
            this.createSimpleGallery(config, container);
            
        } catch (error) {
            container.createEl('div', {
                text: `Gallery Error: ${error instanceof Error ? error.message : String(error)}`,
                cls: 'gallery-error'
            });
        }
    }

    private parseConfig(source: string): { path: string; view: string } {
        const lines = source.trim().split('\n');
        const config: any = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.includes(':')) {
                const [key, value] = trimmed.split(':').map(s => s.trim());
                config[key] = value;
            } else {
                // Single line assumed to be path
                config.path = trimmed;
            }
        }
        
        if (!config.path) {
            throw new Error('Path is required');
        }
        
        return {
            path: config.path,
            view: config.view || 'thumbnail'
        };
    }

    private async createSimpleGallery(config: { path: string; view: string }, container: HTMLElement): Promise<void> {
        // Show loading
        const loadingEl = container.createEl('div', { 
            cls: 'gallery-loading',
            text: 'Loading gallery...'
        });

        try {
            // Get images from path with validation
            const images = await this.scanForImages(config.path);
            
            // Remove loading
            loadingEl.remove();
            
            if (images.length === 0) {
                container.createEl('div', { 
                    cls: 'gallery-empty',
                    text: `No images found in: ${config.path}`
                });
                return;
            }

            // Create gallery container
            const galleryEl = container.createEl('div', { cls: 'gallery-container gallery-thumbnail-grid' });

            // Validate images before displaying (simplified validation)
            const validationResults = await this.validateImages(images);
            const validImages = images.filter((image, index) => {
                const result = validationResults[index];
                if (!result.isValid) {
                    console.warn(`Image validation failed for ${image.originalPath || image.path}:`, result.errors);
                }
                // For now, let's be permissive and only exclude if there are serious errors
                // Since scanning already filtered by extension, most images should be valid
                return result.isValid || result.errors.length === 0 || 
                       result.errors.every((error: string) => error.includes('Size unknown') || error.includes('no Content-Length'));
            });
            
            if (validImages.length === 0) {
                console.error('All images failed validation:', validationResults);
                // Let's show the original images anyway if validation is too strict
                const fallbackImages = images;
                console.log('Using fallback images without strict validation');
                await this.renderImagesWithLazyLoading(fallbackImages, galleryEl);
                console.log(`Gallery created with ${fallbackImages.length} images (validation bypassed)`);
                return;
            }

            // Show validation warnings if any
            const warnings = validationResults.filter((result: any) => result.warnings.length > 0);
            if (warnings.length > 0) {
                const warningEl = container.createEl('div', { 
                    cls: 'gallery-warnings',
                    text: `${warnings.length} image(s) have warnings - check console for details`
                });
                console.warn('Gallery validation warnings:', warnings);
            }

            // Render images with lazy loading
            await this.renderImagesWithLazyLoading(validImages, galleryEl);
            
            console.log(`Gallery created with ${validImages.length} valid images (${images.length} total scanned)`);
            
        } catch (error) {
            loadingEl.remove();
            container.createEl('div', {
                text: `Failed to load gallery: ${error instanceof Error ? error.message : String(error)}`,
                cls: 'gallery-error'
            });
        }
    }

    private async scanForImages(path: string): Promise<Array<{ path: string; name: string; originalPath?: string }>> {
        const images: Array<{ path: string; name: string; originalPath?: string }> = [];
        const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        try {
            // Get folder or file
            const abstractFile = this.app.vault.getAbstractFileByPath(path);
            
            if (!abstractFile) {
                throw new Error(`Path not found: ${path}`);
            }
            
            if (abstractFile instanceof TFile) {
                // Single file
                const ext = abstractFile.extension.toLowerCase();
                if (supportedExtensions.includes(`.${ext}`)) {
                    const resourcePath = this.app.vault.adapter.getResourcePath(abstractFile.path);
                    images.push({
                        path: resourcePath,
                        name: abstractFile.basename,
                        originalPath: abstractFile.path
                    });
                }
            } else {
                // Folder - get all files
                const files = this.app.vault.getFiles();
                const folderFiles = files.filter(file => file.path.startsWith(path + '/'));
                
                for (const file of folderFiles) {
                    const ext = file.extension.toLowerCase();
                    if (supportedExtensions.includes(`.${ext}`)) {
                        const resourcePath = this.app.vault.adapter.getResourcePath(file.path);
                        images.push({
                            path: resourcePath,
                            name: file.basename,
                            originalPath: file.path
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning for images:', error);
            throw error;
        }
        
        return images;
    }

    private showImageModal(image: { path: string; name: string }): void {
        console.log('showImageModal called with:', image);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'gallery-modal';
        document.body.appendChild(modal);
        
        console.log('Modal created and added to body');
        
        // Close on click outside
        modal.addEventListener('click', (e: Event) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on escape
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', onEscape);
            }
        };
        document.addEventListener('keydown', onEscape);
        
        // Create content
        const content = document.createElement('div');
        content.className = 'gallery-modal-content';
        modal.appendChild(content);
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'gallery-modal-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => modal.remove());
        content.appendChild(closeBtn);
        
        // Image container
        const imgContainer = document.createElement('div');
        imgContainer.className = 'gallery-modal-image';
        content.appendChild(imgContainer);
        
        // Image
        const img = document.createElement('img');
        img.src = image.path;
        img.alt = image.name;
        imgContainer.appendChild(img);
        
        // Info
        const info = document.createElement('div');
        info.className = 'gallery-modal-info';
        content.appendChild(info);
        
        const title = document.createElement('h3');
        title.textContent = image.name;
        info.appendChild(title);
    }
}