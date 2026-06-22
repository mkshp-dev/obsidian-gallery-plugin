import { SourceResolverRegistry } from '../resolvers/SourceResolverRegistry';
import { Logger } from "../utils/Logger";
import { MarkdownPostProcessorContext } from 'obsidian';
import { IGalleryConfig, IContentScanner, IGalleryView, IImageSource, ISourceConfig, ObsidianDOMExtensions } from '../models/interfaces';
import { GalleryInstance } from '../models/GalleryInstance';
import { ParameterParser } from './ParameterParser';
import { ConfigValidator } from '../utils/ConfigValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ViewFactory } from '../views/ViewFactory';
import { LoadingManager } from '../views/components/LoadingSpinner';
import { EmptyState } from '../views/components/EmptyState';
import { ImageValidator } from '../utils/ImageValidator';
import { FileSizeValidator } from '../utils/FileSizeValidator';
import { ImageLoader } from '../utils/ImageLoader';
import { IImmichConnection } from '../models/interfaces';

export interface IGalleryProcessingOptions {
  errorDisplayMode?: 'full' | 'text' | 'hidden';
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
    private resolverRegistry: SourceResolverRegistry;

    private readonly DEFAULT_OPTIONS: Required<IGalleryProcessingOptions> = {
        errorDisplayMode: 'full',
        showLoadingFeedback: true,
        enableValidation: true,
        maxRetries: 3,
        timeoutMs: 30000
        ,allowRemoteImages: false
        ,validateRemoteContentType: false
        ,gracePeriodMs: 30000
        ,enableLifecycleLogging: false
    };

