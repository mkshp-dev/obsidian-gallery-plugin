import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parsePhotoManifest } from '../../src/generators/SamplePhotos';
import { SAMPLE_PHOTO_COUNT, SAMPLE_PHOTO_MEGABYTES } from '../../src/generators/SamplePhotoSet';

// The photo set published with the docs site, written by scripts/prepare-demo-photos.mjs.
// SAMPLE_PHOTO_DIR points the test at another output folder (for checking a run of the script with --out).
const dir = process.env.SAMPLE_PHOTO_DIR ?? path.join(__dirname, '../../docs-site/static/demo-photos/use-cases');
const manifestPath = path.join(dir, 'manifest.json');
const published = fs.existsSync(manifestPath);

describe('published sample photo set', () => {
    (published ? test : test.skip)('the manifest passes the plugin\'s checks and matches the files', () => {
        const manifest = parsePhotoManifest(fs.readFileSync(manifestPath, 'utf8'));
        for (const photo of manifest.photos) {
            const data = fs.readFileSync(path.join(dir, photo.file));
            expect(data.length).toBe(photo.bytes);
            expect(createHash('sha256').update(data).digest('hex')).toBe(photo.sha256);
        }
    });

    (published && !process.env.SAMPLE_PHOTO_DIR ? test : test.skip)('the consent dialog constants match the manifest', () => {
        const { photos } = parsePhotoManifest(fs.readFileSync(manifestPath, 'utf8'));
        expect(SAMPLE_PHOTO_COUNT).toBe(photos.length);
        expect(SAMPLE_PHOTO_MEGABYTES).toBe(Math.ceil(photos.reduce((sum, p) => sum + p.bytes, 0) / (1024 * 1024)));
    });

    (published ? test.skip : test)('no manifest yet: the consent dialog offers no download', () => {
        expect(SAMPLE_PHOTO_COUNT).toBe(0);
    });
});
