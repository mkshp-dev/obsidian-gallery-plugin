/**
 * LoadingSpinner component for gallery loading states
 * Provides different loading indicators for various use cases
 */

export interface ILoadingSpinnerOptions {
  size?: 'small' | 'medium' | 'large';
  type?: 'spinner' | 'dots' | 'pulse' | 'skeleton';
  text?: string;
  showProgress?: boolean;
  progress?: number; // 0-100
  inline?: boolean;
}

export class LoadingSpinner {
  private container: HTMLElement;
  private options: Required<ILoadingSpinnerOptions>;
  private spinnerElement: HTMLElement | null = null;
  private textElement: HTMLElement | null = null;
  private progressElement: HTMLElement | null = null;

  private static readonly DEFAULT_OPTIONS: Required<ILoadingSpinnerOptions> = {
    size: 'medium',
    type: 'spinner',
    text: 'Loading...',
    showProgress: false,
    progress: 0,
    inline: false
  };

  constructor(container: HTMLElement, options: ILoadingSpinnerOptions = {}) {
    this.container = container;
    this.options = { ...LoadingSpinner.DEFAULT_OPTIONS, ...options };
    this.render();
  }

  /**
   * Render the loading spinner
   */
  private render(): void {
    // Clear existing content if any
    if (this.spinnerElement) {
      this.spinnerElement.remove();
    }

    // Create main spinner container (support both Obsidian helpers and plain DOM)
    this.spinnerElement = this.createDiv(this.container, {
      cls: [
        'gallery-loading-spinner',
        `gallery-loading-${this.options.size}`,
        `gallery-loading-${this.options.type}`,
        this.options.inline ? 'gallery-loading-inline' : ''
      ].filter(Boolean).join(' ')
    });

    // Render based on type
    switch (this.options.type) {
      case 'spinner':
        this.renderSpinner();
        break;
      case 'dots':
        this.renderDots();
        break;
      case 'pulse':
        this.renderPulse();
        break;
      case 'skeleton':
        this.renderSkeleton();
        break;
    }

    // Add text if provided
    if (this.options.text) {
      this.textElement = this.createDiv(this.spinnerElement!, 'gallery-loading-text');
      this.textElement.textContent = this.options.text;
      // Accessibility: announce loading text to assistive tech
      this.textElement.setAttribute('role', 'status');
      this.textElement.setAttribute('aria-live', 'polite');
    }

    // Add progress bar if enabled
    if (this.options.showProgress) {
      this.renderProgressBar();
    }
  }

  /**
   * Render spinning circle loader
   */
  private renderSpinner(): void {
  const spinnerIcon = this.createDiv(this.spinnerElement!, 'gallery-spinner-icon');
    
    // Create SVG spinner using standard DOM API
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', this.getSizePixels().toString());
    svg.setAttribute('height', this.getSizePixels().toString());
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'gallery-spinner-rotating');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('stroke-linecap', 'round');
    circle.setAttribute('stroke-dasharray', '31.416');
    circle.setAttribute('stroke-dashoffset', '31.416');

