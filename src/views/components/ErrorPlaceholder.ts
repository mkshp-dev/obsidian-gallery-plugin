/**
 * ErrorPlaceholder component for handling various error states in the gallery
 * Provides user-friendly error messages and recovery options
 */

export interface IErrorPlaceholderOptions {
  type?: 'image-load' | 'validation' | 'network' | 'permission' | 'general';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  showRetry?: boolean;
  showDetails?: boolean;
  customMessage?: string;
  retryAction?: () => void;
}

export interface IErrorInfo {
  message: string;
  details?: string;
  code?: string;
  timestamp?: Date;
  canRetry?: boolean;
}

export class ErrorPlaceholder {
  private container: HTMLElement;
  private options: Required<Omit<IErrorPlaceholderOptions, 'customMessage' | 'retryAction'>> & 
                   Pick<IErrorPlaceholderOptions, 'customMessage' | 'retryAction'>;
  private errorInfo: IErrorInfo;
  private placeholderElement: HTMLElement | null = null;

  private static readonly DEFAULT_OPTIONS = {
    type: 'general' as const,
    size: 'medium' as const,
    showIcon: true,
    showRetry: true,
    showDetails: false,
    customMessage: undefined,
    retryAction: undefined
  };

  // Error type configurations
  private static readonly ERROR_CONFIGS = {
    'image-load': {
      icon: '🖼️',
      title: 'Image Load Failed',
      defaultMessage: 'Unable to load this image',
      color: '#ff6b6b'
    },
    'validation': {
      icon: '⚠️',
      title: 'Validation Error',
      defaultMessage: 'Image failed validation checks',
      color: '#ffa726'
    },
    'network': {
      icon: '🌐',
      title: 'Network Error',
      defaultMessage: 'Unable to connect to image source',
      color: '#42a5f5'
    },
    'permission': {
      icon: '🔒',
      title: 'Permission Denied',
      defaultMessage: 'Access to this image is restricted',
      color: '#ab47bc'
    },
    'general': {
      icon: '❌',
      title: 'Error',
      defaultMessage: 'Something went wrong',
      color: '#ef5350'
    }
  };

  constructor(container: HTMLElement, errorInfo: IErrorInfo, options: IErrorPlaceholderOptions = {}) {
    this.container = container;
    this.errorInfo = errorInfo;
    this.options = { ...ErrorPlaceholder.DEFAULT_OPTIONS, ...options };
    this.render();
  }

  /**
   * Render the error placeholder
   */
  private render(): void {
    // Clear existing content
    if (this.placeholderElement) {
      this.placeholderElement.remove();
    }

    const config = ErrorPlaceholder.ERROR_CONFIGS[this.options.type];

    // Create main error container
    this.placeholderElement = this.container.createDiv({
      cls: [
        'gallery-error-placeholder',
        `gallery-error-${this.options.type}`,
        `gallery-error-${this.options.size}`
      ].join(' ')
    });

    // Set error color
    this.placeholderElement.style.setProperty('--error-color', config.color);

    // Add icon if enabled
    if (this.options.showIcon) {
      const iconElement = this.placeholderElement.createDiv('gallery-error-icon');
      iconElement.textContent = config.icon;
    }

    // Add main error message
    const messageElement = this.placeholderElement.createDiv('gallery-error-message');
    messageElement.textContent = this.options.customMessage || this.errorInfo.message || config.defaultMessage;

    // Add title/type information
    const titleElement = this.placeholderElement.createDiv('gallery-error-title');
    titleElement.textContent = config.title;

    // Add details if enabled and available
    if (this.options.showDetails && this.errorInfo.details) {
      const detailsElement = this.placeholderElement.createDiv('gallery-error-details');
      detailsElement.textContent = this.errorInfo.details;
      
      // Make details collapsible for longer error messages
      if (this.errorInfo.details.length > 100) {
        detailsElement.addClass('gallery-error-details-collapsible');
        detailsElement.addEventListener('click', () => {
          if (detailsElement.hasClass('gallery-error-details-expanded')) {
            detailsElement.removeClass('gallery-error-details-expanded');
          } else {
            detailsElement.addClass('gallery-error-details-expanded');
          }
        });
      }
    }

    // Add retry button if enabled and action is provided
    if (this.options.showRetry && (this.options.retryAction || this.errorInfo.canRetry)) {
      this.renderRetryButton();
    }

    // Add timestamp for debugging
    if (this.options.showDetails && this.errorInfo.timestamp) {
      const timestampElement = this.placeholderElement.createDiv('gallery-error-timestamp');
      timestampElement.textContent = `Error occurred at: ${this.errorInfo.timestamp.toLocaleString()}`;
    }

    // Add error code if available
    if (this.options.showDetails && this.errorInfo.code) {
      const codeElement = this.placeholderElement.createDiv('gallery-error-code');
      codeElement.textContent = `Error code: ${this.errorInfo.code}`;
    }
  }

  /**
   * Render retry button
   */
  private renderRetryButton(): void {
    const retryContainer = this.placeholderElement!.createDiv('gallery-error-retry');
    
    const retryButton = retryContainer.createEl('button', {
      cls: 'gallery-retry-button',
      text: 'Try Again'
    });
        // Accessibility: label and role
        retryButton.setAttribute('aria-label', 'Retry action');
        retryButton.setAttribute('role', 'button');

        retryButton.addEventListener('click', () => {
          if (this.options.retryAction) {
            // Show loading state
            retryButton.textContent = 'Retrying...';
            retryButton.disabled = true;
            
            try {
              this.options.retryAction();
            } catch (error) {
              // Reset button state if retry fails immediately
              setTimeout(() => {
                retryButton.textContent = 'Try Again';
                retryButton.disabled = false;
              }, 1000);
            }
          }
        });
  }

