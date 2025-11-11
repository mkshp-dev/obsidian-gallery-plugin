import { MarkdownPostProcessorContext } from 'obsidian';
import { IGalleryConfig, IContentScanner, IGalleryView } from '../models/interfaces';
import { GalleryConfig } from '../models/GalleryConfig';
import { GalleryInstance } from '../models/GalleryInstance';
import { ParameterParser } from './ParameterParser';
import { ConfigValidator } from '../utils/ConfigValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ViewFactory } from '../views/ViewFactory';
import { LoadingManager } from '../views/components/LoadingSpinner';
import { ErrorManager } from '../views/components/ErrorPlaceholder';
import { EmptyState } from '../views/components/EmptyState';
import { ImageValidator } from '../utils/ImageValidator';
import { FileSizeValidator } from '../utils/FileSizeValidator';
import { ImageLoader } from '../utils/ImageLoader';
import { ImageSource } from '../models/ImageSource';

export interface IGalleryProcessingOptions {
  showLoadingFeedback?: boolean;
  enableValidation?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
    allowRemoteImages?: boolean;
        validateRemoteContentType?: boolean;
        // How long to wait (ms) before final destruction of a detached gallery
        gracePeriodMs?: number;
        // Enable verbose lifecycle logging for debugging mode toggles
        enableLifecycleLogging?: boolean;
}

export interface IGalleryRenderResult {
  success: boolean;
  galleryInstance?: GalleryInstance;
  imagesFound: number;
  imagesValid: number;
  imagesLoaded: number;
  errors: string[];
  processingTimeMs: number;
}

/**
 * Gallery processor for handling obs-gallery code blocks
 * Coordinates parsing, validation, and rendering of galleries
 */
export class GalleryProcessor {
    private contentScanner: IContentScanner;
    private viewFactory: ViewFactory;
    private imageValidator: ImageValidator;
    private fileSizeValidator: FileSizeValidator;
    private activeGalleries: Map<string, GalleryInstance> = new Map();

    private readonly DEFAULT_OPTIONS: Required<IGalleryProcessingOptions> = {
        showLoadingFeedback: true,
        enableValidation: true,
        maxRetries: 3,
        timeoutMs: 30000
        ,allowRemoteImages: false
        ,validateRemoteContentType: false
        ,gracePeriodMs: 30000
        ,enableLifecycleLogging: false
    };

    constructor(contentScanner: IContentScanner, viewFactory: ViewFactory) {
        this.contentScanner = contentScanner;
        this.viewFactory = viewFactory;
        this.imageValidator = new ImageValidator();
        this.fileSizeValidator = new FileSizeValidator();
    }

