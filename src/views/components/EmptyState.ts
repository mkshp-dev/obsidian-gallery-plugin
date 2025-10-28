/**
 * EmptyState component for displaying empty gallery states
 * Provides user-friendly messages when no images are found
 */

export interface IEmptyStateOptions {
  type?: 'no-images' | 'no-path' | 'validation-failed' | 'permission-denied' | 'custom';
  title?: string;
  message?: string;
  suggestion?: string;
  showIcon?: boolean;
  showActions?: boolean;
  size?: 'small' | 'medium' | 'large';
  actions?: IEmptyStateAction[];
}

export interface IEmptyStateAction {
  label: string;
  action: () => void;
  type?: 'primary' | 'secondary';
  icon?: string;
}

export interface IEmptyStateInfo {
  path?: string;
  searchCriteria?: string;
  expectedFormats?: string[];
  scanDepth?: 'shallow' | 'recursive';
  totalScanned?: number;
  customDetails?: string;
}

export class EmptyState {
  private container: HTMLElement;
  private options: Required<Omit<IEmptyStateOptions, 'title' | 'message' | 'suggestion' | 'actions'>> & 
                   Pick<IEmptyStateOptions, 'title' | 'message' | 'suggestion' | 'actions'>;
  private info: IEmptyStateInfo;
  private emptyElement: HTMLElement | null = null;

  private static readonly DEFAULT_OPTIONS = {
    type: 'no-images' as const,
    showIcon: true,
    showActions: true,
    size: 'medium' as const,
    title: undefined,
    message: undefined,
    suggestion: undefined,
    actions: undefined
  };

  // Empty state type configurations
  private static readonly EMPTY_CONFIGS = {
    'no-images': {
      icon: '🖼️',
      title: 'No Images Found',
      defaultMessage: 'No images were found in the specified location',
      defaultSuggestion: 'Check that the path exists and contains supported image files (JPG, PNG, GIF, WebP)',
      color: '#6c757d'
    },
    'no-path': {
      icon: '📁',
      title: 'Path Not Found',
      defaultMessage: 'The specified path does not exist',
      defaultSuggestion: 'Verify the folder or file path is correct and accessible',
      color: '#dc3545'
    },
    'validation-failed': {
      icon: '⚠️',
      title: 'Validation Failed',
      defaultMessage: 'No images passed validation checks',
      defaultSuggestion: 'Check file sizes, formats, and permissions for the images',
      color: '#fd7e14'
    },
    'permission-denied': {
      icon: '🔒',
      title: 'Access Denied',
      defaultMessage: 'Unable to access the specified location',
      defaultSuggestion: 'Check folder permissions and try again',
      color: '#6f42c1'
    },
    'custom': {
      icon: '❓',
      title: 'Empty Gallery',
      defaultMessage: 'No content to display',
      defaultSuggestion: 'Please check your gallery configuration',
      color: '#6c757d'
    }
  };

  constructor(container: HTMLElement, info: IEmptyStateInfo, options: IEmptyStateOptions = {}) {
    this.container = container;
    this.info = info;
    this.options = { ...EmptyState.DEFAULT_OPTIONS, ...options };
    this.render();
  }

  /**
   * Render the empty state
   */
  private render(): void {
    // Clear existing content
    if (this.emptyElement) {
      this.emptyElement.remove();
    }

    const config = EmptyState.EMPTY_CONFIGS[this.options.type];

    // Create main empty state container
    this.emptyElement = this.container.createDiv({
      cls: [
        'gallery-empty-state',
        `gallery-empty-${this.options.type}`,
        `gallery-empty-${this.options.size}`
      ].join(' ')
    });

    // Set theme color
    this.emptyElement.style.setProperty('--empty-color', config.color);

    // Add icon if enabled
    if (this.options.showIcon) {
      const iconElement = this.emptyElement.createDiv('gallery-empty-icon');
      iconElement.textContent = config.icon;
    }

    // Add title
    const titleElement = this.emptyElement.createDiv('gallery-empty-title');
    titleElement.textContent = this.options.title || config.title;

    // Add main message
    const messageElement = this.emptyElement.createDiv('gallery-empty-message');
    messageElement.textContent = this.options.message || config.defaultMessage;

    // Add contextual information
    this.renderContextInfo();

    // Add suggestion
    if (this.options.suggestion || config.defaultSuggestion) {
      const suggestionElement = this.emptyElement.createDiv('gallery-empty-suggestion');
      suggestionElement.textContent = this.options.suggestion || config.defaultSuggestion;
    }

    // Add actions if enabled
    if (this.options.showActions && this.options.actions && this.options.actions.length > 0) {
      this.renderActions();
    }
  }

