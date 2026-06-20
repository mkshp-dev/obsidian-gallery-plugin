/**
 * File size validation utility for gallery images
 * Prevents loading of files that exceed size limits
 */

export interface IFileSizeValidationResult {
  isValid: boolean;
  size?: number;
  error?: string;
  maxSize: number;
}

export class FileSizeValidator {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

  /**
   * Validate file size for local files
   */
  static async validateLocalFile(filePath: string, vault: any): Promise<IFileSizeValidationResult> {
    try {
      const file = vault.getAbstractFileByPath(filePath);
      
      if (!file) {
        return {
          isValid: false,
          error: 'File not found',
          maxSize: this.MAX_FILE_SIZE
        };
      }

      // Get file stats if available
      const stat = await vault.adapter.stat(filePath);
      const fileSize = stat?.size || 0;

      if (fileSize > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          size: fileSize,
          error: `File size (${this.formatFileSize(fileSize)}) exceeds maximum allowed size (${this.formatFileSize(this.MAX_FILE_SIZE)})`,
          maxSize: this.MAX_FILE_SIZE
        };
      }

      return {
        isValid: true,
        size: fileSize,
        maxSize: this.MAX_FILE_SIZE
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Failed to check file size: ${error instanceof Error ? error.message : String(error)}`,
        maxSize: this.MAX_FILE_SIZE
      };
    }
  }

  /**
   * Validate file size for external URLs
   * Uses HEAD request to check Content-Length header
   */
  static async validateExternalUrl(url: string, timeoutMs: number = 5000): Promise<IFileSizeValidationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isValid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          maxSize: this.MAX_FILE_SIZE
        };
      }

      const contentLength = response.headers.get('Content-Length');
      
      if (!contentLength) {
        // If no Content-Length header, we can't validate size
        // Allow the download but warn user
        console.warn(`No Content-Length header for URL: ${url}`);
        return {
          isValid: true,
          error: 'Size unknown - no Content-Length header',
          maxSize: this.MAX_FILE_SIZE
        };
      }

      const fileSize = parseInt(contentLength, 10);

      if (isNaN(fileSize)) {
        return {
          isValid: false,
          error: 'Invalid Content-Length header',
          maxSize: this.MAX_FILE_SIZE
        };
      }

      if (fileSize > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          size: fileSize,
          error: `File size (${this.formatFileSize(fileSize)}) exceeds maximum allowed size (${this.formatFileSize(this.MAX_FILE_SIZE)})`,
          maxSize: this.MAX_FILE_SIZE
        };
      }

      return {
        isValid: true,
        size: fileSize,
        maxSize: this.MAX_FILE_SIZE
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          isValid: false,
          error: `Request timeout after ${timeoutMs}ms`,
          maxSize: this.MAX_FILE_SIZE
        };
      }

      return {
        isValid: false,
        error: `Failed to validate URL: ${error instanceof Error ? error.message : String(error)}`,
        maxSize: this.MAX_FILE_SIZE
      };
    }
  }

  /**
   * Format file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get maximum allowed file size
   */
  static getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Check if file size is within limits (quick check)
   */
  static isFileSizeValid(bytes: number): boolean {
    return bytes <= this.MAX_FILE_SIZE;
  }
}