    svg.appendChild(circle);
    spinnerIcon.appendChild(svg);
  }

  /**
   * Render bouncing dots loader
   */
  private renderDots(): void {
  const dotsContainer = this.createDiv(this.spinnerElement!, 'gallery-dots-container');
    
    for (let i = 0; i < 3; i++) {
  const dot = this.createDiv(dotsContainer, 'gallery-dot');
      dot.style.animationDelay = `${i * 0.1}s`;
    }
  }

  /**
   * Render pulsing loader
   */
  private renderPulse(): void {
  const pulseContainer = this.createDiv(this.spinnerElement!, 'gallery-pulse-container');
    
    for (let i = 0; i < 2; i++) {
  const pulse = this.createDiv(pulseContainer, 'gallery-pulse');
      pulse.style.animationDelay = `${i * 0.5}s`;
    }
  }

  /**
   * Render skeleton placeholder loader
   */
  private renderSkeleton(): void {
  const skeletonContainer = this.createDiv(this.spinnerElement!, 'gallery-skeleton-container');
    
    // Create multiple skeleton lines
    for (let i = 0; i < 3; i++) {
  const skeletonLine = this.createDiv(skeletonContainer, 'gallery-skeleton-line');
      
      // Vary the width for more realistic look
      const widths = ['100%', '80%', '60%'];
      skeletonLine.style.width = widths[i] || '100%';
    }
  }

  /**
   * Render progress bar
   */
  private renderProgressBar(): void {
  const progressContainer = this.createDiv(this.spinnerElement!, 'gallery-progress-container');

  const progressBar = this.createDiv(progressContainer, 'gallery-progress-bar');
  this.progressElement = this.createDiv(progressBar, 'gallery-progress-fill');
    
    // Set initial progress
    this.updateProgress(this.options.progress);
    
    // Add percentage text
    const progressText = progressContainer.createDiv('gallery-progress-text');
    progressText.textContent = `${Math.round(this.options.progress)}%`;
  }

  /**
   * Update loading text
   */
  updateText(text: string): void {
    this.options.text = text;
    if (this.textElement) {
      this.textElement.textContent = text;
    }
  }

  /**
   * Update progress percentage
   */
  updateProgress(progress: number): void {
    this.options.progress = Math.max(0, Math.min(100, progress));
    
    if (this.progressElement) {
      this.progressElement.style.width = `${this.options.progress}%`;
      
      // Update progress text
      const progressText = this.spinnerElement?.querySelector('.gallery-progress-text');
      if (progressText) {
        progressText.textContent = `${Math.round(this.options.progress)}%`;
      }
    }
  }

  /**
   * Show the loading spinner
   */
  show(): void {
    if (this.spinnerElement) {
      this.spinnerElement.style.display = '';
      this.addClass(this.spinnerElement, 'gallery-loading-visible');
    }
  }

  /**
   * Hide the loading spinner
   */
  hide(): void {
    if (this.spinnerElement) {
      this.removeClass(this.spinnerElement, 'gallery-loading-visible');
      this.addClass(this.spinnerElement, 'gallery-loading-hidden');
      
      // Remove after animation
      setTimeout(() => {
        if (this.spinnerElement) {
          this.spinnerElement.style.display = 'none';
        }
      }, 300);
    }
  }

  /**
   * Create a div element appended to parent. Supports Obsidian helper API when present.
   */
  private createDiv(parent: HTMLElement, arg?: string | { cls?: string }): HTMLElement {
    if (!parent) {
      return document.createElement('div');
    }

    // If parent provides createDiv, use it
    const anyParent = parent as any;
    if (anyParent.createDiv && typeof anyParent.createDiv === 'function') {
      if (typeof arg === 'string') return anyParent.createDiv(arg);
      return anyParent.createDiv(arg || {});
    }

    // Fallback to standard DOM
    const el = document.createElement('div');
    if (typeof arg === 'string') el.className = arg;
    else if (arg && arg.cls) el.className = arg.cls;
    parent.appendChild(el);
    return el;
  }

  private addClass(el: HTMLElement, cls: string) {
    try {
      const anyEl = el as any;
      if (anyEl.addClass && typeof anyEl.addClass === 'function') anyEl.addClass(cls);
      else el.classList.add(cls);
    } catch {}
  }

  private removeClass(el: HTMLElement, cls: string) {
    try {
      const anyEl = el as any;
      if (anyEl.removeClass && typeof anyEl.removeClass === 'function') anyEl.removeClass(cls);
      else el.classList.remove(cls);
    } catch {}
  }

  /**
   * Remove the loading spinner completely
   */
  destroy(): void {
    if (this.spinnerElement) {
      this.spinnerElement.remove();
      this.spinnerElement = null;
      this.textElement = null;
      this.progressElement = null;
    }
  }

  /**
   * Get size in pixels based on size setting
   */
  private getSizePixels(): number {
    switch (this.options.size) {
      case 'small': return 16;
      case 'medium': return 24;
      case 'large': return 32;
      default: return 24;
    }
  }

  /**
   * Create a simple inline loading indicator
   */
  static createInline(container: HTMLElement, text: string = 'Loading...'): LoadingSpinner {
    return new LoadingSpinner(container, {
      type: 'dots',
      size: 'small',
      text,
      inline: true
    });
  }

  /**
   * Create a progress-enabled loading indicator
   */
  static createWithProgress(container: HTMLElement, text: string = 'Loading...'): LoadingSpinner {
    return new LoadingSpinner(container, {
      type: 'spinner',
      size: 'medium',
      text,
      showProgress: true
    });
  }

  /**
   * Create a skeleton loading placeholder
   */
  static createSkeleton(container: HTMLElement): LoadingSpinner {
    return new LoadingSpinner(container, {
      type: 'skeleton',
      size: 'medium',
      text: '',
      inline: false
    });
  }

  /**
   * Create a full-screen overlay loading indicator
   */
  static createOverlay(container: HTMLElement, text: string = 'Loading gallery...'): LoadingSpinner {
    // Add overlay styling to container
    container.addClass('gallery-loading-overlay');
    
    return new LoadingSpinner(container, {
      type: 'spinner',
      size: 'large',
      text,
      inline: false
    });
  }
}

/**
 * LoadingManager for coordinating multiple loading states
 */
export class LoadingManager {
  private activeLoaders: Map<string, LoadingSpinner> = new Map();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Start loading with a unique key
   */
  startLoading(key: string, options: ILoadingSpinnerOptions = {}): LoadingSpinner {
    // Remove existing loader with same key
    this.stopLoading(key);

    // Create new loader
    const loader = new LoadingSpinner(this.container, options);
    this.activeLoaders.set(key, loader);
    
    return loader;
  }

  /**
   * Stop loading for a specific key
   */
  stopLoading(key: string): void {
    const loader = this.activeLoaders.get(key);
    if (loader) {
      loader.destroy();
      this.activeLoaders.delete(key);
    }
  }

  /**
   * Stop all loading indicators
   */
  stopAllLoading(): void {
    this.activeLoaders.forEach(loader => loader.destroy());
    this.activeLoaders.clear();
  }

  /**
   * Update progress for a specific loader
   */
  updateProgress(key: string, progress: number): void {
    const loader = this.activeLoaders.get(key);
    if (loader) {
      loader.updateProgress(progress);
    }
  }

  /**
   * Update text for a specific loader
   */
  updateText(key: string, text: string): void {
    const loader = this.activeLoaders.get(key);
    if (loader) {
      loader.updateText(text);
    }
  }

  /**
   * Check if a specific loader is active
   */
  isLoading(key: string): boolean {
    return this.activeLoaders.has(key);
  }

  /**
   * Check if any loaders are active
   */
  hasActiveLoaders(): boolean {
    return this.activeLoaders.size > 0;
  }

  /**
   * Get all active loader keys
   */
  getActiveKeys(): string[] {
    return Array.from(this.activeLoaders.keys());
  }
}