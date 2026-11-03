import { readExifMetadata, parseExifDate, joinMakeModel } from '../../src/utils/ExifReader';
import { extractImmichMetadata } from '../../src/resolvers/ImmichSourceResolver';

type Entry = [tag: number, value: string];

/**
 * Build a TIFF block with ASCII entries in IFD0 and (optionally) an Exif IFD, the way cameras
 * write them. Strings of 4 bytes or fewer are stored inline in the entry.
 */
function buildTiff(ifd0: Entry[], exif: Entry[] = [], little = true): Uint8Array {
    const hasExif = exif.length > 0;
    const ifd0Count = ifd0.length + (hasExif ? 1 : 0);
    const ifd0Size = 2 + ifd0Count * 12 + 4;
    const exifSize = hasExif ? 2 + exif.length * 12 + 4 : 0;
    const strings = [...ifd0, ...exif].map(([, v]) => v + '\0');
    const dataSize = strings.reduce((n, s) => n + (s.length > 4 ? s.length : 0), 0);
    const buf = new Uint8Array(8 + ifd0Size + exifSize + dataSize);
    const view = new DataView(buf.buffer);

    buf[0] = buf[1] = little ? 0x49 : 0x4d;
    view.setUint16(2, 42, little);
    view.setUint32(4, 8, little);

    let dataOffset = 8 + ifd0Size + exifSize;
    const writeIfd = (offset: number, entries: Entry[], exifPointer?: number) => {
        const all: Array<[number, string | number]> = [...entries];
        if (exifPointer !== undefined) all.push([0x8769, exifPointer]);
        all.sort((a, b) => a[0] - b[0]);
        view.setUint16(offset, all.length, little);
        all.forEach(([tag, value], i) => {
            const e = offset + 2 + i * 12;
            view.setUint16(e, tag, little);
            if (typeof value === 'number') {
                view.setUint16(e + 2, 4, little);
                view.setUint32(e + 4, 1, little);
                view.setUint32(e + 8, value, little);
                return;
            }
            const str = value + '\0';
            view.setUint16(e + 2, 2, little);
            view.setUint32(e + 4, str.length, little);
            const target = str.length > 4 ? dataOffset : e + 8;
            if (str.length > 4) {
                view.setUint32(e + 8, dataOffset, little);
                dataOffset += str.length;
            }
            for (let j = 0; j < str.length; j++) buf[target + j] = str.charCodeAt(j);
        });
    };
    writeIfd(8, ifd0, hasExif ? 8 + ifd0Size : undefined);
    if (hasExif) writeIfd(8 + ifd0Size, exif);
    return buf;
}

function jpegWith(tiff: Uint8Array): Uint8Array {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]; // a small APP0 before APP1, as most files have
    const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    const size = 2 + header.length + tiff.length;
    return new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xe1, size >> 8, size & 0xff, ...header, ...tiff, 0xff, 0xda, 0x00, 0x02]);
}

const ascii = (s: string) => Array.from(s, c => c.charCodeAt(0));
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number) => u32be(n).reverse();

const CAMERA_TIFF = buildTiff(
    [[0x010f, 'Canon'], [0x0110, 'Canon EOS R5'], [0x0132, '2024:07:20 09:00:00']],
    [[0x9003, '2024:07:14 18:32:05'], [0xa434, 'RF24-105mm F4 L IS USM']]
);

