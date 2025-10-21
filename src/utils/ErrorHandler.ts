import { IConfigError, ILoadError, IImageSource } from '../models/interfaces';

/**
 * Centralized error handling for the gallery plugin
 * Provides consistent error management and user feedback
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorCallbacks: Map<string, (error: any) => void> = new Map();

    private constructor() {}

    /**
     * Get singleton instance
     */
    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle configuration errors
     */
    static handleConfigError(error: IConfigError, container: HTMLElement): void {
        console.error('Gallery Config Error:', error);
        
        const errorEl = container.createEl('div', { cls: 'gallery-error gallery-config-error' });
        
        // Error title
        errorEl.createEl('div', { 
            cls: 'gallery-error-title',
            text: `Configuration Error: ${error.field}`
        });
        
        // Error message
        errorEl.createEl('div', { 
            cls: 'gallery-error-message',
            text: error.message
        });
        
        // Suggestion if available
        if (error.suggestion) {
            errorEl.createEl('div', { 
                cls: 'gallery-error-suggestion',
                text: `💡 ${error.suggestion}`
            });
        }
        
        // Add documentation link
        const helpEl = errorEl.createEl('div', { cls: 'gallery-error-help' });
        helpEl.createEl('span', { text: 'Need help? Check the ' });
        helpEl.createEl('a', { 
            text: 'documentation',
            href: '#gallery-plugin-docs',
            cls: 'gallery-help-link'
        });
    }

    /**
     * Handle loading errors
     */
    static handleLoadError(error: ILoadError, container: HTMLElement): HTMLElement {
        console.error('Gallery Load Error:', error);
        
        const errorEl = container.createEl('div', { 
            cls: 'gallery-error gallery-load-error',
            attr: { 'data-error-type': error.reason }
        });
        
        // Error icon
        const iconEl = errorEl.createEl('div', { cls: 'gallery-error-icon' });
        iconEl.textContent = this.getErrorIcon(error.reason);
        
        // Error content
        const contentEl = errorEl.createEl('div', { cls: 'gallery-error-content' });
        
        // Image info
        contentEl.createEl('div', { 
            cls: 'gallery-error-image-path',
            text: this.truncatePath(error.source.path)
        });
        
        // Error message
        contentEl.createEl('div', { 
            cls: 'gallery-error-message',
            text: error.message
        });
        
        // Retry button if error is retryable
        if (error.retryable) {
            const retryBtn = contentEl.createEl('button', {
                cls: 'gallery-retry-button',
                text: 'Retry'
            });
            
            retryBtn.addEventListener('click', () => {
                this.retryImageLoad(error.source, errorEl);
            });
        }
        
        return errorEl;
    }

    /**
     * Handle general plugin errors
     */
    static handlePluginError(error: Error, context: string, container?: HTMLElement): void {
        console.error(`Gallery Plugin Error (${context}):`, error);
        
        if (container) {
            const errorEl = container.createEl('div', { cls: 'gallery-error gallery-plugin-error' });
            
            errorEl.createEl('div', { 
                cls: 'gallery-error-title',
                text: 'Gallery Plugin Error'
            });
            
            errorEl.createEl('div', { 
                cls: 'gallery-error-message',
                text: error.message
            });
            
            errorEl.createEl('div', { 
                cls: 'gallery-error-context',
                text: `Context: ${context}`
            });
            
            // Debug info in development
            if (process.env.NODE_ENV === 'development') {
                const debugEl = errorEl.createEl('details', { cls: 'gallery-error-debug' });
                debugEl.createEl('summary', { text: 'Debug Information' });
                debugEl.createEl('pre', { 
                    text: error.stack || error.toString(),
                    cls: 'gallery-error-stack'
                });
            }
        }
    }

    /**
     * Handle network errors
     */
    static handleNetworkError(url: string, error: Error, container: HTMLElement): HTMLElement {
        const loadError: ILoadError = {
            type: 'load',
            source: { path: url, type: 'external' } as IImageSource,
            reason: 'network_error',
            message: `Failed to load external image: ${error instanceof Error ? error.message : String(error)}`,
            retryable: true
        };
        
        return this.handleLoadError(loadError, container);
    }

    /**
     * Handle timeout errors
     */
    static handleTimeoutError(source: IImageSource, container: HTMLElement): HTMLElement {
        const loadError: ILoadError = {
            type: 'load',
            source,
            reason: 'timeout',
            message: 'Image loading timed out (10 second limit)',
            retryable: true
        };
        
        return this.handleLoadError(loadError, container);
    }

    /**
     * Handle file not found errors
     */
    static handleNotFoundError(source: IImageSource, container: HTMLElement): HTMLElement {
        const loadError: ILoadError = {
            type: 'load',
            source,
            reason: 'not_found',
            message: source.type === 'local' 
                ? 'File not found in vault'
                : 'External URL not found (404)',
            retryable: source.type === 'external'
        };
        
        return this.handleLoadError(loadError, container);
    }

    /**
     * Get error icon for error type
     */
    private static getErrorIcon(reason: string): string {
        switch (reason) {
            case 'timeout': return '⏱️';
            case 'not_found': return '❓';
            case 'invalid_format': return '🖼️';
            case 'network_error': return '🌐';
            case 'too_large': return '📏';
            default: return '⚠️';
        }
    }

    /**
     * Truncate long paths for display
     */
    private static truncatePath(path: string, maxLength: number = 50): string {
        if (path.length <= maxLength) return path;
        
        const start = path.substring(0, maxLength / 2 - 2);
        const end = path.substring(path.length - maxLength / 2 + 2);
        return `${start}...${end}`;
    }

    /**
     * Retry image loading
     */
    private static retryImageLoad(source: IImageSource, errorElement: HTMLElement): void {
        // Reset image state
        source.reset();
        
        // Replace error element with loading state
        const loadingEl = errorElement.parentElement?.createEl('div', { 
            cls: 'gallery-loading-retry'
        });
        
        if (loadingEl) {
            loadingEl.textContent = 'Retrying...';
            errorElement.remove();
            
            // Trigger reload after short delay
            setTimeout(() => {
                const event = new CustomEvent('gallery:retry-image', {
                    detail: { source, element: loadingEl }
                });
                document.dispatchEvent(event);
            }, 500);
        }
    }

    /**
     * Create error recovery suggestions
     */
    static getRecoverySuggestions(error: ILoadError): string[] {
        const suggestions: string[] = [];
        
        switch (error.reason) {
            case 'timeout':
                suggestions.push('Check your internet connection');
                suggestions.push('Try loading the image later');
                suggestions.push('Use a local copy if available');
                break;
                
            case 'not_found':
                if (error.source.type === 'local') {
                    suggestions.push('Check if the file exists in your vault');
                    suggestions.push('Verify the file path is correct');
                } else {
                    suggestions.push('Check if the URL is correct');
                    suggestions.push('Verify the image is publicly accessible');
                }
                break;
                
            case 'invalid_format':
                suggestions.push('Use a supported format (JPG, PNG, GIF, WebP)');
                suggestions.push('Convert the image to a compatible format');
                break;
                
            case 'network_error':
                suggestions.push('Check your internet connection');
                suggestions.push('Try again later');
                suggestions.push('Verify the URL is accessible');
                break;
                
            case 'too_large':
                suggestions.push('Resize the image to under 50MB');
                suggestions.push('Use a compressed version');
                suggestions.push('Consider using a thumbnail');
                break;
        }
        
        return suggestions;
    }

    /**
     * Register error callback
     */
    registerErrorCallback(type: string, callback: (error: any) => void): void {
        this.errorCallbacks.set(type, callback);
    }

    /**
     * Trigger error callback
     */
    triggerErrorCallback(type: string, error: any): void {
        const callback = this.errorCallbacks.get(type);
        if (callback) {
            try {
                callback(error);
            } catch (callbackError) {
                console.error('Error in error callback:', callbackError);
            }
        }
    }

    /**
     * Clear all error callbacks
     */
    clearErrorCallbacks(): void {
        this.errorCallbacks.clear();
    }
}