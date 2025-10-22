/**
 * Basic test to verify utilities are working
 */

import { FileSizeValidator } from '../src/utils/FileSizeValidator';
import { ImageValidator } from '../src/utils/ImageValidator';
import { LazyLoader } from '../src/utils/LazyLoader';

describe('Gallery Plugin Utilities', () => {
  describe('FileSizeValidator', () => {
    test('should validate file size correctly', () => {
      const maxSize = FileSizeValidator.getMaxFileSize();
      expect(maxSize).toBe(50 * 1024 * 1024); // 50MB
      
      expect(FileSizeValidator.isFileSizeValid(1024)).toBe(true);
      expect(FileSizeValidator.isFileSizeValid(maxSize + 1)).toBe(false);
    });

    test('should format file size correctly', () => {
      expect(FileSizeValidator.formatFileSize(1024)).toBe('1 KB');
      expect(FileSizeValidator.formatFileSize(1048576)).toBe('1 MB');
    });
  });

  describe('ImageValidator', () => {
    test('should validate image extensions', () => {
      expect(ImageValidator.isValidExtension('test.jpg')).toBe(true);
      expect(ImageValidator.isValidExtension('test.png')).toBe(true);
      expect(ImageValidator.isValidExtension('test.txt')).toBe(false);
    });

    test('should validate MIME types', () => {
      expect(ImageValidator.isValidMimeType('image/jpeg')).toBe(true);
      expect(ImageValidator.isValidMimeType('image/png')).toBe(true);
      expect(ImageValidator.isValidMimeType('text/plain')).toBe(false);
    });

    test('should validate image URLs', () => {
      const validUrl = ImageValidator.validateImageUrl('https://example.com/image.jpg');
      expect(validUrl.isValid).toBe(true);
      expect(validUrl.isExternal).toBe(true);

      const invalidUrl = ImageValidator.validateImageUrl('not-a-url');
      expect(invalidUrl.isValid).toBe(false);
    });
  });

  describe('LazyLoader', () => {
    test('should check IntersectionObserver support', () => {
      const isSupported = LazyLoader.isSupported();
      // In jsdom environment, IntersectionObserver might not be available
      expect(typeof isSupported).toBe('boolean');
    });

    test('should create placeholder data URL', () => {
      const placeholder = LazyLoader.createPlaceholderDataUrl(100, 100);
      expect(placeholder).toMatch(/^data:image\/png;base64,/);
    });
  });
});