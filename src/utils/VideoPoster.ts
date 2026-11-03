import { Logger } from './Logger';
import { ObjectUrlManager } from './ObjectUrlManager';
import { Platform, requestUrl } from 'obsidian';

/** What a poster capture found out about a video */
export interface VideoPosterResult {
    /** Image URL of the still frame: an ObjectUrlManager URL, or a placeholder data URL */
    url: string;
    /** Length in seconds, when the video reported one */
    duration?: number;
    width?: number;
    height?: number;
}

/** Reads the whole video file, for when the frame can't be drawn from its URL directly */
export type VideoFileReader = () => Promise<ArrayBuffer | Blob | undefined>;

interface FrameGrab {
    blob: Blob;
    duration?: number;
    width: number;
    height: number;
}

/** Longest side of a poster in px: enough for any tile, small enough to keep many in memory */
const POSTER_MAX_SIZE = 640;
/** Give up on a video that hasn't produced a frame by then */
const CAPTURE_TIMEOUT_MS = 20000;
/** Decoding videos is heavy; only this many are opened at once */
const MAX_CONCURRENT = 2;
/** Largest remote video downloaded just to take its still frame */
export const REMOTE_STILL_MAX_BYTES = 50 * 1024 * 1024;

/** Dark 16:9 stand-in when no frame can be read; the tile's play badge sits on top of it */
export const VIDEO_PLACEHOLDER_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">' +
    '<rect width="320" height="180" fill="#2b2b2b"/></svg>'
);

/**
 * Still frames for video tiles. A gallery shows images, so each video is shown as a JPEG of
 * a frame about a second in (or 10% in, for short clips), drawn on a canvas.
 */
export class VideoPoster {
    private static active = 0;
    private static queue: Array<() => void> = [];
    /** Facts learnt per poster key, for videos whose poster is already cached */
    private static info = new Map<string, Omit<VideoPosterResult, 'url'>>();

    /**
     * Capture a poster for the video at `src`. If the frame can't be read from `src` (a URL the
     * canvas may not read back), `readFile` supplies the bytes instead. Never rejects: when no
     * frame can be had, the placeholder is returned.
     */
    static async capture(src: string, readFile?: VideoFileReader): Promise<VideoPosterResult> {
        const key = `video-poster:${src}`;
        let grabbed: Omit<VideoPosterResult, 'url'> = {};
        try {
            const url = await ObjectUrlManager.getOrCreate(key, async () => {
                const frame = await this.limit(() => this.grabWithFallback(src, readFile));
                grabbed = { duration: frame.duration, width: frame.width, height: frame.height };
                this.info.set(key, grabbed);
                return frame.blob;
            });
            return { url, ...(this.info.get(key) ?? grabbed) };
        } catch (error) {
            Logger.debug('Could not capture a video frame, using a placeholder:', src, error);
            return { url: VIDEO_PLACEHOLDER_URL };
        }
    }

    /**
     * Capture a still frame for a remote video the server has no preview for, by downloading it.
     * Only small videos are downloaded (up to `maxBytes`, and never on phones and tablets, or
     * when the size is unknown); others, and any failure, give the placeholder. Never rejects.
     * @param key Stable identifier of the video, for caching the frame
     */
    static async captureDownloaded(key: string, download: () => Promise<Blob>, sizeBytes: number | undefined, maxBytes = REMOTE_STILL_MAX_BYTES): Promise<VideoPosterResult> {
        if (Platform.isMobile || !sizeBytes || sizeBytes > maxBytes) return { url: VIDEO_PLACEHOLDER_URL };
        const posterKey = `video-poster:${key}`;
        try {
            const url = await ObjectUrlManager.getOrCreate(posterKey, async () => {
                const frame = await this.limit(async () => {
                    const blobUrl = URL.createObjectURL(await download());
                    try {
                        return await this.grabFrame(blobUrl);
                    } finally {
                        URL.revokeObjectURL(blobUrl);
                    }
                });
                this.info.set(posterKey, { duration: frame.duration, width: frame.width, height: frame.height });
                return frame.blob;
            });
            return { url, ...(this.info.get(posterKey) ?? {}) };
        } catch (error) {
            Logger.debug('Could not capture a frame of the downloaded video, using a placeholder:', key, error);
            return { url: VIDEO_PLACEHOLDER_URL };
        }
    }

