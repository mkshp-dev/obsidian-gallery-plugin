import { Plugin, TFile } from 'obsidian';

export default class GalleryPlugin extends Plugin {
    async onload() {
        console.log('Loading Gallery Plugin');

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
            // Get images from path
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
            
            // Render images
            images.forEach(image => {
                const itemEl = galleryEl.createEl('div', { cls: 'gallery-thumbnail-item' });
                const imgEl = itemEl.createEl('img', {
                    cls: 'gallery-thumbnail-image',
                    attr: { 
                        src: image.path,
                        alt: image.name,
                        loading: 'lazy'
                    }
                });
                
                // Add click handler
                itemEl.addEventListener('click', () => {
                    this.showImageModal(image);
                });
            });
            
            console.log(`Gallery created with ${images.length} images`);
            
        } catch (error) {
            loadingEl.remove();
            container.createEl('div', {
                text: `Failed to load gallery: ${error instanceof Error ? error.message : String(error)}`,
                cls: 'gallery-error'
            });
        }
    }

    private async scanForImages(path: string): Promise<Array<{ path: string; name: string }>> {
        const images: Array<{ path: string; name: string }> = [];
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
                        name: abstractFile.basename
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
                            name: file.basename
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
        // Create modal
        const modal = document.body.createEl('div', { cls: 'gallery-modal' });
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
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
        const content = modal.createEl('div', { cls: 'gallery-modal-content' });
        
        // Close button
        const closeBtn = content.createEl('button', { cls: 'gallery-modal-close', text: '×' });
        closeBtn.addEventListener('click', () => modal.remove());
        
        // Image
        const imgContainer = content.createEl('div', { cls: 'gallery-modal-image' });
        imgContainer.createEl('img', { 
            attr: { src: image.path, alt: image.name }
        });
        
        // Info
        const info = content.createEl('div', { cls: 'gallery-modal-info' });
        info.createEl('h3', { text: image.name });
    }
}