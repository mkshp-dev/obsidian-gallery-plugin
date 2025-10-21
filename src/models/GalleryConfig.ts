import { IGalleryConfig } from './interfaces';

/**
 * Gallery configuration parsed from code block parameters
 * Represents the validated configuration for a gallery instance
 */
export class GalleryConfig implements IGalleryConfig {
    public readonly path: string;
    public readonly view: 'thumbnail' | 'carousel' | 'grid';
    public readonly recursive: boolean;

    constructor(config: Partial<IGalleryConfig>) {
        // Validate required path
        if (!config.path || typeof config.path !== 'string' || config.path.trim() === '') {
            throw new Error('Gallery path is required and must be a non-empty string');
        }

        // Sanitize and validate path
        this.path = this.sanitizePath(config.path.trim());
        
        // Set defaults for optional parameters
        this.view = config.view || 'thumbnail';
        this.recursive = config.recursive !== undefined ? config.recursive : true;

        // Validate view type
        if (!['thumbnail', 'carousel', 'grid'].includes(this.view)) {
            throw new Error(`Invalid view type: ${this.view}. Must be one of: thumbnail, carousel, grid`);
        }
    }

    /**
     * Sanitize path to prevent directory traversal and normalize format
     */
    private sanitizePath(path: string): string {
        // Remove directory traversal patterns
        if (path.includes('..')) {
            throw new Error('Path cannot contain directory traversal patterns (..)');
        }

        // Normalize path separators
        const normalizedPath = path.replace(/\\/g, '/');

        // Remove leading slash if present
        return normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
    }

    /**
     * Create GalleryConfig from raw YAML data
     */
    static fromYaml(yamlData: any): GalleryConfig {
        if (typeof yamlData !== 'object' || yamlData === null) {
            throw new Error('Gallery configuration must be an object');
        }

        return new GalleryConfig({
            path: yamlData.path,
            view: yamlData.view,
            recursive: yamlData.recursive
        });
    }

    /**
     * Validate configuration completeness
     */
    isValid(): boolean {
        try {
            return this.path.length > 0 && 
                   ['thumbnail', 'carousel', 'grid'].includes(this.view) &&
                   typeof this.recursive === 'boolean';
        } catch {
            return false;
        }
    }

    /**
     * Get configuration as plain object
     */
    toObject(): IGalleryConfig {
        return {
            path: this.path,
            view: this.view,
            recursive: this.recursive
        };
    }

    /**
     * Create a copy with updated properties
     */
    update(updates: Partial<IGalleryConfig>): GalleryConfig {
        return new GalleryConfig({
            ...this.toObject(),
            ...updates
        });
    }
}