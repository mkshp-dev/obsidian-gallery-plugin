import { IGalleryConfig, IConfigError } from '../models/interfaces';

/**
 * Configuration validator with path sanitization
 * Ensures gallery configurations are safe and valid
 */
export class ConfigValidator {
    private static readonly MAX_PATH_LENGTH = 260; // Windows path limit
    private static readonly FORBIDDEN_CHARS = ['<', '>', ':', '"', '|', '?', '*'];
    private static readonly RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    /**
     * Validate and sanitize gallery configuration
     */
    static validate(config: IGalleryConfig): IConfigError[] {
        const errors: IConfigError[] = [];
        
        // Validate path only if no external urls provided
        if (!Array.isArray((config as any).urls) || (config as any).urls.length === 0) {
            errors.push(...this.validatePath(config.path));
        }
        
        // Validate view type
        errors.push(...this.validateView(config.view));
        
        // Validate recursive setting
        errors.push(...this.validateRecursive(config.recursive));
        
        return errors;
    }

    /**
     * Validate and sanitize path parameter
     */
    private static validatePath(path?: string): IConfigError[] {
        const errors: IConfigError[] = [];
        
        // Path is required unless external URLs are provided; callers must
        // decide whether to call this method. Here, treat undefined/null/empty
        // specially and report the appropriate message.
        if (!path || typeof path !== 'string') {
            errors.push({
                type: 'config',
                field: 'path',
                message: 'Path is required and must be a string',
                suggestion: 'Provide a valid file or folder path'
            });
            return errors;
        }
        
        const trimmedPath = path.trim();
        
        // Check if empty
        if (trimmedPath.length === 0) {
            errors.push({
                type: 'config',
                field: 'path',
                message: 'Path cannot be empty',
                suggestion: 'Provide a valid file or folder path'
            });
            return errors;
        }
        
        // Check path length
        if (trimmedPath.length > this.MAX_PATH_LENGTH) {
            errors.push({
                type: 'config',
                field: 'path',
                message: `Path too long (${trimmedPath.length} > ${this.MAX_PATH_LENGTH} characters)`,
                suggestion: 'Use a shorter path'
            });
        }
        
        // Check for directory traversal
        if (trimmedPath.includes('..')) {
            errors.push({
                type: 'config',
                field: 'path',
                message: 'Path cannot contain directory traversal patterns (..)',
                suggestion: 'Use relative paths within the vault only'
            });
        }
        
        // Check for forbidden characters
        const foundForbidden = this.FORBIDDEN_CHARS.filter(char => trimmedPath.includes(char));
        if (foundForbidden.length > 0) {
            errors.push({
                type: 'config',
                field: 'path',
                message: `Path contains forbidden characters: ${foundForbidden.join(', ')}`,
                suggestion: 'Remove forbidden characters from the path'
            });
        }
        
        // Check for reserved names
        const pathParts = trimmedPath.split('/').filter(part => part.length > 0);
        const reservedParts = pathParts.filter(part => 
            this.RESERVED_NAMES.includes(part.toUpperCase())
        );
        if (reservedParts.length > 0) {
            errors.push({
                type: 'config',
                field: 'path',
                message: `Path contains reserved names: ${reservedParts.join(', ')}`,
                suggestion: 'Use different folder or file names'
            });
        }
        
        // Check for absolute paths
        if (trimmedPath.startsWith('/') || /^[a-zA-Z]:/.test(trimmedPath)) {
            errors.push({
                type: 'config',
                field: 'path',
                message: 'Absolute paths are not allowed',
                suggestion: 'Use relative paths within the vault'
            });
        }
        
        return errors;
    }

    /**
     * Validate view type parameter
     */
    private static validateView(view?: string): IConfigError[] {
        const errors: IConfigError[] = [];
        const validViews = ['thumbnail', 'carousel', 'grid'];
        
        if (view !== undefined) {
            if (typeof view !== 'string') {
                errors.push({
                    type: 'config',
                    field: 'view',
                    message: 'View type must be a string',
                    suggestion: `Use one of: ${validViews.join(', ')}`
                });
            } else if (!validViews.includes(view)) {
                errors.push({
                    type: 'config',
                    field: 'view',
                    message: `Invalid view type: ${view}`,
                    suggestion: `Valid types are: ${validViews.join(', ')}`
                });
            }
        }
        
        return errors;
    }

    /**
     * Validate recursive parameter
     */
    private static validateRecursive(recursive?: boolean): IConfigError[] {
        const errors: IConfigError[] = [];
        
        if (recursive !== undefined && typeof recursive !== 'boolean') {
            errors.push({
                type: 'config',
                field: 'recursive',
                message: 'Recursive parameter must be a boolean (true/false)',
                suggestion: 'Use "recursive: true" or "recursive: false"'
            });
        }
        
        return errors;
    }

    /**
     * Sanitize path for safe usage
     */
    static sanitizePath(path: string): string {
        if (!path || typeof path !== 'string') {
            return '';
        }
        
        let sanitized = path.trim();
        
        // Remove directory traversal patterns
        sanitized = sanitized.replace(/\.\./g, '');
        
        // Normalize path separators
        sanitized = sanitized.replace(/\\/g, '/');
        
        // Remove forbidden characters
        this.FORBIDDEN_CHARS.forEach(char => {
            sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '');
        });
        
        // Remove leading slash
        sanitized = sanitized.replace(/^\/+/, '');
        
        // Collapse multiple slashes
        sanitized = sanitized.replace(/\/+/g, '/');
        
        // Remove trailing slash
        sanitized = sanitized.replace(/\/+$/, '');
        
        return sanitized;
    }

    /**
     * Check if path is safe to use
     */
    static isPathSafe(path: string): boolean {
        const errors = this.validatePath(path);
        return errors.length === 0;
    }

    /**
     * Validate configuration and throw on error
     */
    static validateOrThrow(config: IGalleryConfig): void {
        const errors = this.validate(config);
        
        if (errors.length > 0) {
            const errorMessages = errors.map(err => 
                err.suggestion ? `${err.message} (${err.suggestion})` : err.message
            ).join('; ');
            
            throw new Error(`Configuration validation failed: ${errorMessages}`);
        }
    }

    /**
     * Check if configuration is valid
     */
    static isValid(config: IGalleryConfig): boolean {
        const errors = this.validate(config);
        return errors.length === 0;
    }

    /**
     * Get validation summary
     */
    static getValidationSummary(config: IGalleryConfig): {
        isValid: boolean;
        errors: IConfigError[];
        warnings: string[];
    } {
        const errors = this.validate(config);
        const warnings: string[] = [];
        
        // Add warnings for potential issues
        if (config.path && config.path.length > 100) {
            warnings.push('Path is quite long, consider using shorter folder names');
        }
        
        if (config.path && config.path.split('/').length > 5) {
            warnings.push('Path has many nested folders, this might affect performance');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Suggest corrections for invalid configuration
     */
    static suggestCorrections(config: IGalleryConfig): IGalleryConfig {
        return {
            path: this.sanitizePath(config.path),
            view: config.view && ['thumbnail', 'carousel', 'grid'].includes(config.view) 
                ? config.view 
                : 'thumbnail',
            recursive: typeof config.recursive === 'boolean' 
                ? config.recursive 
                : true
        };
    }
}