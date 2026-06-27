import { ISourceConfig, IImageSource, IContentScanner } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { LocalSourceResolver } from './LocalSourceResolver';
import { ExternalSourceResolver } from './ExternalSourceResolver';
import { ImmichShareSourceResolver } from './ImmichShareSourceResolver';
import { ImmichSourceResolver } from './ImmichSourceResolver';
import { IImmichConnection } from '../models/interfaces';

export class SourceResolverRegistry {
    private resolvers: Map<string, GallerySourceResolver<ISourceConfig>> = new Map();

    constructor(contentScanner: IContentScanner, getConnections: () => IImmichConnection[]) {
        this.registerResolver(new LocalSourceResolver(contentScanner));
        this.registerResolver(new ExternalSourceResolver());
        this.registerResolver(new ImmichShareSourceResolver());
        this.registerResolver(new ImmichSourceResolver(getConnections));
    }

    registerResolver(resolver: GallerySourceResolver<ISourceConfig>) {
        this.resolvers.set(resolver.type, resolver);
    }

    getResolver(type: string): GallerySourceResolver<ISourceConfig> | undefined {
        return this.resolvers.get(type);
    }

    async resolveSource(source: ISourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const resolver = this.getResolver(source.type);
        if (!resolver) {
            return { images: [], errors: [`Unsupported source type: ${source.type}`] };
        }

        try {
            return await resolver.resolve(source, context);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { images: [], errors: [errorMessage] };
        }
    }
}
