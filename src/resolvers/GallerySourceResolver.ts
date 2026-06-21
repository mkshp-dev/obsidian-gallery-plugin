import { ISourceConfig, IImageSource } from '../models/interfaces';

/**
 * Context provided to resolvers during source resolution
 */
export interface GallerySourceResolveContext {
    timeoutMs?: number;
    // Any future context properties can be added here
}

/**
 * Base interface for all source resolvers
 */
export interface GallerySourceResolver<TSourceConfig extends ISourceConfig = ISourceConfig> {
    /** The source type this resolver handles */
    readonly type: TSourceConfig["type"];

    /**
     * Resolves a source configuration into gallery assets
     * @param source The source configuration to resolve
     * @param context Additional context for the resolution process
     * @returns Array of resolved image sources
     */
    resolve(source: TSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }>;
}
