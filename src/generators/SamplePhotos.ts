import { requestUrl } from 'obsidian';
import { Logger } from '../utils/Logger';

/**
 * Real photos for the use-case notes. They are too large to bundle, so they are published with the
 * docs site (docs-site/static/demo-photos/use-cases, written by scripts/prepare-demo-photos.mjs) and
 * downloaded only when the user agrees to it. Keep the host in sync with the README's "Network use"
 * section and docs-site/docs/demo-servers.md.
 */
export const SAMPLE_PHOTOS_HOST = 'docs.mkshp.dev';
export const SAMPLE_PHOTOS_BASE_URL = `https://${SAMPLE_PHOTOS_HOST}/obsidian-gallery-plugin/demo-photos/use-cases/`;

/** Downloads running at once */
const DOWNLOAD_CONCURRENCY = 4;

/** A manifest larger than this is refused rather than downloaded (the published set aims for 15 MB) */
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

export interface SamplePhoto {
    /** Path of the photo under SAMPLE_PHOTOS_BASE_URL */
    file: string;
    /** File name written into the vault; shown as the caption */
    name: string;
    /** Folder the photo goes in, under _photos/ */
    set: string;
    width: number;
    height: number;
    bytes: number;
    /** Lowercase hex SHA-256 of the file */
    sha256: string;
    credit: string;
    source: string;
    license: string;
}

export interface SamplePhotoManifest {
    version: 1;
    photos: SamplePhoto[];
}

export interface PhotoDownloadResult {
    saved: SamplePhoto[];
    failed: SamplePhoto[];
}

const SET_PATTERN = /^[a-z0-9-]+$/;
// A relative path of plain segments: no "..", no leading slash, no backslashes or query strings
const FILE_PATTERN = /^[a-z0-9-]+(\/[a-z0-9._-]+)+$/i;
// Characters Obsidian refuses in file names, or that break wiki links
const UNSAFE_NAME = /[\\/:*?"<>|#^[\]]/;
const IMAGE_NAME = /\.(jpe?g|png|webp)$/i;

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function readPhoto(raw: unknown, index: number): SamplePhoto {
    const where = `photos[${index}]`;
    if (typeof raw !== 'object' || raw === null) throw new Error(`${where} is not an object`);
    const p = raw as Record<string, unknown>;

    for (const key of ['file', 'name', 'set', 'sha256', 'credit', 'source', 'license']) {
        if (typeof p[key] !== 'string' || p[key] === '') throw new Error(`${where}.${key} is missing`);
    }
    for (const key of ['width', 'height', 'bytes']) {
        if (!isPositiveInteger(p[key])) throw new Error(`${where}.${key} must be a positive whole number`);
    }

    const photo = p as unknown as SamplePhoto;
    if (!SET_PATTERN.test(photo.set)) throw new Error(`${where}.set "${photo.set}" may only use a-z, 0-9 and -`);
    if (!FILE_PATTERN.test(photo.file) || photo.file.split('/').includes('..')) {
        throw new Error(`${where}.file "${photo.file}" is not a plain relative path`);
    }
    if (UNSAFE_NAME.test(photo.name) || photo.name.startsWith('.') || !IMAGE_NAME.test(photo.name)) {
        throw new Error(`${where}.name "${photo.name}" is not a safe image file name`);
    }
    if (!/^[0-9a-f]{64}$/.test(photo.sha256)) throw new Error(`${where}.sha256 is not a lowercase hex SHA-256`);

    return {
        file: photo.file, name: photo.name, set: photo.set,
        width: photo.width, height: photo.height, bytes: photo.bytes, sha256: photo.sha256,
        credit: photo.credit, source: photo.source, license: photo.license
    };
}

/**
 * Parse and check a manifest. Throws with the reason when it is not valid JSON, has the wrong
 * version, a photo is missing a field, or a name or path could escape the photo folder.
 */
export function parsePhotoManifest(text: string): SamplePhotoManifest {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        throw new Error('Manifest is not valid JSON');
    }
    if (typeof raw !== 'object' || raw === null) throw new Error('Manifest is not an object');
    const manifest = raw as Record<string, unknown>;
    if (manifest.version !== 1) throw new Error(`Unsupported manifest version: ${String(manifest.version)}`);
    if (!Array.isArray(manifest.photos) || manifest.photos.length === 0) throw new Error('Manifest has no photos');

    const photos = manifest.photos.map(readPhoto);

    const seen = new Set<string>();
    for (const photo of photos) {
        const key = `${photo.set}/${photo.name.toLowerCase()}`;
        if (seen.has(key)) throw new Error(`Two photos are named "${photo.name}" in the ${photo.set} set`);
        seen.add(key);
    }
    const total = photos.reduce((sum, p) => sum + p.bytes, 0);
    if (total > MAX_TOTAL_BYTES) throw new Error(`Manifest lists ${total} bytes, more than the ${MAX_TOTAL_BYTES} allowed`);

    return { version: 1, photos };
}

/** Fetch and parse the published manifest. Throws when offline, blocked, or the manifest is invalid. */
export async function fetchPhotoManifest(): Promise<SamplePhotoManifest> {
    const response = await requestUrl({ url: `${SAMPLE_PHOTOS_BASE_URL}manifest.json`, throw: false });
    if (response.status !== 200) throw new Error(`Manifest request returned HTTP ${response.status}`);
    return parsePhotoManifest(response.text);
}

export function samplePhotoUrl(photo: SamplePhoto): string {
    return SAMPLE_PHOTOS_BASE_URL + photo.file.split('/').map(encodeURIComponent).join('/');
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Download one photo and check it against the manifest. Throws on HTTP errors or a hash mismatch. */
async function downloadPhoto(photo: SamplePhoto): Promise<ArrayBuffer> {
    const response = await requestUrl({ url: samplePhotoUrl(photo), throw: false });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const data = response.arrayBuffer;
    if (await sha256Hex(data) !== photo.sha256) throw new Error('SHA-256 does not match the manifest');
    return data;
}

/**
 * Download `photos` a few at a time and pass each one to `save`. A photo that fails to download,
 * fails the hash check, or fails to save is reported in `failed` and doesn't stop the others.
 */
export async function downloadSamplePhotos(
    photos: SamplePhoto[],
    save: (photo: SamplePhoto, data: ArrayBuffer) => Promise<void>,
    onProgress?: (done: number, total: number) => void
): Promise<PhotoDownloadResult> {
    const result: PhotoDownloadResult = { saved: [], failed: [] };
    let next = 0;
    let done = 0;

    const worker = async () => {
        while (next < photos.length) {
            const photo = photos[next++];
            try {
                await save(photo, await downloadPhoto(photo));
                result.saved.push(photo);
            } catch (error) {
                Logger.warn(`Sample photo ${photo.file} was not downloaded:`, error);
                result.failed.push(photo);
            }
            onProgress?.(++done, photos.length);
        }
    };

    await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, photos.length) }, worker));
    return result;
}
