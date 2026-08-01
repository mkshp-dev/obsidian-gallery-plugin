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

        for (const item of source.urls) {
            let urlStr: string;
            let captionStr: string | undefined = undefined;

            if (typeof item === 'string') {
                urlStr = item;
            } else if (typeof item === 'object' && item !== null && typeof (item as { url?: unknown }).url === 'string') {
                urlStr = (item as { url: string }).url;
                if (typeof (item as { caption?: unknown }).caption === 'string' && (item as { caption: string }).caption.trim()) {
                    captionStr = (item as { caption: string }).caption.trim();
                }
            } else {
                errors.push(`Invalid URL entry in external source urls list: ${JSON.stringify(item)}`);
                continue;
            }

            try {
                const external = ImageSource.fromUrl(urlStr, undefined, captionStr);
                images.push(external);
            } catch {
                errors.push(`Invalid URL in external source urls list: ${urlStr}`);
            }
        }

        return { images, errors };
    }
}