describe('readExifMetadata', () => {
    test('reads the date taken, camera and lens from a JPEG', () => {
        const meta = readExifMetadata(jpegWith(CAMERA_TIFF));
        expect(meta.takenAt).toEqual(new Date(2024, 6, 14, 18, 32, 5));
        expect(meta.camera).toBe('Canon EOS R5');
        expect(meta.lens).toBe('RF24-105mm F4 L IS USM');
    });

    test('reads big-endian (Motorola) EXIF and joins a maker the model leaves out', () => {
        const tiff = buildTiff([[0x010f, 'FUJIFILM'], [0x0110, 'X-T4']], [], false);
        expect(readExifMetadata(jpegWith(tiff))).toEqual({ camera: 'FUJIFILM X-T4' });
    });

    test('falls back to the file date when there is no original date', () => {
        const tiff = buildTiff([[0x0132, '2023:01:02 03:04:05']]);
        expect(readExifMetadata(jpegWith(tiff)).takenAt).toEqual(new Date(2023, 0, 2, 3, 4, 5));
    });

    test('reads PNG eXIf and WebP EXIF chunks', () => {
        const png = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ...u32be(CAMERA_TIFF.length), ...ascii('eXIf'), ...CAMERA_TIFF, 0, 0, 0, 0
        ]);
        expect(readExifMetadata(png).camera).toBe('Canon EOS R5');

        const chunk = [...ascii('Exif'), 0, 0, ...CAMERA_TIFF];
        const webp = new Uint8Array([
            ...ascii('RIFF'), ...u32le(4 + 8 + chunk.length), ...ascii('WEBP'),
            ...ascii('EXIF'), ...u32le(chunk.length), ...chunk
        ]);
        expect(readExifMetadata(webp).lens).toBe('RF24-105mm F4 L IS USM');
    });

    test('a photo without EXIF, a GIF, garbage or a truncated file gives no details', () => {
        expect(readExifMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toEqual({});
        expect(readExifMetadata(new Uint8Array(ascii('GIF89a')))).toEqual({});
        expect(readExifMetadata(new Uint8Array([1, 2, 3]))).toEqual({});
        expect(readExifMetadata(new Uint8Array(0))).toEqual({});
        const full = jpegWith(CAMERA_TIFF);
        for (const cut of [4, 12, 20, 40, 80, full.length - 30]) {
            expect(() => readExifMetadata(full.slice(0, cut))).not.toThrow();
        }
    });

    test('a placeholder date is ignored while the other fields are kept', () => {
        const tiff = buildTiff([[0x0110, 'Pixel 8']], [[0x9003, '0000:00:00 00:00:00']]);
        expect(readExifMetadata(jpegWith(tiff))).toEqual({ camera: 'Pixel 8' });
    });
});

describe('EXIF helpers', () => {
    test('parseExifDate accepts EXIF and ISO forms, rejects blanks', () => {
        expect(parseExifDate('2024:07:14 18:32:05')).toEqual(new Date(2024, 6, 14, 18, 32, 5));
        expect(parseExifDate('2024-07-14T18:32:05.000Z')).toEqual(new Date(2024, 6, 14, 18, 32, 5));
        expect(parseExifDate('    :  :     :  :  ')).toBeUndefined();
        expect(parseExifDate(undefined)).toBeUndefined();
    });

    test('joinMakeModel does not repeat the maker', () => {
        expect(joinMakeModel('NIKON CORPORATION', 'NIKON D750')).toBe('NIKON D750');
        expect(joinMakeModel('Apple', 'iPhone 15 Pro')).toBe('Apple iPhone 15 Pro');
        expect(joinMakeModel('Sony', undefined)).toBe('Sony');
        expect(joinMakeModel(undefined, undefined)).toBeUndefined();
    });
});

describe('extractImmichMetadata', () => {
    test('maps Immich EXIF info to the date taken, camera and lens', () => {
        const meta = extractImmichMetadata({
            id: 'a',
            localDateTime: '2024-07-14T18:32:05.000Z',
            exifInfo: { make: 'Apple', model: 'iPhone 15 Pro', lensModel: 'iPhone 15 Pro back camera 6.765mm f/1.78' }
        });
        expect(meta).toEqual({
            takenAt: new Date(2024, 6, 14, 18, 32, 5),
            camera: 'Apple iPhone 15 Pro',
            lens: 'iPhone 15 Pro back camera 6.765mm f/1.78'
        });
    });

    test('leaves out missing fields and gives undefined when there are none', () => {
        expect(extractImmichMetadata({ id: 'a', exifInfo: { model: 'X100V', make: null } })).toEqual({ camera: 'X100V' });
        expect(extractImmichMetadata({ id: 'a', exifInfo: { dateTimeOriginal: 'not a date' } })).toBeUndefined();
        expect(extractImmichMetadata({ id: 'a' })).toBeUndefined();
        expect(extractImmichMetadata(undefined)).toBeUndefined();
    });
});
