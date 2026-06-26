import { parseYaml, stringifyYaml } from 'obsidian';
import { IGalleryConfig, IConfigError } from '../models/interfaces';
import { GalleryConfig } from '../models/GalleryConfig';

class ConfigError extends Error implements IConfigError {
    readonly type = 'config' as const;
    field: string;
    suggestion?: string;

    constructor(field: string, message: string, suggestion?: string) {
        super(message);
        this.field = field;
        this.suggestion = suggestion;
        Object.setPrototypeOf(this, ConfigError.prototype);
    }
}

/**
 * YAML parameter parser for gallery code blocks
 * Handles parsing and validation of gallery configuration
 */
export class ParameterParser {
    private static readonly ALLOWED_KEYS = ['path', 'view', 'recursive', 'urls', 'sources'];
    private static readonly VIEW_TYPES = ['thumbnail', 'carousel', 'grid'];

    /**
     * Parse YAML content from code block
     */
    static parseYaml(content: string): IGalleryConfig {
        if (!content || content.trim() === '') {
            throw this.createConfigError('content', 'Gallery configuration cannot be empty', 
                'Provide at least a path parameter');
        }

        // Normalize common problematic whitespace and indentation issues that users paste
        // from rich text sources (non-breaking spaces, tabs) which break YAML parsing.
        let normalizedContent = content.replace(/\u00A0/g, ' '); // NBSP -> space
        normalizedContent = normalizedContent.replace(/\t/g, '  '); // tabs -> two spaces
        normalizedContent = normalizedContent.replace(/\r\n/g, '\n').trim();

        // If the config contains a 'urls:' list, ensure the list items are indented
        // (some copy/pastes produce lines starting at column 0 which makes YAML think
        // the mapping ended). We only adjust dashes immediately following the urls: line.
        if (/^\s*urls\s*:/mi.test(normalizedContent)) {
            const lines = normalizedContent.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (/^\s*urls\s*:/i.test(lines[i])) {
                    // Normalize following list item lines until a non-list, non-empty line
                    for (let j = i + 1; j < lines.length; j++) {
                        const line = lines[j];
                        if (line.trim() === '') break;
                        // If line starts with a dash but is not indented at least two spaces,
                        // prefix with two spaces so it's treated as a sequence under urls:
                        if (/^\s*-\s+/.test(line) && !/^\s{2,}-\s+/.test(line)) {
                            lines[j] = '  ' + line.trim();
                            continue;
                        }
                        // If the line does not start with '-' at all, stop adjusting (end of list)
                        if (!/^\s*-\s+/.test(line)) break;
                    }
                    break;
                }
            }
            normalizedContent = lines.join('\n');
        }

