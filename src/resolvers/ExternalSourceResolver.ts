import { IExternalSourceConfig, IImageSource } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { ImageSource } from '../models/ImageSource';

export class ExternalSourceResolver implements GallerySourceResolver<IExternalSourceConfig> {
    readonly type = 'external';

    async resolve(source: IExternalSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        const images: IImageSource[] = [];
        const errors: string[] = [];

        if (!source.urls || !Array.isArray(source.urls)) {
            return { images, errors };
        }

        for (const url of source.urls) {
            try {
                const external = ImageSource.fromUrl(url);
                images.push(external);
            } catch {
                errors.push(`Invalid URL in external source urls list: ${url}`);
            }
        }

        return { images, errors };
    }
}
