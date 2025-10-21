/**
 * Image file validator for supported formats and properties
 * Ensures only valid image files are processed in galleries
 */
export class ImageValidator {
    private static readonly SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    private static readonly SUPPORTED_MIME_TYPES = [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp'
    ];
    
    // Maximum dimensions to prevent memory issues
    private static readonly MAX_WIDTH = 8000;
    private static readonly MAX_HEIGHT = 8000;
    
    // File size limits
    private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    private static readonly WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB warning threshold

    /**
     * Validate image file extension
     */
    static isValidExtension(filePath: string): boolean {
        const extension = this.getFileExtension(filePath).toLowerCase();
        return this.SUPPORTED_EXTENSIONS.includes(extension);
    }

    /**
     * Validate image MIME type
     */
    static isValidMimeType(mimeType: string): boolean {
        return this.SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
    }

    /**
     * Get file extension from path
     */
    private static getFileExtension(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot === -1 ? '' : filePath.substring(lastDot);
    }

    /**
     * Validate file size
     */
    static validateFileSize(sizeBytes: number): {
        isValid: boolean;
        isLarge: boolean;
        message?: string;
    } {
        if (sizeBytes > this.MAX_FILE_SIZE) {
            return {
                isValid: false,
                isLarge: true,
                message: `File too large (${this.formatFileSize(sizeBytes)} > ${this.formatFileSize(this.MAX_FILE_SIZE)})`
            };
        }
        
        if (sizeBytes > this.WARN_FILE_SIZE) {
            return {
                isValid: true,
                isLarge: true,
                message: `Large file (${this.formatFileSize(sizeBytes)}) may affect performance`
            };
        }
        
        return {
            isValid: true,
            isLarge: false
        };
    }

    /**
     * Format file size for human reading
     */
    private static formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Validate image dimensions
     */
    static validateDimensions(width: number, height: number): {
        isValid: boolean;
        message?: string;
    } {
        if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
            return {
                isValid: false,
                message: `Image dimensions too large (${width}x${height} > ${this.MAX_WIDTH}x${this.MAX_HEIGHT})`
            };
        }
        
        if (width <= 0 || height <= 0) {
            return {
                isValid: false,
                message: `Invalid image dimensions (${width}x${height})`
            };
        }
        
