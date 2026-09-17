import { ILocalSourceConfig, IImageSource, IContentScanner } from '../models/interfaces';
import { GallerySourceResolver, GallerySourceResolveContext } from './GallerySourceResolver';
import { NotePathResolver } from '../utils/NotePathResolver';
import { globToRegex } from '../utils/globToRegex';

export class LocalSourceResolver implements GallerySourceResolver<ILocalSourceConfig> {
    readonly type = 'local';

    constructor(private contentScanner: IContentScanner) {}

    async resolve(source: ILocalSourceConfig, context: GallerySourceResolveContext): Promise<{ images: IImageSource[], errors: string[] }> {
        if (!source.path || source.path.trim() === '') {
            return { images: [], errors: [] };
        }

        const resolvedPath = NotePathResolver.resolve(source.path, context.notePath);
        const resolvePromise = this.contentScanner.scanPath(resolvedPath, source.recursive);

        let images: IImageSource[];
        if (context.timeoutMs) {
            images = await Promise.race([
                resolvePromise,
                new Promise<never>((_, reject) =>
                    window.setTimeout(() => reject(new Error('Scanning timeout')), context.timeoutMs)
                )
            ]);
        } else {
            images = await resolvePromise;
        }

        images = this.applyFiltersAndSort(images, source);

        return { images, errors: [] };
    }

    private applyFiltersAndSort(images: IImageSource[], source: ILocalSourceConfig): IImageSource[] {
        let result = images;

        if (source.filenameFilter) {
            const regex = globToRegex(source.filenameFilter);
            result = result.filter(img => regex.test(img.path.split('/').pop() || ''));
        }

        if (source.filters) {
            const { modifiedAfter, modifiedBefore, maxSizeKb, minSizeKb } = source.filters;

            const afterDate = modifiedAfter ? new Date(modifiedAfter).getTime() : undefined;
            const beforeDate = modifiedBefore ? new Date(modifiedBefore).getTime() : undefined;

            if (afterDate !== undefined || beforeDate !== undefined) {
                result = result.filter(img => {
                    if (img.mtime === undefined) return true;
                    if (afterDate !== undefined && img.mtime < afterDate) return false;
                    if (beforeDate !== undefined && img.mtime > beforeDate) return false;
                    return true;
                });
            }

            if (maxSizeKb !== undefined || minSizeKb !== undefined) {
                result = result.filter(img => {
                    if (img.size === undefined) return true;

                    const maxSizeBytes = maxSizeKb !== undefined ? maxSizeKb * 1024 : undefined;
                    const minSizeBytes = minSizeKb !== undefined ? minSizeKb * 1024 : undefined;

                    if (maxSizeBytes !== undefined && img.size > maxSizeBytes) return false;
                    if (minSizeBytes !== undefined && img.size < minSizeBytes) return false;

                    return true;
                });
            }
        }

        if (source.sort) {
            const { by, order } = source.sort;
            result = [...result].sort((a, b) => {
                let comparison = 0;
                if (by === 'name') {
                    comparison = a.displayName.localeCompare(b.displayName);
                } else if (by === 'size') {
                    comparison = (a.size || 0) - (b.size || 0);
                } else if (by === 'modified') {
                    comparison = (a.mtime || 0) - (b.mtime || 0);
                }
                return order === 'desc' ? -comparison : comparison;
            });
        }

        if (source.limit && source.limit > 0) {
            result = result.slice(0, source.limit);
        }

        return result;
    }
}