  /**
   * Update error information
   */
  updateError(errorInfo: Partial<IErrorInfo>): void {
    this.errorInfo = { ...this.errorInfo, ...errorInfo };
    this.render();
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<IErrorPlaceholderOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * Show the error placeholder
   */
  show(): void {
    if (this.placeholderElement) {
      this.placeholderElement.style.display = '';
      this.placeholderElement.addClass('gallery-error-visible');
    }
  }

  /**
   * Hide the error placeholder
   */
  hide(): void {
    if (this.placeholderElement) {
      this.placeholderElement.removeClass('gallery-error-visible');
      this.placeholderElement.addClass('gallery-error-hidden');
    }
  }

  /**
   * Remove the error placeholder
   */
  destroy(): void {
    if (this.placeholderElement) {
      this.placeholderElement.remove();
      this.placeholderElement = null;
    }
  }

  /**
   * Create an image load error placeholder
   */
  static createImageLoadError(
    container: HTMLElement, 
    imagePath: string, 
    retryAction?: () => void
  ): ErrorPlaceholder {
    return new ErrorPlaceholder(container, {
      message: 'Failed to load image',
      details: `Image path: ${imagePath}`,
      canRetry: true,
      timestamp: new Date()
    }, {
      type: 'image-load',
      size: 'small',
      showRetry: true,
      retryAction
    });
  }

  /**
   * Create a validation error placeholder
   */
  static createValidationError(
    container: HTMLElement, 
    validationErrors: string[], 
    imagePath?: string
  ): ErrorPlaceholder {
    return new ErrorPlaceholder(container, {
      message: 'Image validation failed',
      details: validationErrors.join('; ') + (imagePath ? ` (${imagePath})` : ''),
      canRetry: false,
      timestamp: new Date()
    }, {
      type: 'validation',
      size: 'medium',
      showRetry: false,
      showDetails: true
    });
  }

  /**
   * Create a network error placeholder
   */
  static createNetworkError(
    container: HTMLElement, 
    url: string, 
    retryAction?: () => void
  ): ErrorPlaceholder {
    return new ErrorPlaceholder(container, {
      message: 'Network connection failed',
      details: `Unable to reach: ${url}`,
      canRetry: true,
      timestamp: new Date()
    }, {
      type: 'network',
      size: 'medium',
      showRetry: true,
      retryAction
    });
  }

  /**
   * Create a permission error placeholder
   */
  static createPermissionError(
    container: HTMLElement, 
    resource: string
  ): ErrorPlaceholder {
    return new ErrorPlaceholder(container, {
      message: 'Access denied',
      details: `Permission denied for: ${resource}`,
      canRetry: false,
      timestamp: new Date()
    }, {
      type: 'permission',
      size: 'medium',
      showRetry: false,
      showDetails: true
    });
  }

  /**
   * Create a general error placeholder
   */
  static createGeneralError(
    container: HTMLElement, 
    message: string, 
    details?: string,
    retryAction?: () => void
  ): ErrorPlaceholder {
    return new ErrorPlaceholder(container, {
      message,
      details,
      canRetry: !!retryAction,
      timestamp: new Date()
    }, {
      type: 'general',
      size: 'medium',
      showRetry: !!retryAction,
      showDetails: !!details,
      retryAction
    });
  }
}

/**
 * ErrorManager for coordinating multiple error states
 */
export class ErrorManager {
  private activeErrors: Map<string, ErrorPlaceholder> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Show error with a unique key
   */
  showError(key: string, errorInfo: IErrorInfo, options: IErrorPlaceholderOptions = {}): ErrorPlaceholder {
    // Remove existing error with same key
    this.hideError(key);

    // Create new error placeholder
    const errorPlaceholder = new ErrorPlaceholder(this.container, errorInfo, options);
    this.activeErrors.set(key, errorPlaceholder);
    
    return errorPlaceholder;
  }

  /**
   * Hide error for a specific key
   */
  hideError(key: string): void {
    const errorPlaceholder = this.activeErrors.get(key);
    if (errorPlaceholder) {
      errorPlaceholder.destroy();
      this.activeErrors.delete(key);
    }
  }

  /**
   * Hide all errors
   */
  hideAllErrors(): void {
    this.activeErrors.forEach(errorPlaceholder => errorPlaceholder.destroy());
    this.activeErrors.clear();
  }

  /**
   * Update error information for a specific key
   */
  updateError(key: string, errorInfo: Partial<IErrorInfo>): void {
    const errorPlaceholder = this.activeErrors.get(key);
    if (errorPlaceholder) {
      errorPlaceholder.updateError(errorInfo);
    }
  }

  /**
   * Check if a specific error is active
   */
  hasError(key: string): boolean {
    return this.activeErrors.has(key);
  }

  /**
   * Check if any errors are active
   */
  hasActiveErrors(): boolean {
    return this.activeErrors.size > 0;
  }

  /**
   * Get all active error keys
   */
  getActiveErrorKeys(): string[] {
    return Array.from(this.activeErrors.keys());
  }

  /**
   * Get error count by type
   */
  getErrorCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    this.activeErrors.forEach(errorPlaceholder => {
      const type = errorPlaceholder['options'].type;
      counts[type] = (counts[type] || 0) + 1;
    });
    
    return counts;
  }
}