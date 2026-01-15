# Gallery Plugin Beta Release

**Version:** 1.0.0-beta  
**Release Date:** November 11, 2025  
**Status:** Beta Testing

## 🎯 What's Ready for Beta Testing

### Core Features (Fully Implemented)
- ✅ **Gallery Code Blocks**: Use `obs-gallery` code blocks to create image galleries
- ✅ **Multiple View Types**: Thumbnail grid, Carousel, and Masonry grid layouts  
- ✅ **Local Image Support**: Scan vault folders for images (JPG, PNG, GIF, WebP)
- ✅ **External URL Support**: Include remote images via `urls:` YAML parameter (opt-in)
- ✅ **Lazy Loading**: Efficient loading with Intersection Observer API
- ✅ **Responsive Design**: Works on desktop and mobile
- ✅ **Settings Panel**: Configurable options for remote images, timeouts, and lifecycle logging
- ✅ **Error Handling**: Professional error states and retry mechanisms

### Privacy & Security
- ✅ **Remote images are opt-in** via plugin settings
- ✅ **Configurable timeouts** for external requests
- ✅ **Optional content-type validation** for remote URLs

## 📖 Quick Start

### Basic Usage
```yaml
```obs-gallery
path: Photos/vacation-2025
view: thumbnail
recursive: true
```
```

### With External Images
```yaml
```obs-gallery
path: Photos/vacation-2025  
urls:
  - https://example.com/image1.jpg
  - https://example.com/image2.png
view: grid
```
```

### Available View Types
- `thumbnail` - Responsive grid with thumbnails (default)
- `carousel` - Horizontal scrolling carousel with controls
- `grid` - Pinterest-style masonry grid

## ⚙️ Settings

Go to **Settings → Community Plugins → Gallery Plugin**:

- **Allow remote images**: Enable loading from external URLs
- **Remote load timeout**: Timeout for external image requests (ms)
- **Validate remote content type**: Optional HEAD request validation
- **Detached gallery grace period**: Delay before cleanup during mode toggles
- **Enable lifecycle logging**: Debug logs for troubleshooting

## 🧪 What to Test

### High Priority
1. **Basic Gallery Creation**: Try creating galleries from different folders
2. **View Type Switching**: Test `thumbnail`, `carousel`, and `grid` views
3. **Mode Toggles**: Switch between editor/reading mode - galleries should persist
4. **External Images**: Enable remote images and test `urls:` parameter
5. **Error Handling**: Test invalid paths, blocked external images

### Medium Priority  
1. **Performance**: Test with 50+ images
2. **Responsive Design**: Resize window, test on mobile
3. **Settings Changes**: Modify timeout/validation settings and observe effects
4. **Empty States**: Test galleries with no images found

### Lower Priority
1. **Edge Cases**: Very long paths, special characters in filenames
2. **Large Images**: Test with high-resolution images
3. **Network Issues**: Test external images with slow/failing connections

## 🐛 Known Issues & Limitations

### Expected Behavior
- Galleries appear only in the mode where they're currently rendered (editor OR reading)
- This is expected Obsidian behavior - each mode has separate DOM rendering

### Limitations in Beta
- File-based galleries not yet implemented (coming in v1.1)
- Touch gestures for carousel are basic (enhancements planned)
- Virtual scrolling for very large galleries not yet implemented
- No view-switching controls in UI (must edit code block)

## 🔧 Troubleshooting

### Gallery Disappears After Mode Toggle
1. Enable **"Enable lifecycle logging"** in plugin settings
2. Open Developer Tools (Ctrl+Shift+I) 
3. Reproduce the issue and check console for lifecycle messages
4. If you see "appears permanently detached; destroying" try increasing the grace period

### External Images Not Loading
1. Verify **"Allow remote images"** is enabled in settings
2. Check the URLs are valid and accessible
3. Try enabling **"Validate remote content type"** if having issues
4. Check browser network tab for failed requests

### Performance Issues
1. Reduce the number of images or use pagination
2. Lower the remote timeout setting
3. Try a different view type (thumbnail is most efficient)

## 📋 Beta Testing Feedback

Please report issues with:

**Environment Info:**
- Obsidian version
- Operating system
- Plugin version (1.0.0-beta)
- Browser (if relevant)

**Bug Reports:**
- Steps to reproduce
- Expected vs actual behavior  
- Console logs (if available)
- Gallery configuration used

**Feature Requests:**
- Use case description
- Proposed solution
- Priority level

## 🚀 Roadmap

### v1.1 (Next Release)
- File-based galleries (scan markdown files for image links)
- Enhanced touch gestures and keyboard navigation
- View switching controls in gallery UI
- Performance optimizations for large galleries

### v1.2 (Future)
- Virtual scrolling for 500+ images
- Advanced filtering and sorting options
- Gallery templates and presets
- Export/sharing capabilities

## 📄 Technical Notes

### Architecture
- **TypeScript** codebase with comprehensive type safety
- **Modular design** with clear separation of concerns
- **Test coverage** for core functionality (Jest + jsdom)
- **DOM-agnostic** rendering for reliability across environments

### File Structure
- `src/views/` - View renderers (ThumbnailView, CarouselView, GridView)
- `src/processors/` - YAML parsing and gallery creation pipeline
- `src/services/` - File scanning and content management  
- `src/utils/` - Lazy loading, validation, error handling
- `tests/` - Unit and integration tests

### Build System
- **esbuild** for fast bundling
- **TypeScript** compilation with strict type checking
- **Jest** for testing with jsdom environment
- **ESLint** for code quality

---

**Ready for beta testing!** 🎉

The plugin provides a solid foundation for image galleries in Obsidian with professional error handling, configurable privacy controls, and multiple view options. While some advanced features are planned for future releases, the core functionality is stable and ready for real-world testing.