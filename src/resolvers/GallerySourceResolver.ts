import { ISourceConfig, IImageSource } from '../models/interfaces';

/**
 * Context provided to resolvers during source resolution
 */
export interface GallerySourceResolveContext {
    timeoutMs?: number;
    viewType?: string;
    /** Vault-relative path of the note containing the gallery code block, used to resolve relative "local" source paths */
    notePath?: string;
    // Any future context properties can be added here
}

/** What a resolver found for one source */
export interface GallerySourceResult {
    images: IImageSource[];
    errors: string[];
    /**
     * Names of photo and video files the source holds in formats galleries can't show (HEIC,
     * RAW, ...), for the note under the gallery. Missing when the source can't tell.
     */
    skipped?: string[];
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
    resolve(source: TSourceConfig, context: GallerySourceResolveContext): Promise<GallerySourceResult>;
}
