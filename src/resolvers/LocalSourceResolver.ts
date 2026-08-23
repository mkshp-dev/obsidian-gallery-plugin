import { ILocalSourceConfig, IImageSource, IContentScanner } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { NotePathResolver } from '../utils/NotePathResolver';

export class LocalSourceResolver implements GallerySourceResolver<ILocalSourceConfig> {
    readonly type = 'local';

    constructor(private contentScanner: IContentScanner) {}

    async resolve(source: ILocalSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        if (!source.path || source.path.trim() === '') {
            return { images: [], errors: [] };
        }

        const resolvedPath = NotePathResolver.resolve(source.path, context.notePath);
        const resolvePromise = this.contentScanner.scanPath(resolvedPath, source.recursive);

        if (context.timeoutMs) {
            const images = await Promise.race([
                resolvePromise,
                new Promise<never>((_, reject) =>
                    window.setTimeout(() => reject(new Error('Scanning timeout')), context.timeoutMs)
                )
            ]);
            return { images, errors: [] };
        }

        const images = await resolvePromise;
        return { images, errors: [] };
    }
}
