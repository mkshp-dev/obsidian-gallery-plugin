/**
 * File types galleries can show, and small helpers shared by the scanners, the image source
 * model and the views.
 */

export type MediaType = 'image' | 'video';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];

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

export function isSvgPath(path: string): boolean {
    return extensionOf(path) === '.svg';
}

/** Largest SVG read to find its size; bigger ones are measured by the browser instead */
export const SVG_SIZE_READ_MAX_BYTES = 1024 * 1024;

/**
 * An SVG's size from its root element: width and height in px (plain numbers or px), else the
 * viewBox. SVGs with only a viewBox have no natural size in an <img>, so layouts use this for
 * their shape. Percentages and other units fall back to the viewBox; undefined when neither works.
 */
export function readSvgSize(text: string): { width: number; height: number } | undefined {
    const root = /<svg\b[^>]*>/i.exec(text)?.[0];
    if (!root) return undefined;
    const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1]?.trim();
    const px = (value: string | undefined) => {
        const match = value ? /^(\d+(?:\.\d+)?)(px)?$/i.exec(value) : null;
        const n = match ? Number(match[1]) : NaN;
        return n > 0 ? n : undefined;
    };
    const width = px(attr('width'));
    const height = px(attr('height'));
    if (width && height) return { width, height };
    const box = attr('viewBox')?.split(/[\s,]+/).map(Number);
    if (box && box.length === 4 && box[2] > 0 && box[3] > 0) {
        // One of width/height given: keep it and take the other from the viewBox's shape
        if (width) return { width, height: width * box[3] / box[2] };
        if (height) return { width: height * box[2] / box[3], height };
        return { width: box[2], height: box[3] };
    }
    return undefined;
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

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];

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

/**
 * Photo and video formats galleries can't show, by extension, with the name used in the note
 * under a gallery that skipped them. Other files (notes, PDFs, ...) are skipped silently: only
 * files that look like they belong in a gallery are mentioned.
 */
const UNSUPPORTED_MEDIA: Record<string, string> = {
    '.heic': 'HEIC', '.heif': 'HEIC',
    '.tif': 'TIFF', '.tiff': 'TIFF',
    '.bmp': 'BMP', '.ico': 'ICO', '.jxl': 'JPEG XL', '.psd': 'PSD',
    '.dng': 'RAW', '.cr2': 'RAW', '.cr3': 'RAW', '.nef': 'RAW', '.arw': 'RAW', '.orf': 'RAW',
    '.rw2': 'RAW', '.raf': 'RAW', '.raw': 'RAW', '.srw': 'RAW', '.pef': 'RAW',
    '.avi': 'AVI', '.mkv': 'MKV', '.wmv': 'WMV', '.flv': 'FLV', '.3gp': '3GP',
    '.mts': 'MTS', '.m2ts': 'MTS', '.mpg': 'MPEG', '.mpeg': 'MPEG'
};

/**
 * Whether a file in a server listing was left out for its format, and so belongs in the
 * skipped-files note: an image type galleries can't show, or a photo/video extension from the
 * list above. With a mimeTypes filter, only types the filter asks for count.
 */
export function isSkippedListing(contentType: string | undefined, name: string, filter?: string[]): boolean {
    if (acceptsMimeType(contentType, filter)) return false;
    const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/') && !unsupportedMediaFormat(name)) return false;
    if (!filter || filter.length === 0) return true;
    const wanted = filter.map(entry => entry.trim().toLowerCase());
    return wanted.includes(type) || wanted.includes(`${type.split('/')[0]}/*`);
}

/** The format name of a photo or video file galleries can't show; undefined for anything else */
export function unsupportedMediaFormat(name: string): string | undefined {
    return UNSUPPORTED_MEDIA[extensionOf(name)];
}

/**
 * The note shown under a gallery that skipped files, e.g. "3 files weren't shown: HEIC and RAW
 * aren't supported." Formats are listed most common first. Undefined when nothing was skipped.
 */
export function skippedFilesNote(names: string[]): string | undefined {
    if (names.length === 0) return undefined;
    const counts = new Map<string, number>();
    for (const name of names) {
        const format = unsupportedMediaFormat(name) ?? (extensionOf(name).slice(1).toUpperCase() || 'Unknown');
        counts.set(format, (counts.get(format) ?? 0) + 1);
    }
    const formats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([format]) => format);
    const list = formats.length === 1 ? formats[0] : `${formats.slice(0, -1).join(', ')} and ${formats[formats.length - 1]}`;
    const files = names.length === 1 ? "1 file wasn't shown" : `${names.length} files weren't shown`;
    return `${files}: ${list} ${formats.length === 1 ? "isn't" : "aren't"} supported.`;
}