    private static async grabWithFallback(src: string, readFile?: VideoFileReader): Promise<FrameGrab> {
        try {
            return await this.grabFrame(src);
        } catch (error) {
            if (!readFile) throw error;
            // The URL played but the canvas couldn't read it back (or it didn't load): use the file's bytes
            const data = await readFile();
            if (!data) throw error;
            const blob = data instanceof Blob ? data : new Blob([data]);
            const blobUrl = URL.createObjectURL(blob);
            try {
                return await this.grabFrame(blobUrl);
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }
    }

    /**
     * Capture a still frame for a video on another website. The frame can be read back only when
     * the site allows it (CORS), so that is tried first; otherwise a video up to `maxBytes`
     * (whose size the site reports) is downloaded to take it, except on phones and tablets.
     * Anything else gives the placeholder. Never rejects.
     */
    static async captureExternal(url: string, maxBytes = REMOTE_STILL_MAX_BYTES): Promise<VideoPosterResult> {
        const key = `video-poster:${url}`;
        try {
            const posterUrl = await ObjectUrlManager.getOrCreate(key, async () => {
                const frame = await this.limit(async () => {
                    try {
                        return await this.grabFrame(url, true);
                    } catch (error) {
                        if (Platform.isMobile) throw error;
                        const head = await requestUrl({ url, method: 'HEAD', throw: false });
                        const size = Number(head.headers?.['content-length']);
                        if (head.status >= 400 || !Number.isFinite(size) || size <= 0 || size > maxBytes) throw error;
                        const res = await requestUrl({ url, method: 'GET', throw: false });
                        if (res.status !== 200) throw new Error(`Failed to download the video (HTTP ${res.status})`);
                        const blobUrl = URL.createObjectURL(new Blob([res.arrayBuffer]));
                        try {
                            return await this.grabFrame(blobUrl);
                        } finally {
                            URL.revokeObjectURL(blobUrl);
                        }
                    }
                });
                this.info.set(key, { duration: frame.duration, width: frame.width, height: frame.height });
                return frame.blob;
            });
            return { url: posterUrl, ...(this.info.get(key) ?? {}) };
        } catch (error) {
            Logger.debug('Could not capture a frame of the external video, using a placeholder:', url, error);
            return { url: VIDEO_PLACEHOLDER_URL };
        }
    }

    /**
     * Open the video, seek a little way in, and draw that frame as a JPEG. With `crossOrigin`,
     * the video is requested with CORS, so a frame from another site can be read back if the
     * site allows it.
     */
    static grabFrame(src: string, crossOrigin = false): Promise<FrameGrab> {
        return new Promise<FrameGrab>((resolve, reject) => {
            const video = createEl('video');
            video.muted = true;
            if (crossOrigin) video.crossOrigin = 'anonymous';
            video.playsInline = true;
            // Only the length and size up front; seeking then reads just the part it needs
            video.preload = 'metadata';

            let done = false;
            const finish = (fn: () => void) => {
                if (done) return;
                done = true;
                window.clearTimeout(timer);
                video.onloadedmetadata = null;
                video.onseeked = null;
                video.onerror = null;
                // Let go of the file
                video.removeAttribute('src');
                try { video.load(); } catch { /* not needed for cleanup */ }
                fn();
            };
            const timer = window.setTimeout(() => finish(() => reject(new Error('Timed out reading the video'))), CAPTURE_TIMEOUT_MS);

            video.onerror = () => finish(() => reject(new Error('The video could not be opened')));
            video.onloadedmetadata = () => {
                const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
                // Some players only report "seeked" for a real change of position, so never seek to 0
                video.currentTime = duration ? Math.min(1, duration * 0.1) : 0.001;
            };
            video.onseeked = () => {
                try {
                    const w = video.videoWidth;
                    const h = video.videoHeight;
                    if (!w || !h) throw new Error('The video has no picture');
                    const scale = Math.min(1, POSTER_MAX_SIZE / Math.max(w, h));
                    const canvas = createEl('canvas');
                    canvas.width = Math.max(1, Math.round(w * scale));
                    canvas.height = Math.max(1, Math.round(h * scale));
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('No canvas');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
                    // Throws a SecurityError when the frame came from a URL the page may not read
                    canvas.toBlob(blob => {
                        if (blob) finish(() => resolve({ blob, duration, width: w, height: h }));
                        else finish(() => reject(new Error('Could not encode the frame')));
                    }, 'image/jpeg', 0.82);
                } catch (error) {
                    finish(() => reject(error instanceof Error ? error : new Error(String(error))));
                }
            };
            video.src = src;
        });
    }

    private static limit<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const run = () => {
                this.active++;
                task().then(resolve, reject).finally(() => {
                    this.active--;
                    this.queue.shift()?.();
                });
            };
            if (this.active < MAX_CONCURRENT) run();
            else this.queue.push(run);
        });
    }
}
