// Jest setup file for Obsidian plugin testing
import 'jest-dom/extend-expect';

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