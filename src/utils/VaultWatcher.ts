/**
 * Vault file system watcher for automatic gallery updates
 * Monitors file system changes and triggers gallery refreshes
 */

import { Vault, TFile, TAbstractFile, EventRef } from 'obsidian';

export interface IVaultWatcherOptions {
  watchExtensions?: string[];
  debounceMs?: number;
  enableLogging?: boolean;
}

export interface IVaultWatcherCallback {
  onFileAdded?: (file: TFile) => void;
  onFileDeleted?: (file: TAbstractFile) => void;
  onFileRenamed?: (file: TFile, oldPath: string) => void;
  onFileModified?: (file: TFile) => void;
}

export class VaultWatcher {
  private vault: Vault;
  private options: Required<IVaultWatcherOptions>;
  private callbacks: IVaultWatcherCallback;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isActive: boolean = false;
  
  // Store event references for proper cleanup
  private eventRefs: EventRef[] = [];

  private static readonly DEFAULT_OPTIONS: Required<IVaultWatcherOptions> = {
    watchExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
    debounceMs: 500,
    enableLogging: false
  };

  constructor(vault: Vault, callbacks: IVaultWatcherCallback, options: IVaultWatcherOptions = {}) {
    this.vault = vault;
    this.callbacks = callbacks;
    this.options = { ...VaultWatcher.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start watching vault for file changes
   */
  start(): void {
    if (this.isActive) {
      this.log('VaultWatcher already active');
      return;
    }

    this.isActive = true;
    this.log('Starting VaultWatcher');

    // Register event handlers and store references
    this.eventRefs.push(
      this.vault.on('create', this.handleFileCreate.bind(this)),
      this.vault.on('delete', this.handleFileDelete.bind(this)),
      this.vault.on('rename', this.handleFileRename.bind(this)),
      this.vault.on('modify', this.handleFileModify.bind(this))
    );

    this.log('VaultWatcher started successfully');
  }

  /**
   * Stop watching vault for file changes
   */
  stop(): void {
    if (!this.isActive) {
      this.log('VaultWatcher already inactive');
      return;
    }

    this.isActive = false;
    this.log('Stopping VaultWatcher');

    // Clear any pending debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Unregister all event handlers
    this.eventRefs.forEach(ref => this.vault.offref(ref));
    this.eventRefs = [];

    this.log('VaultWatcher stopped successfully');
  }

  /**
   * Check if watcher is currently active
   */
  isWatching(): boolean {
    return this.isActive;
  }

  /**
   * Update watch options
   */
  updateOptions(newOptions: Partial<IVaultWatcherOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.log('VaultWatcher options updated', this.options);
  }

  /**
   * Update callbacks
   */
  updateCallbacks(newCallbacks: Partial<IVaultWatcherCallback>): void {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
    this.log('VaultWatcher callbacks updated');
  }

  /**
   * Handle file creation
   */
  private handleFileCreate(file: TAbstractFile): void {
    if (!(file instanceof TFile) || !this.isImageFile(file.path)) {
      return;
    }

    this.log(`File created: ${file.path}`);
    this.debounceCallback('create', file.path, () => {
      if (this.callbacks.onFileAdded) {
        this.callbacks.onFileAdded(file);
      }
    });
  }

  /**
   * Handle file deletion
   */
  private handleFileDelete(file: TAbstractFile): void {
    if (!this.isImageFile(file.path)) {
      return;
    }

    this.log(`File deleted: ${file.path}`);
    this.debounceCallback('delete', file.path, () => {
      if (this.callbacks.onFileDeleted) {
        this.callbacks.onFileDeleted(file);
      }
    });
  }

  /**
   * Handle file rename
   */
  private handleFileRename(file: TAbstractFile, oldPath: string): void {
    if (!(file instanceof TFile)) {
      return;
    }

    const isOldImage = this.isImageFile(oldPath);
    const isNewImage = this.isImageFile(file.path);

    if (!isOldImage && !isNewImage) {
      return;
    }

    this.log(`File renamed: ${oldPath} -> ${file.path}`);
    
    if (isOldImage && isNewImage) {
      // Image renamed to image - treat as rename
      this.debounceCallback('rename', file.path, () => {
        if (this.callbacks.onFileRenamed) {
          this.callbacks.onFileRenamed(file, oldPath);
        }
      });
    } else if (isOldImage && !isNewImage) {
      // Image renamed to non-image - treat as delete
      this.debounceCallback('delete', oldPath, () => {
        if (this.callbacks.onFileDeleted) {
          this.callbacks.onFileDeleted({ path: oldPath } as TAbstractFile);
        }
      });
    } else if (!isOldImage && isNewImage) {
      // Non-image renamed to image - treat as create
      this.debounceCallback('create', file.path, () => {
        if (this.callbacks.onFileAdded) {
          this.callbacks.onFileAdded(file);
        }
      });
    }
  }

  /**
   * Handle file modification
   */
  private handleFileModify(file: TAbstractFile): void {
    if (!(file instanceof TFile) || !this.isImageFile(file.path)) {
      return;
    }

    this.log(`File modified: ${file.path}`);
    this.debounceCallback('modify', file.path, () => {
      if (this.callbacks.onFileModified) {
        this.callbacks.onFileModified(file);
      }
    });
  }

  /**
   * Check if file is an image based on extension
   */
  private isImageFile(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return this.options.watchExtensions.includes(extension);
  }

  /**
   * Get file extension including the dot
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot >= 0 ? filePath.substring(lastDot).toLowerCase() : '';
  }

  /**
   * Debounce callback execution to prevent rapid-fire events
   */
  private debounceCallback(action: string, filePath: string, callback: () => void): void {
    const key = `${action}:${filePath}`;
    
    // Clear existing timer for this file/action
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      callback();
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: any): void {
    if (this.options.enableLogging) {
      if (data) {
        console.log(`[VaultWatcher] ${message}`, data);
      } else {
        console.log(`[VaultWatcher] ${message}`);
      }
    }
  }

  /**
   * Get current options
   */
  getOptions(): Required<IVaultWatcherOptions> {
    return { ...this.options };
  }

  /**
   * Get supported image extensions
   */
  getSupportedExtensions(): string[] {
    return [...this.options.watchExtensions];
  }

  /**
   * Check if a file extension is supported
   */
  isExtensionSupported(extension: string): boolean {
    return this.options.watchExtensions.includes(extension.toLowerCase());
  }

  /**
   * Force refresh all callbacks (useful for manual refresh)
   */
  forceRefresh(): void {
    this.log('Force refresh requested');
    
    // Clear all pending timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Get all image files in vault
    const imageFiles = this.vault.getFiles().filter(file => this.isImageFile(file.path));
    
    // Trigger onFileAdded for all images (simulates a full refresh)
    if (this.callbacks.onFileAdded) {
      imageFiles.forEach(file => {
        if (this.callbacks.onFileAdded) {
          this.callbacks.onFileAdded(file);
        }
      });
    }
  }
}