        return { isValid: true };
    }

    /**
     * Comprehensive image validation
     */
    static async validateImage(
        filePath: string, 
        fileSize?: number,
        mimeType?: string
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        metadata?: {
            extension: string;
            estimatedFormat: string;
            sizeValidation: any;
        };
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate extension
        if (!this.isValidExtension(filePath)) {
            const extension = this.getFileExtension(filePath);
            errors.push(`Unsupported file format: ${extension || 'no extension'}`);
        }
        
        // Validate MIME type if provided
        if (mimeType && !this.isValidMimeType(mimeType)) {
            errors.push(`Unsupported MIME type: ${mimeType}`);
        }
        
        // Validate file size if provided
        let sizeValidation = null;
        if (fileSize !== undefined) {
            sizeValidation = this.validateFileSize(fileSize);
            if (!sizeValidation.isValid) {
                errors.push(sizeValidation.message!);
            } else if (sizeValidation.isLarge && sizeValidation.message) {
                warnings.push(sizeValidation.message);
            }
        }
        
        // Determine estimated format
        const extension = this.getFileExtension(filePath).toLowerCase();
        const estimatedFormat = this.getFormatFromExtension(extension);
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                extension,
                estimatedFormat,
                sizeValidation
            }
        };
    }

    /**
     * Get image format from extension
     */
    private static getFormatFromExtension(extension: string): string {
        const formatMap: Record<string, string> = {
            '.jpg': 'JPEG',
            '.jpeg': 'JPEG',
            '.png': 'PNG', 
            '.gif': 'GIF',
            '.webp': 'WebP'
        };
        
        return formatMap[extension.toLowerCase()] || 'Unknown';
    }

    /**
     * Validate image URL
     */
    static validateImageUrl(url: string): {
        isValid: boolean;
        isExternal: boolean;
        message?: string;
    } {
        try {
            const urlObj = new URL(url);
            
            // Check protocol
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return {
                    isValid: false,
                    isExternal: false,
                    message: 'Only HTTP and HTTPS URLs are supported'
                };
            }
            
            // Check if it looks like an image URL
            const pathname = urlObj.pathname.toLowerCase();
            const hasImageExtension = this.SUPPORTED_EXTENSIONS.some(ext => 
                pathname.endsWith(ext)
            );
            
            return {
                isValid: true,
                isExternal: true,
                message: hasImageExtension ? undefined : 'URL does not appear to be an image file'
            };
            
        } catch (error) {
            return {
                isValid: false,
                isExternal: false,
                message: 'Invalid URL format'
            };
        }
    }

    /**
     * Get validation rules for display
     */
    static getValidationRules(): {
        supportedFormats: string[];
        maxFileSize: string;
        maxDimensions: string;
        supportedProtocols: string[];
    } {
        return {
            supportedFormats: [...this.SUPPORTED_EXTENSIONS],
            maxFileSize: this.formatFileSize(this.MAX_FILE_SIZE),
            maxDimensions: `${this.MAX_WIDTH}x${this.MAX_HEIGHT}`,
            supportedProtocols: ['http:', 'https:']
        };
    }

    /**
     * Check if file path looks like an image
     */
    static looksLikeImage(path: string): boolean {
        // Check extension first
        if (this.isValidExtension(path)) {
            return true;
        }
        
        // Check for common image indicators in filename
        const lowercasePath = path.toLowerCase();
        const imageKeywords = ['image', 'img', 'photo', 'picture', 'pic'];
        
        return imageKeywords.some(keyword => lowercasePath.includes(keyword));
    }

    /**
     * Suggest fixes for validation errors
     */
    static suggestFixes(errors: string[]): string[] {
        const suggestions: string[] = [];
        
        for (const error of errors) {
            if (error.includes('Unsupported file format')) {
                suggestions.push('Convert to JPG, PNG, GIF, or WebP format');
            }
            
            if (error.includes('File too large')) {
                suggestions.push('Reduce file size by compressing or resizing the image');
            }
            
            if (error.includes('dimensions too large')) {
                suggestions.push('Resize image to smaller dimensions');
            }
            
            if (error.includes('Invalid URL')) {
                suggestions.push('Use a valid HTTP or HTTPS URL');
            }
        }
        
        return suggestions;
    }

    /**
     * Batch validate multiple image paths
     */
    static async validateMultiple(
        imagePaths: string[]
    ): Promise<{
        valid: string[];
        invalid: Array<{ path: string; errors: string[] }>;
        warnings: Array<{ path: string; warnings: string[] }>;
    }> {
        const valid: string[] = [];
        const invalid: Array<{ path: string; errors: string[] }> = [];
        const warnings: Array<{ path: string; warnings: string[] }> = [];
        
        for (const path of imagePaths) {
            const validation = await this.validateImage(path);
            
            if (validation.isValid) {
                valid.push(path);
                
                if (validation.warnings.length > 0) {
                    warnings.push({ path, warnings: validation.warnings });
                }
            } else {
                invalid.push({ path, errors: validation.errors });
            }
        }
        
        return { valid, invalid, warnings };
    }

    /**
     * Get supported MIME types
     */
    static getSupportedMimeTypes(): string[] {
        return [...this.SUPPORTED_MIME_TYPES];
    }

    /**
     * Get maximum allowed file size
     */
    static getMaxFileSize(): number {
        return this.MAX_FILE_SIZE;
    }

    /**
     * Get maximum allowed dimensions
     */
    static getMaxDimensions(): { width: number; height: number } {
        return {
            width: this.MAX_WIDTH,
            height: this.MAX_HEIGHT
        };
    }
}