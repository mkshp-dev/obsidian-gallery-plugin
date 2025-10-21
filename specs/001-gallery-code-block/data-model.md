# Data Model: Gallery Code Block

**Created**: 2025-10-21  
**Purpose**: Define core entities and their relationships for the gallery plugin

## Core Entities

### GalleryConfig

Represents the configuration parsed from code block parameters.

**Fields**:
- `path: string` - Target folder or file path (required)
- `view: 'thumbnail' | 'carousel' | 'grid'` - Display mode (default: 'thumbnail')
- `recursive?: boolean` - Include subdirectories (default: true, derived from clarifications)

**Validation Rules**:
- `path` must be non-empty string
- `path` must be valid vault path (no directory traversal)
- `view` must be one of allowed values
- Invalid configurations show error state

**State Transitions**:
- Created from YAML parsing
- Validated before gallery rendering
- Immutable once validated

### ImageSource

Represents an individual image within a gallery.

**Fields**:
- `path: string` - Full path to image (local or URL)
- `type: 'local' | 'external'` - Source type
- `displayName: string` - Name shown to user
- `size?: number` - File size in bytes (for local files)
- `dimensions?: { width: number, height: number }` - Image dimensions
- `loadState: 'pending' | 'loading' | 'loaded' | 'error'` - Loading status
- `errorMessage?: string` - Error details if load fails

**Validation Rules**:
- Local paths must exist in vault
- External URLs must be valid HTTP/HTTPS
- File size must not exceed 50MB limit
- Supported formats: JPG, PNG, GIF, WebP

**State Transitions**:
- pending → loading (when image enters viewport)
- loading → loaded (successful load)
- loading → error (load failure, timeout)
- error → loading (retry attempt)

### GalleryInstance

Represents a rendered gallery within a markdown document.

**Fields**:
- `id: string` - Unique identifier for this gallery
- `config: GalleryConfig` - Gallery configuration
- `images: ImageSource[]` - List of images to display
- `container: HTMLElement` - DOM container element
- `view: GalleryView` - Current view renderer
- `loadedCount: number` - Number of successfully loaded images
- `errorCount: number` - Number of failed image loads

**Relationships**:
- Contains one GalleryConfig
- Contains multiple ImageSource entities
- References one active GalleryView

**Lifecycle**:
1. Created from code block processing
2. Config validated and images discovered
3. View renderer instantiated
4. Images loaded asynchronously
5. Updates when source content changes
6. Cleaned up when document unloaded

### GalleryView (Abstract)

Base interface for gallery view renderers.

**Fields**:
- `type: 'thumbnail' | 'carousel' | 'grid'` - View type identifier
- `container: HTMLElement` - DOM container
- `images: ImageSource[]` - Images to render

**Methods**:
- `render(): void` - Initial rendering
- `update(images: ImageSource[]): void` - Update with new image list
- `destroy(): void` - Cleanup resources
- `handleImageLoad(image: ImageSource): void` - Handle individual image load
- `handleImageError(image: ImageSource): void` - Handle image load error

**Implementations**:
- `ThumbnailView` - Grid of thumbnail images
- `CarouselView` - Horizontal scrolling carousel
- `GridView` - Responsive masonry-style grid

### ContentScanner

Handles discovery of images from paths.

**Fields**:
- `vault: Vault` - Obsidian vault instance
- `cache: Map<string, ImageSource[]>` - Cached scan results

**Methods**:
- `scanPath(path: string, recursive: boolean): Promise<ImageSource[]>` - Scan folder or file
- `isImageFile(path: string): boolean` - Check if file is supported image
- `extractLinksFromFile(file: TFile): Promise<ImageSource[]>` - Extract image links from markdown
- `validateImageSource(source: ImageSource): Promise<boolean>` - Validate image accessibility

**Cache Strategy**:
- Cache results by path and recursive flag
- Invalidate cache when vault files change
- Memory-based caching for session duration

## Entity Relationships

```
GalleryInstance
├── contains: GalleryConfig (1:1)
├── contains: ImageSource[] (1:many)
├── uses: GalleryView (1:1)
└── managed by: ContentScanner (many:1)

ContentScanner
├── accesses: Vault (1:1)
├── produces: ImageSource[] (1:many)
└── caches: scan results (1:many)

GalleryView
├── renders: ImageSource[] (1:many)
└── contained in: HTMLElement (1:1)
```

## Data Flow

1. **Code Block Processing**:
   - Raw YAML → GalleryConfig
   - Path validation and sanitization
   - Error state for invalid config

2. **Image Discovery**:
   - GalleryConfig.path → ContentScanner
   - Recursive folder scan or file parsing
   - ImageSource[] generation

3. **Gallery Rendering**:
   - GalleryConfig.view → appropriate GalleryView
   - ImageSource[] → visual elements
   - Lazy loading for performance

4. **Image Loading**:
   - Viewport intersection → load trigger
   - Async loading with timeout
   - State updates (loading → loaded/error)

5. **Content Updates**:
   - Vault file changes → cache invalidation
   - Re-scan and update existing galleries
   - Preserve scroll position where possible

## Performance Considerations

- **Lazy Loading**: Images load only when visible
- **Caching**: Scan results cached until source changes
- **Memory Management**: Large image galleries use virtual scrolling
- **Timeout Handling**: External URLs timeout after 10 seconds
- **Error Recovery**: Failed images don't block gallery rendering