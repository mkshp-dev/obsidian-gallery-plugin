import * as yaml from 'js-yaml';
import { IGalleryConfig, IConfigError } from '../models/interfaces';
import { GalleryConfig } from '../models/GalleryConfig';

/**
 * YAML parameter parser for gallery code blocks
 * Handles parsing and validation of gallery configuration
 */
export class ParameterParser {
    private static readonly ALLOWED_KEYS = ['path', 'view', 'recursive'];
    private static readonly VIEW_TYPES = ['thumbnail', 'carousel', 'grid'];

    /**
     * Parse YAML content from code block
     */
    static parseYaml(content: string): IGalleryConfig {
        if (!content || content.trim() === '') {
            throw this.createConfigError('content', 'Gallery configuration cannot be empty', 
                'Provide at least a path parameter');
        }

        let parsedData: any;
        
        try {
            // Try parsing as YAML
            parsedData = yaml.load(content.trim());
        } catch (yamlError) {
            // If YAML parsing fails, try simple key-value parsing
            try {
                parsedData = this.parseSimpleFormat(content);
            } catch (simpleError) {
                throw this.createConfigError(
                    'yaml-syntax',
                    `Invalid YAML syntax: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
                    'Check your YAML formatting'
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
        this.validateKeys(parsedData);

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
    private static parseSimpleFormat(content: string): any {
        const result: any = {};
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
    private static parseValue(value: string): any {
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
    private static validateKeys(config: any): void {
        const providedKeys = Object.keys(config);
        const invalidKeys = providedKeys.filter(key => !this.ALLOWED_KEYS.includes(key));
        
        if (invalidKeys.length > 0) {
            throw this.createConfigError('unknown_key', 
                `Unknown configuration keys: ${invalidKeys.join(', ')}`,
                `Valid keys are: ${this.ALLOWED_KEYS.join(', ')}`);
        }

        // Validate required keys
        if (!config.path) {
            throw this.createConfigError('missing_path', 
                'Path parameter is required',
                'Add "path: your/folder/path" to the configuration');
        }

        // Validate view type if provided
        if (config.view && !this.VIEW_TYPES.includes(config.view)) {
            throw this.createConfigError('invalid_view',
                `Invalid view type: ${config.view}`,
                `Valid view types are: ${this.VIEW_TYPES.join(', ')}`);
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
    private static createConfigError(field: string, message: string, suggestion?: string): IConfigError {
        return {
            type: 'config',
            field,
            message,
            suggestion
        };
    }

    /**
     * Validate configuration completeness
     */
    static validateConfig(config: IGalleryConfig): IConfigError[] {
        const errors: IConfigError[] = [];

        // Path validation
        if (!config.path || config.path.trim() === '') {
            errors.push(this.createConfigError('path', 'Path cannot be empty'));
        } else if (config.path.includes('..')) {
            errors.push(this.createConfigError('path', 
                'Path cannot contain directory traversal (..)'));
        }

        // View validation
        if (config.view && !this.VIEW_TYPES.includes(config.view)) {
            errors.push(this.createConfigError('view', 
                `Invalid view type: ${config.view}`,
                `Valid types: ${this.VIEW_TYPES.join(', ')}`));
        }

        // Recursive validation
        if (config.recursive !== undefined && typeof config.recursive !== 'boolean') {
            errors.push(this.createConfigError('recursive', 
                'Recursive must be a boolean value'));
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
        return yaml.dump({
            path: config.path,
            view: config.view,
            recursive: config.recursive
        }, {
            indent: 2,
            lineWidth: 80,
            noRefs: true
        });
    }
}