import { Logger } from "../utils/Logger";
import { IGalleryView, IViewFactory } from '../models/interfaces';
import { DEFAULT_VIEW_TYPE, normalizeViewType } from '../models/viewTypes';
import { ThumbnailView } from './ThumbnailView';
import { CarouselView } from './CarouselView';
import { MasonryView } from './MasonryView';
import { JustifiedView } from './JustifiedView';
import { EmbedView } from './EmbedView';

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
            
        // Register CarouselView (real implementation)
        this.viewTypes.set('carousel', CarouselView);
            
        // Masonry (also used for the legacy `grid` name) and justified rows
        this.viewTypes.set('masonry', MasonryView);
        this.viewTypes.set('justified', JustifiedView);

        // Register EmbedView (continuous, borderless, native-embed feel)
        this.viewTypes.set('embed', EmbedView);
    }

    /**
     * Create a view renderer of the specified type
     */
    createView(type: string, container: HTMLElement): IGalleryView {
        // Accept aliases (grid -> masonry); custom registered types are looked up as given
        const ViewClass = this.viewTypes.get(normalizeViewType(type) ?? type);
        
        if (!ViewClass) {
            throw new Error(`Unknown view type: ${type}. Supported types: ${this.getSupportedTypes().join(', ')}`);
        }
        
        try {
            return new ViewClass(container);
        } catch (error) {
            Logger.error(`Error creating view of type "${type}":`, error);
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
            const testContainer = activeDocument.body.createDiv();
            const testInstance = new viewClass(testContainer);
            
            // Verify required interface
            if (!testInstance.type || !testInstance.render || !testInstance.destroy) {
                throw new Error('View class must implement IGalleryView interface');
            }
            
            // Cleanup test instance
            testInstance.destroy();
            testContainer.remove();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid view class for type "${type}": ${errorMessage}`);
        }
        
        // Register the view type
        this.viewTypes.set(type, viewClass);
        
        Logger.debug(`Gallery view type "${type}" registered successfully`);
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
        return this.viewTypes.has(normalizeViewType(type) ?? type);
    }

    /**
     * Get default view type
     */
    getDefaultViewType(): string {
        return DEFAULT_VIEW_TYPE;
    }

    /**
     * Create view with fallback to default type
     */
    createViewWithFallback(type: string, container: HTMLElement): IGalleryView {
        try {
            return this.createView(type, container);
        } catch (error) {
            Logger.warn(`Failed to create view of type "${type}", falling back to default:`, error);
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
        const viewTypeInfo: Record<string, { name: string; description: string; features: string[] }> = {
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
            masonry: {
                name: 'Masonry',
                description: 'Pinterest-style columns of equal width; each image keeps its height',
                features: ['Masonry layout', 'Responsive columns', 'Preserve aspect ratios', 'Reading order kept']
            },
            justified: {
                name: 'Justified',
                description: 'Rows of equal height that fill the width, like Immich or Google Photos',
                features: ['Justified rows', 'Uncropped images', 'Preserve aspect ratios', 'Responsive rows']
            },
            embed: {
                name: 'Embed',
                description: 'Continuous, borderless vertical stack that feels like a native image embed',
                features: ['Full-width images', 'No card chrome', 'Continuous page feel', 'Click to expand']
            }
        };
        
        return viewTypeInfo[normalizeViewType(type) ?? type] || null;
    }

    /**
     * Create view with configuration
     */
    createViewWithConfig(type: string, container: HTMLElement, config: unknown = {}): IGalleryView {
        const view = this.createView(type, container);
        
        interface ConfigurableView {
            configure(config: unknown): void;
        }

        // Apply configuration if view supports it
        if ('configure' in view && typeof (view as unknown as ConfigurableView).configure === 'function') {
            try {
                (view as unknown as ConfigurableView).configure(config);
            } catch (error) {
                Logger.warn(`Error applying configuration to ${type} view:`, error);
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
                const viewContainer = container.createDiv({ cls: `gallery-view-${type}` });
                const view = this.createView(type, viewContainer);
                views.push(view);
            } catch (error) {
                Logger.error(`Failed to create view of type "${type}":`, error);
            }
        }
        
        return views;
    }
}