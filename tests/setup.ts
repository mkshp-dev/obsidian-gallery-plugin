// Jest setup file for Obsidian plugin testing
import '@testing-library/jest-dom';

// Mock Obsidian API
global.app = {
  vault: {
    adapter: {
      exists: jest.fn(),
      read: jest.fn(),
      list: jest.fn()
    },
    getAbstractFileByPath: jest.fn(),
    getFiles: jest.fn(),
    getMarkdownFiles: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  },
  workspace: {
    on: jest.fn(),
    off: jest.fn()
  }
};

// Mock DOM APIs
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }))
});

// Mock fetch for external URL testing
global.fetch = jest.fn();

// Avoid jsdom's unimplemented canvas getContext from printing noisy errors in tests.
// Return null so code paths that check getContext will fallback cleanly.
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function () { return null; };
} catch (e) {
  // ignore if environment doesn't allow mutation
}