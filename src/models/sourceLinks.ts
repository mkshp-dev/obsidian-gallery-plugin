import type { IImageSource, SourceType } from './interfaces';

/** The service a photo comes from, for labels such as "Open in Immich"; empty for the vault and plain URLs */
export function sourceServiceName(type: SourceType): string {
    if (type.startsWith('nextcloud')) return 'Nextcloud';
    if (type.startsWith('immich')) return 'Immich';
    return '';
}

/** The web page for a photo that isn't in the vault: its page at the source, or an external photo's own URL */
export function remoteImageLink(image: IImageSource): string | undefined {
    if (image.type === 'local') return undefined;
    if (image.openUrl) return image.openUrl;
    if (image.type === 'external' && /^https?:\/\//i.test(image.path)) return image.path;
    return undefined;
}
