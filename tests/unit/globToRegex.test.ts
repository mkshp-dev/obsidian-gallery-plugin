import { globToRegex } from '../../src/utils/globToRegex';

describe('globToRegex', () => {
    it('should correctly transform and match *.jpg', () => {
        const regex = globToRegex('*.jpg');
        expect(regex.test('image.jpg')).toBe(true);
        expect(regex.test('image.JPG')).toBe(true);
        expect(regex.test('test.png')).toBe(false);
    });

    it('should correctly transform and match *.{jpg,jpeg}', () => {
        const regex = globToRegex('*.{jpg,jpeg}');
        expect(regex.test('image.jpg')).toBe(true);
        expect(regex.test('IMG_123.jpeg')).toBe(true);
        expect(regex.test('image.png')).toBe(false);
    });

    it('should correctly handle ? wildcard', () => {
        const regex = globToRegex('img_?.jpg');
        expect(regex.test('img_1.jpg')).toBe(true);
        expect(regex.test('img_a.jpg')).toBe(true);
        expect(regex.test('img_12.jpg')).toBe(false);
    });

    it('should escape special regex characters', () => {
        const regex = globToRegex('image (1).jpg');
        expect(regex.test('image (1).jpg')).toBe(true);
        expect(regex.test('image 11.jpg')).toBe(false);
    });
});
