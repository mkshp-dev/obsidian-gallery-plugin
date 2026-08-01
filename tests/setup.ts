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
  // @ts-expect-error: jsdom does not implement getContext; assigning null prevents noisy unimplemented errors in tests
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

if (typeof Element !== 'undefined' && !Element.prototype.setCssStyles) {
  Element.prototype.setCssStyles = function (styles: any) {
    Object.assign(this.style, styles);
  };
}

if (typeof Element !== 'undefined') {
  if (!Element.prototype.createEl) {
    Element.prototype.createEl = function (tag: string, o?: any) {
      const el = this.ownerDocument.createElement(tag);
      if (typeof o === 'string') {
        el.className = o;
      } else if (o) {
        if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
        if (o.text !== undefined) el.textContent = String(o.text);
        if (o.attr) {
          Object.entries(o.attr).forEach(([k, v]) => {
            if (v !== null && v !== undefined) el.setAttribute(k, String(v));
          });
        }
        if (o.title) el.title = o.title;
        if (o.value) el.value = o.value;
        if (o.type) el.type = o.type;
        if (o.href) el.href = o.href;
      }
      if (o && o.prepend) {
        this.insertBefore(el, this.firstChild);
      } else {
        this.appendChild(el);
      }
      return el as any;
    };
  }
  if (!Element.prototype.createDiv) {
    Element.prototype.createDiv = function (o?: any) {
      return this.createEl('div', o);
    };
  }
  if (!Element.prototype.createSpan) {
    Element.prototype.createSpan = function (o?: any) {
      return this.createEl('span', o);
    };
  }
  if (!Element.prototype.createSvg) {
    Element.prototype.createSvg = function (tag: string, o?: any) {
      const el = this.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
      if (typeof o === 'string') {
        el.setAttribute('class', o);
      } else if (o) {
        if (o.cls) el.setAttribute('class', Array.isArray(o.cls) ? o.cls.join(' ') : o.cls);
        if (o.attr) {
          Object.entries(o.attr).forEach(([k, v]) => {
            if (v !== null && v !== undefined) el.setAttribute(k, String(v));
          });
        }
      }
      if (o && o.prepend) {
        this.insertBefore(el, this.firstChild);
      } else {
        this.appendChild(el);
      }
      return el as any;
    };
  }
}

if (typeof Document !== 'undefined' && !Document.prototype.createEl) {
  Document.prototype.createEl = function (tag: string, o?: any) {
    const el = this.createElement(tag);
    if (typeof o === 'string') {
      el.className = o;
    } else if (o) {
      if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
      if (o.text !== undefined) el.textContent = String(o.text);
      if (o.attr) {
        Object.entries(o.attr).forEach(([k, v]) => {
          if (v !== null && v !== undefined) el.setAttribute(k, String(v));
        });
      }
    }
    if (o && o.parent) {
      o.parent.appendChild(el);
    }
    return el as any;
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
  Modal: class MockModal {
    app: any;
    contentEl: HTMLElement;
    constructor(app: any) {
      this.app = app;
      this.contentEl = document.createElement('div');
    }
    open() {}
    close() {}
  },
  Notice: jest.fn(),
  Plugin: class MockPlugin {},
  PluginSettingTab: class MockPluginSettingTab {},
  Setting: class MockSetting {},
  requestUrl: jest.fn(),
  parseYaml: jest.fn().mockImplementation((yamlStr: string) => {
    const { parse } = require('yaml');
    try {
        return parse(yamlStr);
    } catch (e) {
        throw new Error('YAML parsing error');
    }
  }),
  TFile: class MockTFile {
    path: string;
    name: string;
    extension: string;
    basename: string;
    parent?: any;
    constructor(path: string, name: string) {
      this.path = path;
      this.name = name;
      const dotIndex = name.lastIndexOf('.');
      this.extension = dotIndex !== -1 ? name.substring(dotIndex) : '';
      this.basename = dotIndex !== -1 ? name.substring(0, dotIndex) : name;
    }
  },
  TFolder: class MockTFolder {
    path: string;
    name: string;
    parent?: any;
    children: any[];
    constructor(path: string, name: string = '') {
      this.path = path;
      this.name = name;
      this.children = [];
    }
  },
}));
