# Gallery Plugin API Contracts

**Created**: 2025-10-21  
**Purpose**: Define interfaces and contracts for gallery plugin components

## Core Interfaces

### IGalleryConfig

Configuration interface for gallery code blocks.

```typescript
interface IGalleryConfig {
  /** Target folder or file path */
  path: string;
  
  /** Display view type */
  view?: 'thumbnail' | 'carousel' | 'grid';
  
  /** Include subdirectories (default: true) */
  recursive?: boolean;
}
```

**Validation Contract**:
- `path` is required and non-empty
- `path` must not contain directory traversal patterns (`../`, `..\\`)
- `view` defaults to 'thumbnail' if not specified
- `recursive` defaults to true if not specified

### IImageSource

Interface for individual image sources.

```typescript
interface IImageSource {
  /** Full path or URL to image */
  path: string;
  
  /** Source type */
  type: 'local' | 'external';
  
  /** Display name for user */
  displayName: string;
  
  /** File size in bytes (local files only) */
  size?: number;
  
  /** Image dimensions when available */
  dimensions?: {
    width: number;
    height: number;
  };
  
  /** Current loading state */
  loadState: 'pending' | 'loading' | 'loaded' | 'error';
  
  /** Error message if loading failed */
  errorMessage?: string;
  
  /** Loading timestamp for timeout tracking */
  loadStartTime?: number;
}
```

**State Contract**:
- Initial state is always 'pending'
- External images have 10-second timeout limit
- Local images check file existence before loading
- Error state includes descriptive message

### IGalleryView

Interface for gallery view renderers.

```typescript
interface IGalleryView {
  /** View type identifier */
  readonly type: 'thumbnail' | 'carousel' | 'grid';
  
  /** DOM container element */
  readonly container: HTMLElement;
  
  /** Current images being displayed */
  readonly images: IImageSource[];
  
  /** Render initial gallery */
  render(): void;
  
  /** Update with new image list */
  update(images: IImageSource[]): void;
  
  /** Clean up resources */
  destroy(): void;
  
  /** Handle successful image load */
  handleImageLoad(image: IImageSource): void;
  
  /** Handle image load error */
  handleImageError(image: IImageSource, error: Error): void;
  
  /** Check if image is in viewport (for lazy loading) */
  isImageVisible(image: IImageSource): boolean;
}
```

**Rendering Contract**:
- Views must implement lazy loading
- Error states show placeholder with error message
- Loading states show spinner or skeleton
- Views must be responsive and accessible

### IContentScanner

Interface for content discovery and scanning.

```typescript
interface IContentScanner {
  /** Scan path for images */
  scanPath(path: string, recursive: boolean): Promise<IImageSource[]>;
  
  /** Check if file is supported image format */
  isImageFile(path: string): boolean;
  
  /** Extract image links from markdown file */
  extractLinksFromFile(file: TFile): Promise<IImageSource[]>;
  
  /** Validate image source accessibility */
  validateImageSource(source: IImageSource): Promise<boolean>;
  
  /** Clear cache for path */
  invalidateCache(path: string): void;
}
```

**Scanning Contract**:
- Supports JPG, PNG, GIF, WebP formats
- Recursive scanning includes all subdirectories
- File scanning extracts markdown image links and attachments
- Results cached until source changes

### IGalleryPlugin

Main plugin interface.

```typescript
interface IGalleryPlugin extends Plugin {
  /** Register code block processor */
  registerCodeBlockProcessor(): void;
  
  /** Create gallery from config */
  createGallery(config: IGalleryConfig, container: HTMLElement): Promise<IGalleryInstance>;
  
  /** Get content scanner instance */
  getContentScanner(): IContentScanner;
  
  /** Create view renderer */
  createView(type: string, container: HTMLElement): IGalleryView;
}
```

## Error Handling Contracts

### Configuration Errors

```typescript
interface IConfigError {
  type: 'config';
  field: string;
  message: string;
  suggestion?: string;
}
```

**Error Types**:
- `invalid_path`: Path is empty or contains invalid characters
- `invalid_view`: View type not supported
- `path_not_found`: Specified path doesn't exist in vault

### Loading Errors

```typescript
interface ILoadError {
  type: 'load';
  source: IImageSource;
  reason: 'timeout' | 'not_found' | 'invalid_format' | 'network_error' | 'too_large';
  message: string;
  retryable: boolean;
}
```

**Error Types**:
- `timeout`: External URL didn't respond within 10 seconds
- `not_found`: Local file or external URL not found
- `invalid_format`: File format not supported
- `network_error`: Network connectivity issue
- `too_large`: File exceeds 50MB limit

## Performance Contracts

### Lazy Loading

- Images outside viewport remain unloaded
- Loading triggered when image enters viewport
- Maximum 10 concurrent image loads
- Failed loads don't retry automatically

### Memory Management

- Loaded images cached for session duration
- Cache limited to prevent memory overflow
- Large galleries use virtual scrolling
- Cleanup when gallery destroyed

### Timeout Handling

- External URLs timeout after 10 seconds
- One retry attempt after timeout
- Clear error message for timeout failures
- Local files load without timeout

## Event Contracts

### Gallery Events

```typescript
interface IGalleryEvents {
  'gallery:created': { instance: IGalleryInstance };
  'gallery:updated': { instance: IGalleryInstance, changes: string[] };
  'gallery:destroyed': { instanceId: string };
  'image:loaded': { source: IImageSource };
  'image:error': { source: IImageSource, error: ILoadError };
  'view:changed': { instance: IGalleryInstance, newView: string };
}
```

### Vault Events

The plugin listens for vault changes to update galleries:

- `file:created` - Re-scan if in gallery path
- `file:deleted` - Remove from gallery if present
- `file:renamed` - Update gallery references
- `folder:created` - Re-scan if affects gallery
- `folder:deleted` - Clear affected galleries

## Integration Points

### Obsidian Plugin API

- Extends `Plugin` class
- Uses `MarkdownCodeBlockProcessor`
- Integrates with `Vault` API
- Respects `Component` lifecycle

### DOM Integration

- Renders within code block containers
- Uses CSS classes for styling
- Implements accessibility attributes
- Supports keyboard navigation

### Mobile Compatibility

- Touch-friendly interactions
- Responsive layouts
- Performance optimized for mobile
- Gesture support for carousel navigation