    constructor(contentScanner: IContentScanner, viewFactory: ViewFactory, getConnections: () => IImmichConnection[]) {
        this.contentScanner = contentScanner;
        this.viewFactory = viewFactory;
        this.imageValidator = new ImageValidator();
        this.fileSizeValidator = new FileSizeValidator();
        this.resolverRegistry = new SourceResolverRegistry(contentScanner, getConnections);
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
        let scannedImages: IImageSource[] = [];

        try {
            // Clear previous content (use safe clear for environments where `empty()` helper is unavailable)
            const obsEl = el as unknown as ObsidianDOMExtensions;
            if (obsEl.empty && typeof obsEl.empty === 'function') {
                obsEl.empty();
            } else {
                while (el.firstChild) el.removeChild(el.firstChild);
            }
            
            // Initialize managers
            if (opts.showLoadingFeedback) {
                loadingManager = new LoadingManager(el);
            }

            // Step 1: Parse and validate configuration
            const config = await this.parseAndValidateConfiguration(source, result, loadingManager);
            if (result.errors.length > 0) {
                throw new Error(`Configuration errors: ${result.errors.join(', ')}`);
            }

            // Step 2: Scan for images
            scannedImages = await this.scanForImages(config, result, opts, loadingManager);
            if (scannedImages.length === 0) {
                this.showProfessionalEmptyState(el, config, result);
                result.processingTimeMs = Date.now() - startTime;
                return result;
            }

            // Step 3: Validate images
            const validImages = await this.validateImages(scannedImages, result, opts, loadingManager);
            if (validImages.length === 0) {
                // If there were external images but remote loading is disabled, show a friendly empty state
                const hadExternal = scannedImages.some((img: IImageSource) => img.type === 'external');
                if (hadExternal && !opts.allowRemoteImages) {
                    const msg = 'No valid images: external URLs were present but remote image loading is disabled in plugin settings.';
                    result.errors.push(msg);
                    // Render an explanatory empty state to guide the user rather than throwing
                    try {
                        this.showProfessionalEmptyState(el, config, result);
                    } catch {
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
            // Clean up any scanned images that haven't been safely handed off to a GalleryInstance
            if (scannedImages.length > 0) {
                scannedImages.forEach(img => img.destroy?.());
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(errorMessage);
            result.processingTimeMs = Date.now() - startTime;

            Logger.error('Error processing gallery code block:', error);
            this.handleProcessingError(error as Error, el, opts);

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
            Logger.error('Gallery processing failed:', result.errors);
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

        let viewType = 'thumbnail';
        if (config.view) {
            if (typeof config.view === 'string') {
                viewType = config.view;
            } else if (typeof config.view === 'object' && config.view !== null && 'type' in config.view) {
                viewType = (config.view as { type: string }).type;
            }
        }

        try {
            let images: IImageSource[] = [];

            if (config.sources) {
                for (const source of config.sources) {
                    const resolveContext = { timeoutMs: options.timeoutMs, viewType };
                    const { images: resolvedImages, errors: resolveErrors } = await this.resolverRegistry.resolveSource(source, resolveContext);

                    if (resolveErrors.length > 0) {
                        result.errors.push(...resolveErrors);
                    }

                    for (const img of resolvedImages) {
                        if (!images.find(existing => existing.path === img.path)) {
                            images.push(img);
                        }
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
        images: IImageSource[], 
        result: IGalleryRenderResult,
        options: Required<IGalleryProcessingOptions>,
        loadingManager: LoadingManager | null
    ): Promise<IImageSource[]> {
        if (!options.enableValidation) {
            result.imagesValid = images.length;
            return images;
        }

        if (loadingManager) {
            loadingManager.startLoading('validate', { type: 'pulse', text: `Validating ${images.length} images...` });
        }

        const validImages: IImageSource[] = [];
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
                        } catch {
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

        // Clean up resources for any images that failed validation and were excluded
        for (const image of images) {
            if (!validImages.includes(image)) {
                image.destroy?.();
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
        images: IImageSource[],
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
                    Logger.debug(`GalleryProcessor: found existing gallery for path ${config.path} (id=${existing.id}), destroying before creating new instance.`);
                    this.destroyGallery(existing.id);
                }
            } catch {
                // swallow errors to avoid breaking rendering
            }

            // Create view
            let viewType = 'thumbnail';
            if (config.view) {
                if (typeof config.view === 'string') {
                    viewType = config.view;
                } else if (typeof config.view === 'object' && config.view !== null && 'type' in config.view) {
                    viewType = (config.view as { type: string }).type;
                }
            }
            const view = this.viewFactory.createView(viewType, container);
            
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
                        if (view.setOptions) {
                            view.setOptions({ remoteLoadTimeoutMs: options.timeoutMs, allowRemoteImages: options.allowRemoteImages });
                        }
                    } catch (error) { Logger.debug('Ignored error:', error); }

                    // Backwards-compat: set properties directly for simple views
                    try {
                        view.remoteLoadTimeoutMs = options.timeoutMs;
                        view.allowRemoteImages = options.allowRemoteImages;
                    } catch (error) { Logger.debug('Ignored error:', error); }

                    view.update(images);
                    view.render();
                    
                    // Wait for initial render
                    await this.waitForInitialRender(view, options.timeoutMs);
                    
                    // Get stats if available (fallback for interface compatibility)
                    const stats = view.getStats?.() || { loadedImages: images.length };
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
                    
                    Logger.warn(`Render attempt ${retryCount} failed, retrying...`, renderError);
                    
                    if (loadingManager) {
                        loadingManager.updateText('render', `Retrying render (${retryCount}/${options.maxRetries})...`);
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => window.setTimeout(resolve, 1000 * retryCount));
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
            const timeout = window.setTimeout(() => {
                reject(new Error('Render timeout'));
            }, timeoutMs);

            // Check render status periodically
            const checkInterval = window.setInterval(() => {
                const stats = view.getStats?.() || { loadedImages: 0, errorImages: 0 };
                if (stats.loadedImages > 0 || stats.errorImages > 0) {
                    window.clearTimeout(timeout);
                    window.clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Also resolve immediately if view reports ready
            const stats = view.getStats?.() || { totalImages: 0 };
            if (stats.totalImages > 0) {
                window.clearTimeout(timeout);
                window.clearInterval(checkInterval);
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
            let viewType = 'thumbnail';
            if (config.view) {
                if (typeof config.view === 'string') {
                    viewType = config.view;
                } else if (typeof config.view === 'object' && config.view !== null && 'type' in config.view) {
                    viewType = (config.view as { type: string }).type;
                }
            }
            const view = this.viewFactory.createView(viewType, container);
            
            // Create gallery instance
            const gallery = new GalleryInstance(config, container, view, images);
            
            // Store active gallery
            this.activeGalleries.set(gallery.id, gallery);
            
            // Setup cleanup when container is removed
            this.setupGalleryCleanup(gallery);
            
            // Render gallery
            view.render();
            
            Logger.debug(`Gallery created: ${gallery.id} with ${images.length} images`);
            
        } catch (error) {
            Logger.error('Error creating gallery:', error);
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
        const obsContainer = container as unknown as ObsidianDOMExtensions;
        if (obsContainer.empty && typeof obsContainer.empty === 'function') {
            obsContainer.empty();
        } else {
            while (container.firstChild) container.removeChild(container.firstChild);
        }

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
                            try { activeDocument.dispatchEvent(new CustomEvent('gallery-open-settings')); } catch (error) { Logger.debug('Ignored error:', error); };
                        },
                        type: 'primary',
                        icon: '⚙️'
                    },
                    {
                        label: 'Scan Again',
                        action: () => { void this.refreshGalleryByConfig(container, config); },
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
                () => { void this.refreshGalleryByConfig(container, config); }
            );
        } else if (hasPermissionError) {
            EmptyState.createPermissionDenied(container, config.path);
        } else {
            // No images found
            EmptyState.createNoImages(
                container,
                config.path,
                config.recursive || true,
                () => { void this.refreshGalleryByConfig(container, config); }
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
            Logger.error('Error refreshing gallery:', error);
        }
    }

    /**
     * Serialize config back to string format for re-processing
     */
    private serializeConfig(config: IGalleryConfig): string {
        const out: Record<string, unknown> = {};
        if (config.sources && config.sources.length > 0) {
            out.sources = config.sources;
        } else {
            if (config.path) out.path = config.path;
            if (config.urls) out.urls = config.urls;
            if (config.recursive !== undefined) out.recursive = config.recursive;
        }
        out.view = config.view;
        if (config.limit) out.limit = config.limit;
        if (config.sort) out.sort = config.sort;

        // Basic yaml serializer for fallback
        const lines: string[] = [];
        if (out.sources) {
            lines.push('sources:');
            for (const src of out.sources as ISourceConfig[]) {
                lines.push(`  - type: ${src.type}`);
                if (src.type === 'local' && src.path) lines.push(`    path: ${src.path}`);
                if (src.type === 'local' && src.recursive !== undefined) lines.push(`    recursive: ${(src.recursive) ? 'true' : 'false'}`);
                if (src.type === 'external' && src.urls && Array.isArray(src.urls)) {
                    lines.push('    urls:');
                    for (const u of src.urls) lines.push(`      - ${u}`);
                }
            }
        } else {
            if (out.path) lines.push(`path: ${out.path as string}`);
            if (out.recursive !== undefined) lines.push(`recursive: ${(out.recursive as boolean) ? 'true' : 'false'}`);
            if (out.urls && Array.isArray(out.urls)) {
                lines.push('urls:');
                for (const u of out.urls) lines.push(`  - ${u as string}`);
            }
        }

        if (out.view) {
            if (typeof out.view === 'string') {
                lines.push(`view: ${out.view}`);
            } else if (typeof out.view === 'object' && out.view !== null) {
                lines.push('view:');
                const v = out.view as Record<string, unknown>;
                if (v.type) lines.push(`  type: ${v.type as string}`);
                for (const k of Object.keys(v)) {
                    if (k !== 'type') lines.push(`  ${k}: ${v[k] as string | number | boolean}`);
                }
            }
        }

        if (out.limit) lines.push(`limit: ${out.limit as number}`);
        if (out.sort) lines.push(`sort: ${out.sort as string}`);

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
            // gallery container remains detached from the activeDocument.
            let sawRemoval = false;
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === gallery.container || (node.instanceOf(Element) && node.contains(gallery.container))) {
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
                        try { (gallery as unknown as { _detached?: boolean })._detached = true; } catch (error) { Logger.debug('Ignored error:', error); }

                        const GRACE_PERIOD_MS = Math.max(0, options.gracePeriodMs || 30000);
                        if (options.enableLifecycleLogging) {
                            Logger.debug(`GalleryProcessor: gallery ${gallery.id} appears detached; marking detached and scheduling final destroy in ${GRACE_PERIOD_MS}ms.`);
                        }

                        window.setTimeout(() => {
                            try {
                                if ((gallery as unknown as { _detached?: boolean })._detached) {
                                    if (options.enableLifecycleLogging) {
                                        Logger.debug(`GalleryProcessor: gallery ${gallery.id} still detached after grace period; destroying.`);
                                    }
                                    this.destroyGallery(gallery.id);
                                }
                            } catch {
                                try { this.destroyGallery(gallery.id); } catch (error) { Logger.debug('Ignored error:', error); }
                            }
                        }, GRACE_PERIOD_MS);

                        try { observer.disconnect(); } catch (error) { Logger.debug('Ignored error:', error); }
                        return;
                    }

                    // schedule next check
                    window.setTimeout(tryCheck, attempts[attemptIndex]);
                } catch {
                    // If something unexpected happens, attempt a safe cleanup
                    try { this.destroyGallery(gallery.id); } catch (error) { Logger.debug('Ignored error:', error); }
                    try { observer.disconnect(); } catch (error) { Logger.debug('Ignored error:', error); }
                }
            };

            // Start checks
            window.setTimeout(tryCheck, attempts[0]);
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
    private handleProcessingError(error: Error, container: HTMLElement, options?: Required<IGalleryProcessingOptions>): void {
        const errorDisplayMode = options?.errorDisplayMode || this.DEFAULT_OPTIONS.errorDisplayMode;

        const obsContainer = container as unknown as ObsidianDOMExtensions;
        const emptyContainer = () => {
            if (obsContainer.empty && typeof obsContainer.empty === 'function') {
                obsContainer.empty();
            } else {
                while (container.firstChild) container.removeChild(container.firstChild);
            }
        };

        if (errorDisplayMode === 'hidden') {
            // Clear container and do not render any error message
            emptyContainer();
            return;
        }

        if (errorDisplayMode === 'text') {
            emptyContainer();

            const errorEl = container.ownerDocument.createElement('div');
            errorEl.className = 'gallery-error-text';
            errorEl.textContent = `Gallery Error: ${error.message}`;
            container.appendChild(errorEl);
            return;
        }
        // Clear container (support both Obsidian helpers and plain DOM)
        emptyContainer();
        
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
            Logger.warn('Gallery not found for refresh:', galleryId);
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
            
            Logger.debug(`Gallery refreshed: ${galleryId} with ${images.length} images`);
            
        } catch (error) {
            Logger.error('Error refreshing gallery:', error);
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
            Logger.debug(`Gallery destroyed: ${galleryId}`);
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
        Logger.debug('All galleries refreshed');
    }

    /**
     * Destroy all galleries
     */
    destroyAllGalleries(): void {
        const galleryIds = Array.from(this.activeGalleries.keys());
        galleryIds.forEach(id => this.destroyGallery(id));
        Logger.debug(`Destroyed ${galleryIds.length} galleries`);
    }

    /**
     * Get processor statistics
     */
    getStats(): {
        activeGalleries: number;
        totalImages: number;
        cacheStats: unknown;
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
        Logger.debug('Gallery processor destroyed');
    }
}