        let parsedData: unknown;
        try {
            // Try parsing normalized YAML
            parsedData = parseYaml(normalizedContent);
        } catch (yamlError) {
            // If YAML parsing fails, try simple key-value parsing on the normalized content
            try {
                parsedData = this.parseSimpleFormat(normalizedContent);
            } catch {
                throw this.createConfigError(
                    'yaml-syntax',
                    `Invalid YAML syntax: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
                    'Check your YAML formatting (ensure list items under urls: are indented).'
                );
            }
        }

        // Validate parsed data structure
        if (parsedData === null || parsedData === undefined) {
            throw this.createConfigError('content', 'Gallery configuration is empty',
                'Provide at least a path parameter');
        }

        if (typeof parsedData === 'string') {
            // Handle case where only a path is provided as a string
            parsedData = { path: parsedData };
        }

        if (typeof parsedData !== 'object') {
            throw this.createConfigError('format', 'Gallery configuration must be an object',
                'Use YAML format with key-value pairs');
        }

        // Validate configuration keys
        this.validateKeys(parsedData as Record<string, unknown>);

        // Create and validate GalleryConfig
        try {
            return GalleryConfig.fromYaml(parsedData);
        } catch (error) {
            throw this.createConfigError('validation', error instanceof Error ? error.message : String(error),
                'Check the parameter documentation for valid values');
        }
    }

    /**
     * Parse simple key=value format as fallback
     */
    private static parseSimpleFormat(content: string): unknown {
        const result: Record<string, unknown> = {};
        const lines = content.trim().split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue; // Skip empty lines and comments
            }

            // Handle key=value or key: value format
            let match = trimmedLine.match(/^(\w+)\s*[=:]\s*(.+)$/);
            if (!match) {
                // Try single word as path
                if (trimmedLine && !trimmedLine.includes(' ')) {
                    result.path = trimmedLine;
                    continue;
                }
                throw new Error(`Invalid line format: ${trimmedLine}`);
            }

            const [, key, value] = match;
            result[key] = this.parseValue(value.trim());
        }

        return result;
    }

    /**
     * Parse individual value with type conversion
     */
    private static parseValue(value: string): unknown {
        // Remove quotes if present
        const unquoted = value.replace(/^["']|["']$/g, '');
        
        // Convert boolean values
        if (unquoted.toLowerCase() === 'true') return true;
        if (unquoted.toLowerCase() === 'false') return false;
        
        // Convert numbers
        if (/^\d+$/.test(unquoted)) return parseInt(unquoted, 10);
        if (/^\d+\.\d+$/.test(unquoted)) return parseFloat(unquoted);
        
        return unquoted;
    }

    /**
     * Validate configuration keys
     */
    private static validateKeys(config: Record<string, unknown>): void {
        const providedKeys = Object.keys(config);
        const invalidKeys = providedKeys.filter(key => !this.ALLOWED_KEYS.includes(key));
        
        if (invalidKeys.length > 0) {
            throw this.createConfigError('unknown_key', 
                `Unknown configuration keys: ${invalidKeys.join(', ')}`,
                `Valid keys are: ${this.ALLOWED_KEYS.join(', ')}`);
        }

        // Validate required keys: either path, urls, or sources must be provided
        if (!config.path && !config.urls && (!config.sources || !Array.isArray(config.sources) || config.sources.length === 0)) {
            throw this.createConfigError('missing_path_or_urls', 
                'Either "path", "urls", or "sources" must be provided',
                'Add "path: your/folder/path" or a list of remote "urls:" to the configuration');
        }

        // Validate view type if provided
        const view = config.view;
        if (view) {
            let viewType = '';
            if (typeof view === 'string') {
                viewType = view;
            } else if (typeof view === 'object' && view !== null && 'type' in view) {
                viewType = (view as { type: string }).type;
            }
            if (viewType && !this.VIEW_TYPES.includes(viewType)) {
                throw this.createConfigError('invalid_view',
                    `View type must be a string (Use one of: ${this.VIEW_TYPES.join(', ')})`,
                    `Valid view types are: ${this.VIEW_TYPES.join(', ')}`);
            }
        }

        // Validate recursive parameter
        if (config.recursive !== undefined && typeof config.recursive !== 'boolean') {
            throw this.createConfigError('invalid_recursive',
                'Recursive parameter must be true or false',
                'Use "recursive: true" or "recursive: false"');
        }
    }

    /**
     * Create structured configuration error
     */
    private static createConfigError(field: string, message: string, suggestion?: string): ConfigError {
        return new ConfigError(field, message, suggestion);
    }

    /**
     * Validate configuration completeness
     */
    static validateConfig(config: IGalleryConfig): IConfigError[] {
        const errors: IConfigError[] = [];

        // Path validation
        if ((!config.path || config.path.trim() === '') && !config.urls && (!config.sources || config.sources.length === 0)) {
            errors.push(this.createConfigError('path_or_urls', 'Path cannot be empty unless urls or sources are provided'));
        } else if (config.path && config.path.includes('..')) {
            errors.push(this.createConfigError('path', 
                'Path cannot contain directory traversal (..)'));
        }

        // View validation
        if (config.view) {
            let viewType = '';
            if (typeof config.view === 'string') {
                viewType = config.view;
            } else if (typeof config.view === 'object' && config.view !== null && 'type' in config.view) {
                viewType = (config.view as { type: string }).type;
            }
            if (viewType && !this.VIEW_TYPES.includes(viewType)) {
                errors.push(this.createConfigError('view',
                    `View type must be a string (Use one of: ${this.VIEW_TYPES.join(', ')})`,
                    `Valid types: ${this.VIEW_TYPES.join(', ')}`));
            }
        }

        // Recursive validation
        if (config.recursive !== undefined && typeof config.recursive !== 'boolean') {
            errors.push(this.createConfigError('recursive', 
                'Recursive must be a boolean value'));
        }

        // Validate immich source specifically
        if (config.sources) {
            for (let i = 0; i < config.sources.length; i++) {
                const source = config.sources[i];
                if (source.type === 'immich') {
                    if (typeof source.connection !== 'string' || !source.connection.trim()) {
                        errors.push(this.createConfigError(`sources[${i}].connection`,
                            'Immich source requires a "connection" string key'));
                    }
                    if (source.filters !== undefined && (typeof source.filters !== 'object' || source.filters === null)) {
                        errors.push(this.createConfigError(`sources[${i}].filters`,
                            'Immich source "filters" must be an object'));
                    } else if (source.filters) {
                        if (source.filters.albumIds !== undefined && (!Array.isArray(source.filters.albumIds) || !source.filters.albumIds.every(id => typeof id === 'string'))) {
                            errors.push(this.createConfigError(`sources[${i}].filters.albumIds`,
                                'Immich source "filters.albumIds" must be an array of strings'));
                        }
                        if (source.filters.isFavorite !== undefined && typeof source.filters.isFavorite !== 'boolean') {
                            errors.push(this.createConfigError(`sources[${i}].filters.isFavorite`,
                                'Immich source "filters.isFavorite" must be a boolean'));
                        }
                        if (source.filters.createdAfter !== undefined && (typeof source.filters.createdAfter !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.filters.createdAfter))) {
                            errors.push(this.createConfigError(`sources[${i}].filters.createdAfter`,
                                'Immich source "filters.createdAfter" must be a string in YYYY-MM-DD format'));
                        }
                        if (source.filters.createdBefore !== undefined && (typeof source.filters.createdBefore !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(source.filters.createdBefore))) {
                            errors.push(this.createConfigError(`sources[${i}].filters.createdBefore`,
                                'Immich source "filters.createdBefore" must be a string in YYYY-MM-DD format'));
                        }
                        if (source.filters.assetType !== undefined && source.filters.assetType !== 'image' && source.filters.assetType !== 'video') {
                            errors.push(this.createConfigError(`sources[${i}].filters.assetType`,
                                'Immich source "filters.assetType" must be either "image" or "video"'));
                        }
                    }
                    if (source.limit !== undefined && typeof source.limit !== 'number') {
                        errors.push(this.createConfigError(`sources[${i}].limit`,
                            'Immich source "limit" must be a number'));
                    }
                    if (source.sort !== undefined && (typeof source.sort !== 'object' || source.sort === null)) {
                        errors.push(this.createConfigError(`sources[${i}].sort`,
                            'Immich source "sort" must be an object'));
                    } else if (source.sort) {
                        if (source.sort.by !== 'createdAt') {
                            errors.push(this.createConfigError(`sources[${i}].sort.by`,
                                'Immich source "sort.by" must be "createdAt"'));
                        }
                        if (source.sort.order !== undefined && source.sort.order !== 'asc' && source.sort.order !== 'desc') {
                            errors.push(this.createConfigError(`sources[${i}].sort.order`,
                                'Immich source "sort.order" must be "asc" or "desc"'));
                        }
                    }
                }
            }
        }

        return errors;
    }

    /**
     * Get default configuration
     */
    static getDefaultConfig(): Partial<IGalleryConfig> {
        return {
            view: 'thumbnail',
            recursive: true
        };
    }

    /**
     * Merge configuration with defaults
     */
    static mergeWithDefaults(config: Partial<IGalleryConfig>): IGalleryConfig {
        const defaults = this.getDefaultConfig();
        return {
            path: config.path || '',
            view: config.view || defaults.view!,
            recursive: config.recursive !== undefined ? config.recursive : defaults.recursive!
        };
    }

    /**
     * Parse and validate configuration in one step
     */
    static parseAndValidate(content: string): IGalleryConfig {
        const config = this.parseYaml(content);
        const errors = this.validateConfig(config);
        
        if (errors.length > 0) {
            const errorMessages = errors.map(err => 
                err.suggestion ? `${err.message} (${err.suggestion})` : err.message
            ).join('; ');
            
            throw new Error(`Configuration validation failed: ${errorMessages}`);
        }
        
        return config;
    }

    /**
     * Get supported view types
     */
    static getSupportedViewTypes(): string[] {
        return [...this.VIEW_TYPES];
    }

    /**
     * Get allowed configuration keys
     */
    static getAllowedKeys(): string[] {
        return [...this.ALLOWED_KEYS];
    }

    /**
     * Generate example configuration
     */
    static generateExample(): string {
        return `path: images/gallery
view: thumbnail
recursive: true`;
    }

    /**
     * Format configuration as YAML string
     */
    static formatAsYaml(config: IGalleryConfig): string {
        const out: Record<string, unknown> = {};
        if (config.sources && config.sources.length > 0) {
            out.sources = config.sources;
        } else {
            if (config.path) out.path = config.path;
            if (config.urls) out.urls = config.urls;
            if (config.recursive !== undefined) out.recursive = config.recursive;
        }
        out.view = config.view;
        return stringifyYaml(out);
    }
}