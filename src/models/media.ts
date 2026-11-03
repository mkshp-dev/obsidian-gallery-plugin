/**
 * File types galleries can show, and small helpers shared by the scanners, the image source
 * model and the views.
 */

export type MediaType = 'image' | 'video';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/** Videos the browser engine in Obsidian plays (mov and m4v play when they hold H.264/AAC) */
export const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.webm', '.mov', '.ogv'];

export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

/** Lower-case extension with its dot (".mp4"), ignoring any query string or fragment; '' when none */
export function extensionOf(path: string): string {
    let clean = path;
    const q = clean.indexOf('?');
    if (q !== -1) clean = clean.substring(0, q);
    const h = clean.indexOf('#');
    if (h !== -1) clean = clean.substring(0, h);
    const slash = clean.lastIndexOf('/');
    const dot = clean.lastIndexOf('.');
    return dot === -1 || dot < slash ? '' : clean.substring(dot).toLowerCase();
}

export function isVideoPath(path: string): boolean {
    return VIDEO_EXTENSIONS.includes(extensionOf(path));
}

export function isMediaPath(path: string): boolean {
    return MEDIA_EXTENSIONS.includes(extensionOf(path));
}

/** "0:12", "4:05", "1:02:03"; undefined for a missing or invalid duration */
export function formatDuration(seconds: number | undefined): string | undefined {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return undefined;
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Immich durations look like "0:00:12.345000" (h:mm:ss.ffffff); returns seconds, or undefined */
export function parseClockDuration(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    const match = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(value.trim());
    if (!match) return undefined;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Number.isFinite(seconds) ? seconds : undefined;
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Video types servers report for the extensions above */
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/x-m4v', 'video/webm', 'video/quicktime', 'video/ogg'];

export function isVideoMimeType(contentType: string | undefined): boolean {
    return !!contentType && VIDEO_MIME_TYPES.includes(contentType.split(';')[0].trim().toLowerCase());
}

/**
 * The image and video types a listing keeps: all of them, or those in the source's
 * `filters.mimeTypes` (so `mimeTypes: [video/mp4]` lists only MP4 videos). `image/*` and
 * `video/*` stand for every type of that kind.
 */
export function allowedMimeTypes(filter?: string[]): string[] {
    const all = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];
    if (!filter || filter.length === 0) return all;
    const wanted = filter.map(type => type.toLowerCase());
    return all.filter(type => wanted.includes(type) || wanted.includes(`${type.split('/')[0]}/*`));
}