  /**
   * Render contextual information based on empty state type and info
   */
  private renderContextInfo(): void {
    const infoContainer = this.emptyElement!.createDiv('gallery-empty-info');

    // Show path information
    if (this.info.path) {
      const pathElement = infoContainer.createDiv('gallery-empty-path');
      pathElement.createSpan('gallery-empty-label').textContent = 'Path: ';
      pathElement.createSpan('gallery-empty-value').textContent = this.info.path;
    }

    // Show scan depth
    if (this.info.scanDepth) {
      const depthElement = infoContainer.createDiv('gallery-empty-depth');
      depthElement.createSpan('gallery-empty-label').textContent = 'Scan: ';
      depthElement.createSpan('gallery-empty-value').textContent = 
        this.info.scanDepth === 'recursive' ? 'Recursive (all subfolders)' : 'Current folder only';
    }

    // Show total scanned count
    if (typeof this.info.totalScanned === 'number') {
      const scannedElement = infoContainer.createDiv('gallery-empty-scanned');
      scannedElement.createSpan('gallery-empty-label').textContent = 'Files scanned: ';
      scannedElement.createSpan('gallery-empty-value').textContent = this.info.totalScanned.toString();
    }

    // Show expected formats
    if (this.info.expectedFormats && this.info.expectedFormats.length > 0) {
      const formatsElement = infoContainer.createDiv('gallery-empty-formats');
      formatsElement.createSpan('gallery-empty-label').textContent = 'Supported formats: ';
      formatsElement.createSpan('gallery-empty-value').textContent = this.info.expectedFormats.join(', ');
    }

    // Show search criteria
    if (this.info.searchCriteria) {
      const criteriaElement = infoContainer.createDiv('gallery-empty-criteria');
      criteriaElement.createSpan('gallery-empty-label').textContent = 'Search: ';
      criteriaElement.createSpan('gallery-empty-value').textContent = this.info.searchCriteria;
    }

    // Show custom details
    if (this.info.customDetails) {
      const detailsElement = infoContainer.createDiv('gallery-empty-details');
      detailsElement.textContent = this.info.customDetails;
    }
  }

  /**
   * Render action buttons
   */
  private renderActions(): void {
    const actionsContainer = this.emptyElement!.createDiv('gallery-empty-actions');

    this.options.actions!.forEach((actionConfig) => {
      const actionButton = actionsContainer.createEl('button', {
        cls: [
          'gallery-empty-action',
          `gallery-empty-action-${actionConfig.type || 'secondary'}`
        ].join(' ')
      });

      // Add icon if provided
      if (actionConfig.icon) {
        const iconSpan = actionButton.createSpan('gallery-empty-action-icon');
        iconSpan.textContent = actionConfig.icon;
      }

      // Add label
      const labelSpan = actionButton.createSpan('gallery-empty-action-label');
      labelSpan.textContent = actionConfig.label;

      // Add click handler
      actionButton.addEventListener('click', () => {
        try {
          actionConfig.action();
        } catch (error) {
          console.error('Error executing empty state action:', error);
        }
      });
    });
  }

