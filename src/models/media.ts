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

/** Clock durations look like "0:00:12.345000" (h:mm:ss.ffffff); returns seconds, or undefined */
export function parseClockDuration(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    const match = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(value.trim());
    if (!match) return undefined;
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * An Immich asset's duration in seconds. Immich 3 sends milliseconds as a number (52208);
 * older versions send a clock string ("0:00:52.208000"). Photos send null or 0: undefined.
 */
export function parseImmichDuration(value: unknown): number | undefined {
    const seconds = typeof value === 'number' ? value / 1000 : parseClockDuration(value);
    return seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Video types servers report for the extensions above */
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/x-m4v', 'video/webm', 'video/quicktime', 'video/ogg'];

/** The type without parameters, lower-cased ("video/mp4; codecs=avc1" is "video/mp4") */
function baseMimeType(contentType: string): string {
    return contentType.split(';')[0].trim().toLowerCase();
}

/** Any video type; one the player can't decode gets the viewer's "can't play" notice */
export function isVideoMimeType(contentType: string | undefined): boolean {
    return !!contentType && baseMimeType(contentType).startsWith('video/');
}

/**
 * Whether a listing keeps a file of this type: the supported image types and any video type,
 * narrowed by the source's `filters.mimeTypes` when it has one (so `mimeTypes: [video/mp4]`
 * keeps only MP4 videos). `image/*` and `video/*` in the filter stand for every type of that kind.
 */
export function acceptsMimeType(contentType: string | undefined, filter?: string[]): boolean {
    if (!contentType) return false;
    const type = baseMimeType(contentType);
    if (!IMAGE_MIME_TYPES.includes(type) && !type.startsWith('video/')) return false;
    if (!filter || filter.length === 0) return true;
    const wanted = filter.map(entry => entry.trim().toLowerCase());
    return wanted.includes(type) || wanted.includes(`${type.split('/')[0]}/*`);
}

/** A WebDAV/HTTP date ("Sat, 21 Feb 2026 12:15:00 GMT") as ms since the epoch; undefined if invalid */
export function parseHttpDate(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? undefined : ms;
}
