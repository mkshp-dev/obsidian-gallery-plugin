import { IGalleryConfig, ISourceConfig, IViewConfig } from './interfaces';

/**
 * Gallery configuration parsed from code block parameters
 * Represents the validated configuration for a gallery instance
 */
export class GalleryConfig implements IGalleryConfig {
    public readonly path: string;
    public readonly view: IViewConfig;
    public readonly recursive: boolean;
    public readonly urls?: (string | { url: string; caption?: string })[];
    public readonly sources: ISourceConfig[];

    constructor(config: Partial<IGalleryConfig> & { urls?: (string | { url: string; caption?: string })[], sources?: ISourceConfig[] }) {
        this.sources = config.sources || [];

        if (config.path && typeof config.path === 'string' && config.path.trim() !== '') {
            this.sources.push({
                type: 'local',
                path: this.sanitizePath(config.path.trim()),
                recursive: config.recursive !== undefined ? config.recursive : true
            });
        }

        if (config.urls && config.urls.length > 0) {
            this.sources.push({
                type: 'external',
                urls: config.urls
            });
        }

        if (this.sources.length === 0) {
            throw new Error('Gallery sources are required (either in sources array, or via path/urls)');
        }

        // Set up the view object
        let viewType: string = 'thumbnail';
        if (config.view) {
            if (typeof config.view === 'string') {
                viewType = config.view;
                this.view = { type: viewType as 'thumbnail' | 'carousel' | 'grid' };
            } else if (typeof config.view === 'object' && config.view !== null) {
                this.view = config.view;
                viewType = this.view.type || 'thumbnail';
            } else {
                this.view = { type: 'thumbnail' };
            }
        } else {
            this.view = { type: 'thumbnail' };
        }

        // Set properties for backward compatibility
        this.path = config.path && typeof config.path === 'string' ? this.sanitizePath(config.path.trim()) : '';
        this.recursive = config.recursive !== undefined ? config.recursive : true;
        this.urls = config.urls;

        // Validate view type
        if (!['thumbnail', 'carousel', 'grid'].includes(viewType)) {
            throw new Error(`Invalid view type: ${viewType}. Must be one of: thumbnail, carousel, grid`);
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
    static fromYaml(yamlData: unknown): GalleryConfig {
        if (typeof yamlData !== 'object' || yamlData === null) {
            throw new Error('Gallery configuration must be an object');
        }

        const data = yamlData as Record<string, unknown>;
        let viewType: IViewConfig | undefined;
        if (data.view) {
            if (typeof data.view === 'string' && ['thumbnail', 'carousel', 'grid'].includes(data.view)) {
                viewType = { type: data.view as 'thumbnail' | 'carousel' | 'grid' };
            } else if (typeof data.view === 'object' && data.view !== null) {
                viewType = data.view as IViewConfig;
            }
        }

        return new GalleryConfig({
            path: typeof data.path === 'string' ? data.path : undefined,
            view: viewType,
            recursive: typeof data.recursive === 'boolean' ? data.recursive : undefined,
            urls: Array.isArray(data.urls) ? (data.urls as (string | { url: string; caption?: string })[]) : undefined,
            sources: Array.isArray(data.sources) ? (data.sources as ISourceConfig[]) : undefined
        });
    }

    /**
     * Validate configuration completeness
     */
    isValid(): boolean {
        try {
            return this.sources.length > 0 &&
                ['thumbnail', 'carousel', 'grid'].includes(this.view.type);
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
            recursive: this.recursive,
            urls: this.urls,
            sources: this.sources
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