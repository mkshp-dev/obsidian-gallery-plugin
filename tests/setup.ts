// Jest setup file for Obsidian plugin testing
import '@testing-library/jest-dom';

// Export mock factory for test consumption
export const createMockMarkdownPostProcessorContext = () => ({
  docId: 'mock-doc-id',
  sourcePath: 'mock/source/path.md',
  frontmatter: null,
  addChild: jest.fn(),
  getSectionInfo: jest.fn().mockReturnValue(null)
});

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

global.activeDocument = global.document;

// Mock instanceOf helper for Node and UIEvent cross-window checks in JSDOM tests
if (typeof Node !== 'undefined' && !Node.prototype.instanceOf) {
  Node.prototype.instanceOf = function (type: any) {
    return this instanceof type;
  };
}
if (typeof UIEvent !== 'undefined' && !UIEvent.prototype.instanceOf) {
  UIEvent.prototype.instanceOf = function (type: any) {
    return this instanceof type;
  };
}

// Mock Obsidian MarkdownRenderChild
jest.mock('obsidian', () => ({
  EditorSuggest: class MockEditorSuggest { constructor() {} },
  PopoverSuggest: class MockPopoverSuggest { constructor() {} },
  MarkdownRenderChild: class MockMarkdownRenderChild {
    containerEl: HTMLElement;
    constructor(containerEl: HTMLElement) {
      this.containerEl = containerEl;
    }
    onload() {}
    onunload() {}
  },
  Notice: class MockNotice {},
  Plugin: class MockPlugin {},
  PluginSettingTab: class MockPluginSettingTab {},
  Setting: class MockSetting {},
  requestUrl: jest.fn(),
  parseYaml: jest.fn().mockImplementation((yamlStr: string) => {
    const jsyaml = require('js-yaml');
    try {
        return jsyaml.load(yamlStr);
    } catch (e) {
        throw new Error('YAML parsing error');
    }
  }),
}));
