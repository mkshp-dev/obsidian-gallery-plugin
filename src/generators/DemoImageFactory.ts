/**
 * Runtime image generation for the local "test lab" showcase.
 *
 * Images are drawn on a canvas instead of being bundled as base64 so the demo
 * can cover many sizes, aspect ratios, and formats without bloating main.js.
 * Each image is labelled with its own name, dimensions, and format so layout
 * problems are easy to spot at a glance.
 */

export type DemoImageFormat = 'png' | 'jpeg' | 'webp';

export interface DemoImageSpec {
    /** File name without extension */
    name: string;
    width: number;
    height: number;
    format: DemoImageFormat;
    /** Base hue (0-360) for the background gradient */
    hue: number;
    /** Write the extension in upper case (e.g. .JPG) */
    upperCaseExt?: boolean;
}

export interface DemoImageFile {
    fileName: string;
    data: ArrayBuffer;
}

const MIME_TO_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
};

/** 240x160 animated GIF (canvas cannot encode GIFs) */
export const ANIMATED_GIF_BASE64 = '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';

/**
 * Draw a labelled test image and encode it. Returns null when canvas
 * rendering is unavailable in the current environment.
 */
export async function renderDemoImage(spec: DemoImageSpec): Promise<DemoImageFile | null> {
    const canvas = activeDocument.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { width: w, height: h, hue } = spec;

    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, `hsl(${hue}, 65%, 55%)`);
    gradient.addColorStop(1, `hsl(${(hue + 50) % 360}, 70%, 35%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Corner markers make cropping (object-fit: cover) obvious
    const marker = Math.max(4, Math.round(Math.min(w, h) * 0.08));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, marker, marker);
    ctx.fillRect(w - marker, 0, marker, marker);
    ctx.fillRect(0, h - marker, marker, marker);
    ctx.fillRect(w - marker, h - marker, marker, marker);

    // Inset border shows whether edges are clipped
    const border = Math.max(1, Math.round(Math.min(w, h) * 0.01));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, w - border, h - border);

    // Centre label
    const lines = Math.min(w, h) >= 120
        ? [spec.name, `${w}×${h}`, spec.format.toUpperCase()]
        : [`${w}×${h}`];
    const fontSize = Math.max(8, Math.round(Math.min(w / 14, h / (lines.length * 2.2))));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.round(fontSize / 4);
    const lineHeight = fontSize * 1.25;
    const top = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, top + i * lineHeight, w * 0.9);
    });

    const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, `image/${spec.format}`, 0.85)
    );
    if (!blob) return null;

    // Some platforms (e.g. iOS) silently fall back to PNG for unsupported
    // encoders, so name the file after what was actually produced.
    let ext = MIME_TO_EXT[blob.type] ?? 'png';
    if (spec.upperCaseExt) ext = ext.toUpperCase();

    return { fileName: `${spec.name}.${ext}`, data: await blob.arrayBuffer() };
}
