import { IGalleryView, IViewFactory } from '../models/interfaces';
import { ThumbnailView } from './ThumbnailView';

/**
 * Factory for creating gallery view renderers
 * Supports extensible view type registration
 */
export class ViewFactory implements IViewFactory {
    private viewTypes: Map<string, new (container: HTMLElement) => IGalleryView> = new Map();
    
    constructor() {
        // Register default view types
        this.registerDefaultViews();
    }

    /**
     * Register default view types
     */
    private registerDefaultViews(): void {
        // Register ThumbnailView
        this.viewTypes.set('thumbnail', ThumbnailView);
        
        // Placeholder views for Phase 4 implementation
        this.viewTypes.set('carousel', class CarouselViewPlaceholder {
            public readonly type = 'carousel' as const;
            public readonly container: HTMLElement;
            public readonly images: any[] = [];
            
            constructor(container: HTMLElement) {
                this.container = container;
            }
            
            render(): void {
                this.container.innerHTML = '<div class="gallery-placeholder">Carousel view - implementation pending</div>';
            }
            
            update(images: any[]): void {
                this.render();
            }
            
            destroy(): void {
                this.container.innerHTML = '';
            }
            
            handleImageLoad(image: any): void {}
            handleImageError(image: any, error: Error): void {}
            isImageVisible(image: any): boolean { return false; }
        } as any);
        
        this.viewTypes.set('grid', class GridViewPlaceholder {
            public readonly type = 'grid' as const;
            public readonly container: HTMLElement;
            public readonly images: any[] = [];
            
            constructor(container: HTMLElement) {
                this.container = container;
            }
            
            render(): void {
                this.container.innerHTML = '<div class="gallery-placeholder">Grid view - implementation pending</div>';
            }
            
            update(images: any[]): void {
                this.render();
            }
            
            destroy(): void {
                this.container.innerHTML = '';
            }
            
            handleImageLoad(image: any): void {}
            handleImageError(image: any, error: Error): void {}
            isImageVisible(image: any): boolean { return false; }
        } as any);
    }

    /**
     * Create a view renderer of the specified type
     */
    createView(type: string, container: HTMLElement): IGalleryView {
        const ViewClass = this.viewTypes.get(type);
        
        if (!ViewClass) {
            throw new Error(`Unknown view type: ${type}. Supported types: ${this.getSupportedTypes().join(', ')}`);
        }
        
        try {
            return new ViewClass(container);
        } catch (error) {
            console.error(`Error creating view of type "${type}":`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create ${type} view: ${errorMessage}`);
        }
    }

    /**
     * Get list of supported view types
     */
    getSupportedTypes(): string[] {
        return Array.from(this.viewTypes.keys());
    }

    /**
     * Register a new view type
     */
    registerViewType(type: string, viewClass: new (container: HTMLElement) => IGalleryView): void {
        if (!type || typeof type !== 'string') {
            throw new Error('View type must be a non-empty string');
        }
        
        if (!viewClass || typeof viewClass !== 'function') {
            throw new Error('View class must be a constructor function');
        }
        
        // Test that the view class is valid by creating a temporary instance
        try {
            const testContainer = document.createElement('div');
            const testInstance = new viewClass(testContainer);
            
            // Verify required interface
            if (!testInstance.type || !testInstance.render || !testInstance.destroy) {
                throw new Error('View class must implement IGalleryView interface');
            }
            
            // Cleanup test instance
            testInstance.destroy();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid view class for type "${type}": ${errorMessage}`);
        }
        
        // Register the view type
        this.viewTypes.set(type, viewClass);
        
        console.log(`Gallery view type "${type}" registered successfully`);
    }

    /**
     * Unregister a view type
     */
    unregisterViewType(type: string): boolean {
        return this.viewTypes.delete(type);
    }

    /**
     * Check if view type is supported
     */
    isViewTypeSupported(type: string): boolean {
        return this.viewTypes.has(type);
    }

    /**
     * Get default view type
     */
    getDefaultViewType(): string {
        return 'thumbnail';
    }

    /**
     * Create view with fallback to default type
     */
    createViewWithFallback(type: string, container: HTMLElement): IGalleryView {
        try {
            return this.createView(type, container);
        } catch (error) {
            console.warn(`Failed to create view of type "${type}", falling back to default:`, error);
            return this.createView(this.getDefaultViewType(), container);
        }
    }

    /**
     * Validate view type and suggest alternatives
     */
    validateViewType(type: string): { isValid: boolean; suggestions?: string[] } {
        if (this.isViewTypeSupported(type)) {
            return { isValid: true };
        }
        
        // Find similar view types
        const supportedTypes = this.getSupportedTypes();
        const suggestions = supportedTypes.filter(supportedType => 
            supportedType.toLowerCase().includes(type.toLowerCase()) ||
            type.toLowerCase().includes(supportedType.toLowerCase())
        );
        
        return {
            isValid: false,
            suggestions: suggestions.length > 0 ? suggestions : supportedTypes
        };
    }

    /**
     * Get view type metadata
     */
    getViewTypeInfo(type: string): { 
        name: string; 
        description: string; 
        features: string[] 
    } | null {
        const viewTypeInfo: Record<string, any> = {
            thumbnail: {
                name: 'Thumbnail Grid',
                description: 'Displays images in a responsive grid layout with thumbnail previews',
                features: ['Grid layout', 'Lazy loading', 'Responsive design', 'Click to expand']
            },
            carousel: {
                name: 'Carousel',
                description: 'Horizontal scrolling carousel with navigation controls',
                features: ['Horizontal scrolling', 'Navigation arrows', 'Touch gestures', 'Keyboard navigation']
            },
            grid: {
                name: 'Masonry Grid',
                description: 'Pinterest-style masonry grid with variable heights',
                features: ['Masonry layout', 'Responsive columns', 'Preserve aspect ratios', 'Dynamic sizing']
            }
        };
        
        return viewTypeInfo[type] || null;
    }

    /**
     * Create view with configuration
     */
    createViewWithConfig(type: string, container: HTMLElement, config: any = {}): IGalleryView {
        const view = this.createView(type, container);
        
        // Apply configuration if view supports it
        if ('configure' in view && typeof (view as any).configure === 'function') {
            try {
                (view as any).configure(config);
            } catch (error) {
                console.warn(`Error applying configuration to ${type} view:`, error);
            }
        }
        
        return view;
    }

    /**
     * Get factory statistics
     */
    getFactoryStats(): {
        registeredTypes: number;
        supportedTypes: string[];
        defaultType: string;
    } {
        return {
            registeredTypes: this.viewTypes.size,
            supportedTypes: this.getSupportedTypes(),
            defaultType: this.getDefaultViewType()
        };
    }

    /**
     * Reset factory to default state
     */
    reset(): void {
        this.viewTypes.clear();
        this.registerDefaultViews();
    }

    /**
     * Create multiple views for comparison
     */
    createMultipleViews(types: string[], container: HTMLElement): IGalleryView[] {
        const views: IGalleryView[] = [];
        
        for (const type of types) {
            try {
                const viewContainer = container.createEl('div', { cls: `gallery-view-${type}` });
                const view = this.createView(type, viewContainer);
                views.push(view);
            } catch (error) {
                console.error(`Failed to create view of type "${type}":`, error);
            }
        }
        
        return views;
    }
}