    /**
     * Process obs-gallery code block with comprehensive pipeline
     */
    async processCodeBlock(
        source: string, 
        el: HTMLElement, 
        ctx: MarkdownPostProcessorContext,
        options: IGalleryProcessingOptions = {}
    ): Promise<IGalleryRenderResult> {
        const startTime = Date.now();
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        const result: IGalleryRenderResult = {
            success: false,
            imagesFound: 0,
            imagesValid: 0,
            imagesLoaded: 0,
            errors: [],
            processingTimeMs: 0
        };

        let loadingManager: LoadingManager | null = null;
        let errorManager: ErrorManager | null = null;

        try {
            // Clear previous content (use safe clear for environments where `empty()` helper is unavailable)
            if ((el as any).empty && typeof (el as any).empty === 'function') {
                (el as any).empty();
            } else {
                while (el.firstChild) el.removeChild(el.firstChild);
            }
            
            // Initialize managers
            if (opts.showLoadingFeedback) {
                loadingManager = new LoadingManager(el);
                errorManager = new ErrorManager(el);
            }

            // Step 1: Parse and validate configuration
            const config = await this.parseAndValidateConfiguration(source, result, loadingManager);
            if (result.errors.length > 0) {
                throw new Error(`Configuration errors: ${result.errors.join(', ')}`);
            }

            // Step 2: Scan for images
            const images = await this.scanForImages(config, result, opts, loadingManager);
            if (images.length === 0) {
                this.showProfessionalEmptyState(el, config, result);
                result.processingTimeMs = Date.now() - startTime;
                return result;
            }

            // Step 3: Validate images
            const validImages = await this.validateImages(images, result, opts, loadingManager);
            if (validImages.length === 0) {
                // If there were external images but remote loading is disabled, show a friendly empty state
                const hadExternal = images.some((img: any) => img.type === 'external');
                if (hadExternal && !opts.allowRemoteImages) {
                    const msg = 'No valid images: external URLs were present but remote image loading is disabled in plugin settings.';
                    result.errors.push(msg);
                    // Render an explanatory empty state to guide the user rather than throwing
                    try {
                        this.showProfessionalEmptyState(el, config, result);
                    } catch (e) {
                        // Fallback to throwing if rendering fails
                        throw new Error(msg);
                    }
                    result.processingTimeMs = Date.now() - startTime;
                    return result;
                }

                result.errors.push('No images passed validation');
                throw new Error('No valid images after validation');
            }

            // Step 4: Create and render gallery
            const galleryInstance = await this.createAndRenderGallery(
                config, el, validImages, result, opts, loadingManager
            );

            result.success = true;
            result.galleryInstance = galleryInstance;
            result.processingTimeMs = Date.now() - startTime;

            // Clean up loading state
            if (loadingManager) {
                loadingManager.stopAllLoading();
            }

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(errorMessage);
            result.processingTimeMs = Date.now() - startTime;

            console.error('Error processing gallery code block:', error);
            this.handleProcessingError(error as Error, el);

            return result;

        } finally {
            // Clean up managers
            if (loadingManager) {
                loadingManager.stopAllLoading();
            }
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async processCodeBlockLegacy(
        source: string, 
        el: HTMLElement, 
        ctx: MarkdownPostProcessorContext
    ): Promise<void> {
        const result = await this.processCodeBlock(source, el, ctx);
        if (!result.success) {
            console.error('Gallery processing failed:', result.errors);
        }
    }

    /**
     * Step 1: Parse and validate configuration
     */
    private async parseAndValidateConfiguration(
        source: string, 
        result: IGalleryRenderResult,
        loadingManager: LoadingManager | null
    ): Promise<IGalleryConfig> {
        if (loadingManager) {
            loadingManager.startLoading('config', { type: 'spinner', text: 'Parsing configuration...' });
        }

        try {
            // Parse configuration
            const config = ParameterParser.parseAndValidate(source);
            
            // Validate configuration
            this.validateConfiguration(config);
            
            if (loadingManager) {
                loadingManager.updateText('config', 'Configuration validated');
            }
            
            return config;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Configuration error: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Step 2: Scan for images
     */
    private async scanForImages(
        config: IGalleryConfig,
        result: IGalleryRenderResult,
        options: Required<IGalleryProcessingOptions>,
        loadingManager: LoadingManager | null
    ) {
        if (loadingManager) {
            loadingManager.startLoading('scan', { type: 'dots', text: 'Scanning for images...' });
        }

        try {
            // If a path is provided, scan the vault; otherwise start with empty list
            let images: any[] = [];

            if (config.path && config.path.trim() !== '') {
                const scanned = await Promise.race([
                    this.contentScanner.scanPath(config.path, config.recursive),
                    new Promise<never>((_, reject) => 
                        setTimeout(() => reject(new Error('Scanning timeout')), options.timeoutMs)
                    )
                ]);
                images = scanned || [];
            }

            // Include any external URLs provided in the config (merge, avoid duplicates)
            const configAny = config as any;
            if (Array.isArray(configAny.urls) && configAny.urls.length > 0) {
                for (const url of configAny.urls) {
                    try {
                        const external = ImageSource.fromUrl(url as string);
                        // Avoid duplicates by path
                        if (!images.find(img => img.path === external.path)) {
                            images.push(external);
                        }
                    } catch (err) {
                        // Ignore invalid URL entries but record error
                        result.errors.push(`Invalid URL in urls list: ${url}`);
                    }
                }
            }

            result.imagesFound = images.length;

            if (loadingManager && images.length > 0) {
                loadingManager.updateText('scan', `Found ${images.length} images`);
            }

            return images;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Image scanning failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Step 3: Validate images
     */
    private async validateImages(
        images: any[], 
        result: IGalleryRenderResult,
        options: Required<IGalleryProcessingOptions>,
        loadingManager: LoadingManager | null
    ) {
        if (!options.enableValidation) {
            result.imagesValid = images.length;
            return images;
        }

        if (loadingManager) {
            loadingManager.startLoading('validate', { type: 'pulse', text: `Validating ${images.length} images...` });
        }

        const validImages: any[] = [];
        const validationErrors: string[] = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            try {
                // Update progress
                if (loadingManager) {
                    loadingManager.updateText('validate', `Validating image ${i + 1}/${images.length}`);
                }

                // Additional validation logic
                if (image.type === 'local') {
                    // Validate image format (using simple extension check for local files)
                    const cleanPath = image.path.split('?')[0].split('#')[0];
                    const extension = cleanPath.substring(cleanPath.lastIndexOf('.')).toLowerCase();
                    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                    if (!supportedExtensions.includes(extension)) {
                        validationErrors.push(`Invalid format: ${image.path}`);
                        continue;
                    }

                    // Validate local source accessibility via scanner
                    const isValid = await this.contentScanner.validateImageSource(image);
                    if (!isValid) {
                        validationErrors.push(`Source validation failed: ${image.path}`);
                        continue;
                    }

                } else if (image.type === 'external') {
                    // External images require plugin opt-in
                    if (!options.allowRemoteImages) {
                        validationErrors.push(`External image blocked by settings: ${image.path}`);
                        continue;
                    }

                    // Accept external URLs even if they lack a file extension.
                    // Basic check: ensure the URL is syntactically valid.
                    try {
                        new URL(image.path);
                    } catch {
                        validationErrors.push(`Invalid external URL: ${image.path}`);
                        continue;
                    }
                    // Optional content-type validation via HEAD request
                    if (options.validateRemoteContentType) {
                        try {
                            const isImage = await ImageLoader.validateImageUrl(image.path, Math.min(5000, options.timeoutMs));
                            if (!isImage) {
                                validationErrors.push(`External URL does not appear to be an image: ${image.path}`);
                                continue;
                            }
                        } catch (e) {
                            validationErrors.push(`Failed to validate external URL: ${image.path}`);
                            continue;
                        }
                    }
                }

                validImages.push(image);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                validationErrors.push(`Validation error for ${image.path}: ${errorMessage}`);
            }
        }

        result.imagesValid = validImages.length;
        if (validationErrors.length > 0) {
            result.errors.push(...validationErrors);
        }

        if (loadingManager) {
            loadingManager.updateText('validate', `${validImages.length} images validated`);
        }

        return validImages;
    }

    /**
     * Step 4: Create and render gallery
     */
    private async createAndRenderGallery(
        config: IGalleryConfig,
        container: HTMLElement,
        images: any[],
        result: IGalleryRenderResult,
        options: Required<IGalleryProcessingOptions>,
        loadingManager: LoadingManager | null
    ): Promise<GalleryInstance> {
        if (loadingManager) {
            loadingManager.startLoading('render', { type: 'skeleton', text: `Rendering ${images.length} images...` });
        }

        try {
            // If there's an existing gallery for the same path, remove it first to
            // avoid duplicate instances when the markdown post-processor runs
            // multiple times during mode toggles. Matching by config.path is a
            // reasonable heuristic for the same code block instance.
            try {
                const existing = Array.from(this.activeGalleries.values()).find(g => g.config.path === config.path && g.id !== undefined);
                if (existing) {
                    console.log(`GalleryProcessor: found existing gallery for path ${config.path} (id=${existing.id}), destroying before creating new instance.`);
                    this.destroyGallery(existing.id);
                }
            } catch (e) {
                // swallow errors to avoid breaking rendering
            }

            // Create view
            const view = this.viewFactory.createView(config.view || 'thumbnail', container);
            
            // Create gallery instance
            const galleryInstance = new GalleryInstance(config, container, view, images);
            
            // Store active gallery
            this.activeGalleries.set(galleryInstance.id, galleryInstance);
            
            // Setup cleanup when container is removed (pass options so cleanup
            // honors runtime-configurable grace period and logging)
            this.setupGalleryCleanup(galleryInstance, options);
            
            // Render gallery with retry logic
            let retryCount = 0;
            while (retryCount <= options.maxRetries) {
                try {
                    // Pass runtime options to view when supported (backwards-compatible)
                    try {
                        // Preferred: view has a setOptions API
                        (view as any).setOptions?.({ remoteLoadTimeoutMs: options.timeoutMs, allowRemoteImages: options.allowRemoteImages });
                    } catch {}

                    // Backwards-compat: set properties directly for simple views
                    try {
                        (view as any).remoteLoadTimeoutMs = options.timeoutMs;
                        (view as any).allowRemoteImages = options.allowRemoteImages;
                    } catch {}

                    await view.update(images);
                    view.render();
                    
                    // Wait for initial render
                    await this.waitForInitialRender(view, options.timeoutMs);
                    
                    // Get stats if available (fallback for interface compatibility)
                    const stats = (view as any).getStats?.() || { loadedImages: images.length };
                    result.imagesLoaded = stats.loadedImages;
                    
                    if (loadingManager) {
                        loadingManager.updateText('render', `Rendered ${result.imagesLoaded} images`);
                    }

                    return galleryInstance;

                } catch (renderError) {
                    retryCount++;
                    if (retryCount > options.maxRetries) {
                        throw renderError;
                    }
                    
                    console.warn(`Render attempt ${retryCount} failed, retrying...`, renderError);
                    
                    if (loadingManager) {
                        loadingManager.updateText('render', `Retrying render (${retryCount}/${options.maxRetries})...`);
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            throw new Error('Max retries exceeded');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Gallery rendering failed: ${errorMessage}`);
        }
    }

    /**
     * Wait for initial render to complete
     */
    private async waitForInitialRender(view: IGalleryView, timeoutMs: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Render timeout'));
            }, timeoutMs);

            // Check render status periodically
            const checkInterval = setInterval(() => {
                const stats = (view as any).getStats?.() || { loadedImages: 0, errorImages: 0 };
                if (stats.loadedImages > 0 || stats.errorImages > 0) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Also resolve immediately if view reports ready
            const stats = (view as any).getStats?.() || { totalImages: 0 };
            if (stats.totalImages > 0) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                resolve();
            }
        });
    }

    /**
     * Validate gallery configuration
     */
    private validateConfiguration(config: IGalleryConfig): void {
        try {
            ConfigValidator.validateOrThrow(config);
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Create gallery from configuration
     */
    async createGallery(config: IGalleryConfig, container: HTMLElement): Promise<void> {
        try {
            // Scan for images
            const images = await this.contentScanner.scanPath(config.path, config.recursive);
            
            if (images.length === 0) {
                this.showProfessionalEmptyState(container, config, {
                    success: false,
                    imagesFound: 0,
                    imagesValid: 0,
                    imagesLoaded: 0,
                    errors: ['No images found in the specified path'],
                    processingTimeMs: 0
                });
                return;
            }

            // Create view
            const view = this.viewFactory.createView(config.view || 'thumbnail', container);
            
            // Create gallery instance
            const gallery = new GalleryInstance(config, container, view, images);
            
            // Store active gallery
            this.activeGalleries.set(gallery.id, gallery);
            
            // Setup cleanup when container is removed
            this.setupGalleryCleanup(gallery);
            
            // Render gallery
            view.render();
            
            console.log(`Gallery created: ${gallery.id} with ${images.length} images`);
            
        } catch (error) {
            console.error('Error creating gallery:', error);
            throw new Error(`Gallery creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Show professional empty state using EmptyState component
     */
    private showProfessionalEmptyState(
        container: HTMLElement, 
        config: IGalleryConfig, 
        result: IGalleryRenderResult
    ): void {
        // Clear container
        (container as any).empty();

        // Determine the type of empty state based on the errors
        const hasPathError = result.errors.some(error => 
            error.includes('not found') || error.includes('Path not found')
        );
        const hasValidationError = result.errors.some(error => 
            error.includes('validation') || error.includes('Validation')
        );
        const hasPermissionError = result.errors.some(error => 
            error.includes('permission') || error.includes('Access')
        );
        const hasExternalBlocked = result.errors.some(error => 
            error.includes('external URLs were present') || error.includes('External image blocked')
        );

        if (hasPathError) {
            EmptyState.createPathNotFound(container, config.path, [
                'Check that the folder exists in your vault',
                'Verify the path spelling and capitalization',
                'Make sure you have access to the folder'
            ]);
        } else if (hasExternalBlocked) {
            // Show a specific message guiding the user to enable remote images
            EmptyState.createCustom(
                container,
                'External images blocked',
                'The gallery contains external image URLs, but remote image loading is disabled in plugin settings. Enable "Allow remote images" in Settings → Gallery Plugin to display them.',
                {
                    path: config.path,
                    customDetails: 'External URLs were detected in the gallery configuration.'
                },
                [
                    {
                        label: 'Open Settings',
                        action: () => {
                            try { document.dispatchEvent(new CustomEvent('gallery-open-settings')); } catch {};
                        },
                        type: 'primary',
                        icon: '⚙️'
                    },
                    {
                        label: 'Scan Again',
                        action: () => this.refreshGalleryByConfig(container, config),
                        type: 'secondary',
                        icon: '🔄'
                    }
                ]
            );
        } else if (hasValidationError) {
            EmptyState.createValidationFailed(
                container, 
                config.path, 
                result.imagesFound,
                result.errors,
                () => this.refreshGalleryByConfig(container, config)
            );
        } else if (hasPermissionError) {
            EmptyState.createPermissionDenied(container, config.path);
        } else {
            // No images found
            EmptyState.createNoImages(
                container,
                config.path,
                config.recursive || true,
                () => this.refreshGalleryByConfig(container, config)
            );
        }
    }

    /**
     * Refresh gallery by rescanning (for empty state retry)
     */
    private async refreshGalleryByConfig(container: HTMLElement, config: IGalleryConfig): Promise<void> {
        try {
            // Clear cache for this path
            this.contentScanner.invalidateCache(config.path);
            
            // Re-process the gallery
            await this.processCodeBlock(
                this.serializeConfig(config), 
                container, 
                {} as MarkdownPostProcessorContext
            );
        } catch (error) {
            console.error('Error refreshing gallery:', error);
        }
    }

    /**
     * Serialize config back to string format for re-processing
     */
    private serializeConfig(config: IGalleryConfig): string {
        const lines: string[] = [];
        
        lines.push(`path: ${config.path}`);
        
        if (config.view && config.view !== 'thumbnail') {
            lines.push(`view: ${config.view}`);
        }
        
        if (config.recursive !== undefined && !config.recursive) {
            lines.push(`recursive: false`);
        }
        
        // Add any additional config properties that exist
        const configAny = config as any;
        if (configAny.limit && configAny.limit > 0) {
            lines.push(`limit: ${configAny.limit}`);
        }
        
        if (configAny.sort && configAny.sort !== 'name') {
            lines.push(`sort: ${configAny.sort}`);
        }

        if (Array.isArray(configAny.urls) && configAny.urls.length > 0) {
            // Serialize urls as YAML list
            lines.push('urls:');
            for (const u of configAny.urls) {
                lines.push(`  - ${u}`);
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Setup gallery cleanup when container is removed from DOM
     */
    private setupGalleryCleanup(gallery: GalleryInstance, options: Required<IGalleryProcessingOptions> = this.DEFAULT_OPTIONS): void {
        // Use MutationObserver to detect when gallery container is removed
        const observer = new MutationObserver((mutations) => {
            // If we see a removal, don't immediately destroy: Obsidian may transiently
            // move or reparent nodes when toggling sidebars or changing layouts. Defer
            // the actual destruction check by a short timeout and only destroy if the
            // gallery container remains detached from the document.
            let sawRemoval = false;
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === gallery.container || (node instanceof Element && node.contains(gallery.container))) {
                        sawRemoval = true;
                    }
                });
            });

            if (!sawRemoval) return;

            // Defer checks to allow transient DOM moves (sidebar toggle, layout shifts)
            // to settle. Use a few retries with exponential backoff before deciding
            // the container is permanently gone.
            // Retry schedule (ms) — extended to handle slower reattachment scenarios
            const attempts = [200, 500, 1000, 2000, 5000, 10000];
            let attemptIndex = 0;

            const tryCheck = () => {
                try {
                    const doc = gallery.container?.ownerDocument;
                    const stillAttached = !!(doc && doc.body && doc.body.contains(gallery.container));
                    if (stillAttached) {
                        // it's back — do nothing
                        return;
                    }

                    attemptIndex++;
                    if (attemptIndex >= attempts.length) {
                        // final check failed — consider it removed for now but allow a grace
                        // period to support Obsidian re-rendering cycles (e.g., switching
                        // between editor/preview). Mark the gallery as detached and
                        // schedule a final destruction after a longer grace period so
                        // that the markdown post-processor can reattach a new container
                        // without losing the opportunity to recreate the gallery.
                        try { (gallery as any)._detached = true; } catch {}

                        const GRACE_PERIOD_MS = Math.max(0, options.gracePeriodMs || 30000);
                        if (options.enableLifecycleLogging) {
                            console.log(`GalleryProcessor: gallery ${gallery.id} appears detached; marking detached and scheduling final destroy in ${GRACE_PERIOD_MS}ms.`);
                        }

                        setTimeout(() => {
                            try {
                                if ((gallery as any)._detached) {
                                    if (options.enableLifecycleLogging) {
                                        console.log(`GalleryProcessor: gallery ${gallery.id} still detached after grace period; destroying.`);
                                    }
                                    this.destroyGallery(gallery.id);
                                }
                            } catch (e) {
                                try { this.destroyGallery(gallery.id); } catch {}
                            }
                        }, GRACE_PERIOD_MS);

                        try { observer.disconnect(); } catch {}
                        return;
                    }

                    // schedule next check
                    setTimeout(tryCheck, attempts[attemptIndex]);
                } catch (e) {
                    // If something unexpected happens, attempt a safe cleanup
                    try { this.destroyGallery(gallery.id); } catch {}
                    try { observer.disconnect(); } catch {}
                }
            };

            // Start checks
            setTimeout(tryCheck, attempts[0]);
        });

        // Observe the parent document for changes
        if (gallery.container.ownerDocument) {
            observer.observe(gallery.container.ownerDocument.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Handle processing errors
     */
    private handleProcessingError(error: Error, container: HTMLElement): void {
        // Clear container (support both Obsidian helpers and plain DOM)
        if ((container as any).empty && typeof (container as any).empty === 'function') {
            (container as any).empty();
        } else {
            while (container.firstChild) container.removeChild(container.firstChild);
        }
        
        // Check if it's a configuration error
        if (error.message.includes('Configuration')) {
            const configError = {
                type: 'config' as const,
                field: 'general',
                message: error.message,
                suggestion: 'Check the gallery configuration syntax and parameters'
            };
            ErrorHandler.handleConfigError(configError, container);
        } else {
            // General plugin error
            ErrorHandler.handlePluginError(error, 'code block processing', container);
        }
    }

    /**
     * Refresh gallery by re-scanning content
     */
    async refreshGallery(galleryId: string): Promise<void> {
        const gallery = this.activeGalleries.get(galleryId);
        if (!gallery) {
            console.warn('Gallery not found for refresh:', galleryId);
            return;
        }

        try {
            // Clear cache for this path
            this.contentScanner.invalidateCache(gallery.config.path);
            
            // Re-scan for images
            const images = await this.contentScanner.scanPath(
                gallery.config.path, 
                gallery.config.recursive
            );
            
            // Update gallery
            gallery.update(images);
            
            console.log(`Gallery refreshed: ${galleryId} with ${images.length} images`);
            
        } catch (error) {
            console.error('Error refreshing gallery:', error);
            ErrorHandler.handlePluginError(error as Error, 'gallery refresh', gallery.container);
        }
    }

    /**
     * Destroy gallery and cleanup resources
     */
    destroyGallery(galleryId: string): void {
        const gallery = this.activeGalleries.get(galleryId);
        if (gallery) {
            gallery.destroy();
            this.activeGalleries.delete(galleryId);
            console.log(`Gallery destroyed: ${galleryId}`);
        }
    }

    /**
     * Get active gallery by ID
     */
    getGallery(galleryId: string): GalleryInstance | undefined {
        return this.activeGalleries.get(galleryId);
    }

    /**
     * Get all active galleries
     */
    getAllGalleries(): GalleryInstance[] {
        return Array.from(this.activeGalleries.values());
    }

    /**
     * Get galleries for specific path
     */
    getGalleriesForPath(path: string): GalleryInstance[] {
        return this.getAllGalleries().filter(gallery => 
            gallery.config.path === path
        );
    }

    /**
     * Refresh all galleries
     */
    async refreshAllGalleries(): Promise<void> {
        const refreshPromises = Array.from(this.activeGalleries.keys())
            .map(id => this.refreshGallery(id));
        
        await Promise.allSettled(refreshPromises);
        console.log('All galleries refreshed');
    }

    /**
     * Destroy all galleries
     */
    destroyAllGalleries(): void {
        const galleryIds = Array.from(this.activeGalleries.keys());
        galleryIds.forEach(id => this.destroyGallery(id));
        console.log(`Destroyed ${galleryIds.length} galleries`);
    }

    /**
     * Get processor statistics
     */
    getStats(): {
        activeGalleries: number;
        totalImages: number;
        cacheStats: any;
    } {
        const galleries = this.getAllGalleries();
        const totalImages = galleries.reduce((sum, gallery) => 
            sum + gallery.totalCount, 0
        );
        
        return {
            activeGalleries: galleries.length,
            totalImages,
            cacheStats: this.contentScanner.getCacheStats?.() || null
        };
    }

    /**
     * Export gallery configuration
     */
    exportGalleryConfig(galleryId: string): IGalleryConfig | null {
        const gallery = this.getGallery(galleryId);
        return gallery ? gallery.config : null;
    }

    /**
     * Validate configuration without creating gallery
     */
    async validateGalleryConfig(source: string): Promise<{ 
        isValid: boolean; 
        config?: IGalleryConfig; 
        errors: string[] 
    }> {
        const errors: string[] = [];
        let config: IGalleryConfig | undefined;
        
        try {
            config = ParameterParser.parseAndValidate(source);
            this.validateConfiguration(config);
            return { isValid: true, config, errors: [] };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            return { isValid: false, errors };
        }
    }

    /**
     * Cleanup processor resources
     */
    destroy(): void {
        this.destroyAllGalleries();
        this.contentScanner.destroy?.();
        console.log('Gallery processor destroyed');
    }
}