  /**
   * Update empty state information
   */
  updateInfo(newInfo: Partial<IEmptyStateInfo>): void {
    this.info = { ...this.info, ...newInfo };
    this.render();
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<IEmptyStateOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * Show the empty state
   */
  show(): void {
    if (this.emptyElement) {
      this.emptyElement.style.display = '';
      this.emptyElement.addClass('gallery-empty-visible');
    }
  }

  /**
   * Hide the empty state
   */
  hide(): void {
    if (this.emptyElement) {
      this.emptyElement.removeClass('gallery-empty-visible');
      this.emptyElement.addClass('gallery-empty-hidden');
    }
  }

  /**
   * Remove the empty state
   */
  destroy(): void {
    if (this.emptyElement) {
      this.emptyElement.remove();
      this.emptyElement = null;
    }
  }

  /**
   * Create a no-images empty state
   */
  static createNoImages(
    container: HTMLElement,
    path: string,
    recursive: boolean = true,
    retryAction?: () => void
  ): EmptyState {
    const actions: IEmptyStateAction[] = [];
    
    if (retryAction) {
      actions.push({
        label: 'Scan Again',
        action: retryAction,
        type: 'primary',
        icon: '🔄'
      });
    }

    return new EmptyState(container, {
      path,
      scanDepth: recursive ? 'recursive' : 'shallow',
      expectedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    }, {
      type: 'no-images',
      size: 'medium',
      showActions: actions.length > 0,
      actions
    });
  }

  /**
   * Create a path-not-found empty state
   */
  static createPathNotFound(
    container: HTMLElement,
    path: string,
    suggestions: string[] = []
  ): EmptyState {
    const customSuggestion = suggestions.length > 0 
      ? suggestions.join(' • ')
      : 'Check that the path exists and is accessible';

    return new EmptyState(container, {
      path,
      customDetails: 'The specified path could not be found or accessed'
    }, {
      type: 'no-path',
      size: 'medium',
      suggestion: customSuggestion
    });
  }

  /**
   * Create a validation-failed empty state
   */
  static createValidationFailed(
    container: HTMLElement,
    path: string,
    totalScanned: number,
    validationErrors: string[],
    retryAction?: () => void
  ): EmptyState {
    const actions: IEmptyStateAction[] = [];
    
    if (retryAction) {
      actions.push({
        label: 'Try Again',
        action: retryAction,
        type: 'primary',
        icon: '🔄'
      });
    }

    return new EmptyState(container, {
      path,
      totalScanned,
      customDetails: `Validation errors: ${validationErrors.slice(0, 3).join('; ')}${validationErrors.length > 3 ? '...' : ''}`
    }, {
      type: 'validation-failed',
      size: 'medium',
      showActions: actions.length > 0,
      actions
    });
  }

  /**
   * Create a permission-denied empty state
   */
  static createPermissionDenied(
    container: HTMLElement,
    path: string
  ): EmptyState {
    return new EmptyState(container, {
      path,
      customDetails: 'Access to this location is restricted'
    }, {
      type: 'permission-denied',
      size: 'medium',
      suggestion: 'Check folder permissions or try a different location'
    });
  }

  /**
   * Create a custom empty state
   */
  static createCustom(
    container: HTMLElement,
    title: string,
    message: string,
    info: IEmptyStateInfo = {},
    actions: IEmptyStateAction[] = []
  ): EmptyState {
    return new EmptyState(container, info, {
      type: 'custom',
      title,
      message,
      size: 'medium',
      showActions: actions.length > 0,
      actions
    });
  }
}

/**
 * EmptyStateManager for coordinating multiple empty states
 */
export class EmptyStateManager {
  private activeStates: Map<string, EmptyState> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Show empty state with a unique key
   */
  showEmptyState(key: string, info: IEmptyStateInfo, options: IEmptyStateOptions = {}): EmptyState {
    // Remove existing state with same key
    this.hideEmptyState(key);

    // Create new empty state
    const emptyState = new EmptyState(this.container, info, options);
    this.activeStates.set(key, emptyState);
    
    return emptyState;
  }

  /**
   * Hide empty state for a specific key
   */
  hideEmptyState(key: string): void {
    const emptyState = this.activeStates.get(key);
    if (emptyState) {
      emptyState.destroy();
      this.activeStates.delete(key);
    }
  }

  /**
   * Hide all empty states
   */
  hideAllEmptyStates(): void {
    this.activeStates.forEach(state => state.destroy());
    this.activeStates.clear();
  }

  /**
   * Update empty state information
   */
  updateEmptyState(key: string, info: Partial<IEmptyStateInfo>): void {
    const emptyState = this.activeStates.get(key);
    if (emptyState) {
      emptyState.updateInfo(info);
    }
  }

  /**
   * Check if a specific empty state is active
   */
  hasEmptyState(key: string): boolean {
    return this.activeStates.has(key);
  }

  /**
   * Check if any empty states are active
   */
  hasActiveStates(): boolean {
    return this.activeStates.size > 0;
  }

  /**
   * Get all active state keys
   */
  getActiveStateKeys(): string[] {
    return Array.from(this.activeStates.keys());
  }
}