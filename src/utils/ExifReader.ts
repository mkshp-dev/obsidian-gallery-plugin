import type { IImageMetadata } from '../models/interfaces';

/**
 * Minimal EXIF reader for the image viewer's Details panel: the date a photo was taken, the
 * camera and the lens. Reads JPEG (APP1), PNG (eXIf) and WebP (EXIF chunk). Never throws: a
 * missing, truncated or malformed block gives an empty result, and each field is read on its own,
 * so one bad entry doesn't hide the others.
 */

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_LENS_MAKE = 0xa433;
const TAG_LENS_MODEL = 0xa434;

/** Most cameras put EXIF in the first few kilobytes; never scan further than this for it */
const MAX_SCAN_BYTES = 512 * 1024;

export function readExifMetadata(buffer: ArrayBuffer | Uint8Array): IImageMetadata {
    try {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const tiff = findTiffBlock(bytes);
        if (!tiff) return {};
        return parseTiff(new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength));
    } catch {
        return {};
    }
}

/** Locate the TIFF structure (starting at the "II"/"MM" byte order mark) inside an image file */
function findTiffBlock(bytes: Uint8Array): Uint8Array | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const len = Math.min(bytes.length, MAX_SCAN_BYTES);

    // JPEG: walk the markers up to the image data, looking for APP1 "Exif\0\0"
    if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let offset = 2;
        while (offset + 4 <= len) {
            if (bytes[offset] !== 0xff) return null;
            const marker = bytes[offset + 1];
            if (marker === 0xff) { offset++; continue; } // fill byte
            if (marker === 0xda || marker === 0xd9) return null; // image data or end: no EXIF
            const size = view.getUint16(offset + 2);
            if (size < 2) return null;
            const start = offset + 4;
            const end = Math.min(offset + 2 + size, bytes.length);
            if (marker === 0xe1 && end - start > 6 && isExifHeader(bytes, start)) {
                return bytes.subarray(start + 6, end);
            }
            offset += 2 + size;
        }
        return null;
    }

    // PNG: chunks of length, type, data, CRC; EXIF is in "eXIf"
    if (len >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        let offset = 8;
        while (offset + 8 <= bytes.length) {
            const size = view.getUint32(offset);
            const type = ascii(bytes, offset + 4, 4);
            const start = offset + 8;
            if (type === 'eXIf') return bytes.subarray(start, Math.min(start + size, bytes.length));
            if (type === 'IDAT' || type === 'IEND') return null;
            offset = start + size + 4;
        }
        return null;
    }

    // WebP: RIFF container with an "EXIF" chunk (some writers keep the "Exif\0\0" header)
    if (len >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
        let offset = 12;
        while (offset + 8 <= bytes.length) {
            const type = ascii(bytes, offset, 4);
            const size = view.getUint32(offset + 4, true);
            const start = offset + 8;
            if (type === 'EXIF') {
                const end = Math.min(start + size, bytes.length);
                return isExifHeader(bytes, start) ? bytes.subarray(start + 6, end) : bytes.subarray(start, end);
            }
            offset = start + size + (size % 2);
        }
        return null;
    }

    return null;
}

function isExifHeader(bytes: Uint8Array, offset: number): boolean {
    return ascii(bytes, offset, 4) === 'Exif' && bytes[offset + 4] === 0 && bytes[offset + 5] === 0;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
    let out = '';
    for (let i = 0; i < length && offset + i < bytes.length; i++) out += String.fromCharCode(bytes[offset + i]);
    return out;
}

type Entries = Map<number, string | number>;

function parseTiff(view: DataView): IImageMetadata {
    if (view.byteLength < 8) return {};
    const order = view.getUint16(0);
    if (order !== 0x4949 && order !== 0x4d4d) return {};
    const little = order === 0x4949;
    if (view.getUint16(2, little) !== 42) return {};

    const ifd0 = readIfd(view, view.getUint32(4, little), little);
    const exifOffset = ifd0.get(TAG_EXIF_IFD);
    const exif = typeof exifOffset === 'number' ? readIfd(view, exifOffset, little) : new Map() as Entries;

    const text = (entries: Entries, tag: number): string | undefined => {
        const value = entries.get(tag);
        return typeof value === 'string' && value ? value : undefined;
    };

    const takenAt = parseExifDate(text(exif, TAG_DATETIME_ORIGINAL))
        ?? parseExifDate(text(exif, TAG_DATETIME_DIGITIZED))
        ?? parseExifDate(text(ifd0, TAG_DATETIME));

    const metadata: IImageMetadata = {};
    if (takenAt) metadata.takenAt = takenAt;
    const camera = joinMakeModel(text(ifd0, TAG_MAKE), text(ifd0, TAG_MODEL));
    if (camera) metadata.camera = camera;
    const lens = joinMakeModel(text(exif, TAG_LENS_MAKE), text(exif, TAG_LENS_MODEL), true);
    if (lens) metadata.lens = lens;
    return metadata;
}

/**
 * Read the ASCII entries of one IFD, plus the Exif IFD pointer. Entries that point outside the
 * block are skipped.
 */
function readIfd(view: DataView, offset: number, little: boolean): Entries {
    const entries: Entries = new Map();
    if (offset <= 0 || offset + 2 > view.byteLength) return entries;
    const count = view.getUint16(offset, little);
    for (let i = 0; i < count; i++) {
        const entry = offset + 2 + i * 12;
        if (entry + 12 > view.byteLength) break;
        try {
            const tag = view.getUint16(entry, little);
            const type = view.getUint16(entry + 2, little);
            const n = view.getUint32(entry + 4, little);
            if (tag === TAG_EXIF_IFD && (type === 4 || type === 13)) {
                entries.set(tag, view.getUint32(entry + 8, little));
            } else if (type === 2 && n > 0) {
                const start = n <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
                if (start + n > view.byteLength) continue;
                let value = '';
                for (let j = 0; j < n; j++) {
                    const c = view.getUint8(start + j);
                    if (c === 0) break;
                    value += String.fromCharCode(c);
                }
                const cleaned = value.replace(/[^\x20-\x7e\u00a1-\u00ff]/g, '').trim();
                if (cleaned) entries.set(tag, cleaned);
            }
        } catch {
            // A bad entry is skipped; the rest of the IFD is still read
        }
    }
    return entries;
}

/**
 * Parse an EXIF date ("2024:07:14 18:32:05"). EXIF dates have no time zone, so the result is a
 * local Date holding the camera's wall-clock time, which is what the photographer saw.
 * Placeholder dates ("0000:00:00 00:00:00", blanks) give undefined.
 */
export function parseExifDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
    if (!match) return undefined;
    const [year, month, day, hour, minute, second] = match.slice(1).map(part => (part === undefined ? 0 : Number(part)));
    if (year < 1800 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 60) return undefined;
    const date = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Combine a maker and a model without repeating the maker ("Canon" + "Canon EOS R5" is
 * "Canon EOS R5"). Lenses are named by model alone when it has one.
 */
export function joinMakeModel(make: string | undefined, model: string | undefined, modelOnly = false): string | undefined {
    const mk = make?.trim();
    const md = model?.trim();
    if (!md) return mk || undefined;
    if (!mk || modelOnly) return md;
    const firstWord = mk.split(/\s+/)[0].toLowerCase();
    return md.toLowerCase().startsWith(firstWord) ? md : `${mk} ${md}`;
}
