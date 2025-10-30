# 🖼️ Obsidian Gallery Plugin

Create beautiful, interactive image galleries in your Obsidian notes using simple code blocks. Display images from your vault folders with thumbnail grids and click-to-expand modal viewing.

![Plugin Demo](https://img.shields.io/badge/status-working-brightgreen) ![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Obsidian](https://img.shields.io/badge/obsidian-0.15.0+-purple)

## ✨ Features

- 🖼️ **Thumbnail Galleries** - Display images in responsive grid layouts
- 🔍 **Modal Viewer** - Click thumbnails to view full-size images
- 📁 **Folder Support** - Scan entire folders or individual files
- 🎯 **Simple Syntax** - Easy `obs-gallery` code blocks
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Performance** - Lazy loading for large image collections
- 🎨 **Clean Styling** - Integrates seamlessly with Obsidian themes
- ❌ **Error Handling** - Graceful fallbacks for missing paths

## 🚀 Quick Start

### Installation

1. Download the plugin files (`main.js`, `manifest.json`, `styles.css`)
2. Create folder: `YourVault/.obsidian/plugins/obsidian-gallery-plugin/`
3. Copy files to the plugin folder
4. Enable "Gallery Plugin" in Obsidian Settings → Community Plugins

### Basic Usage

Create galleries in your notes using code blocks:

````markdown
```obs-gallery
path: Images/Screenshots
view: thumbnail
```
````

## 📖 Usage Examples

### Folder Gallery
Display all images from a folder:
````markdown
```obs-gallery
path: Photos/Vacation2024
```
````

### Single Image
Show a specific image:
````markdown
```obs-gallery
path: Images/diagram.png
```
````

### Nested Folders
Access images in subfolders:
````markdown
```obs-gallery
path: Projects/WebDev/Screenshots
```
````

## 🎛️ Configuration Options

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `path` | Folder or file path (required when not using `urls`) | - | `Images/Photos` |
| `view` | Display style | `thumbnail` | `thumbnail` |
| `urls` | Optional list of remote image URLs (opt-in). Use when you want to reference images hosted externally. | - | see example below |
| `allowRemoteImages` | Plugin setting (opt-in). When false, remote images from `urls` will be blocked and a helpful message will be shown. This is controlled from the plugin settings page. | `false` | n/a |
| `remoteLoadTimeoutMs` | Plugin setting controlling how long (ms) the plugin will wait for a remote image to load before giving up. Applies to images in `urls`. | `10000` | n/a |

## 🌐 Remote images (opt-in)

You can reference externally hosted images using the `urls:` YAML list in your `obs-gallery` code block. Remote images are disabled by default to preserve privacy. The plugin exposes these related settings in the Gallery Plugin settings panel:

- `Allow remote images` (boolean) — enable loading images from external URLs.
- `Remote load timeout (ms)` — how long the plugin waits for remote images before giving up.
- `Validate remote content type` (optional) — when enabled the plugin will perform a lightweight HEAD request to verify the remote resource's Content-Type header looks like an image (e.g., `image/jpeg`) before attempting to load it. This can reduce accidental attempts to load non-image resources, at the cost of one extra small network request per URL.

Example `urls:` usage:

````markdown
```obs-gallery
view: thumbnail
urls:
  - https://example.com/photos/cover.jpg
  - https://cdn.example.org/gallery/img123.webp
```
````

Notes:

- The plugin performs only syntactic validation of URLs by default. Enabling content-type validation activates the HEAD check described above.
- Remote images are not automatically downloaded into your vault. If you need permanent local copies, mirror the assets manually.


## 🖼️ Supported Formats

- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **GIF** (`.gif`)
- **WebP** (`.webp`)

## 🎨 Interface

### Thumbnail Grid
- Responsive grid layout adapts to screen size
- Hover effects for better interactivity
- Lazy loading for performance

### Modal Viewer
- Full-size image display
- Multiple ways to close:
  - Click the **×** button
  - Press **Escape** key
  - Click outside the image
- Image name displayed at bottom

## 🛠️ Development

### Building from Source

```bash
# Install dependencies
npm install

# Development build with watching
npm run dev

# Production build
npm run build

# Simple build (MVP version)
npm run build-mvp
```

### Project Structure

```
obsidian-gallery-plugin/
├── main.ts              # Main plugin code
├── main.js              # Compiled plugin
├── manifest.json        # Plugin metadata
├── styles.css           # Gallery styling
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── src/                 # Advanced architecture (future)
    ├── models/          # Data models
    ├── views/           # View components
    ├── services/        # Core services
    └── processors/      # Content processing
```

## 🔧 Troubleshooting

### Gallery Not Appearing
- Check that the path exists and has correct case sensitivity
- Verify images are in supported formats
- Use exact folder names (e.g., `Images` not `images` if capitalized)

### Modal Not Opening
- Ensure `styles.css` is properly loaded
- Check browser console for JavaScript errors
- Try refreshing Obsidian or restarting the plugin

### Path Issues
- Use relative paths from vault root
- Don't include leading or trailing slashes
- Example: `Images/Photos` not `/Images/Photos/`

### Performance with Many Images
- Plugin uses lazy loading automatically
- Consider organizing large collections into subfolders
- Modal loads full-resolution images on demand

## 🗺️ Roadmap

### Current (v1.0.0)
- ✅ Basic thumbnail galleries
- ✅ Modal image viewer
- ✅ Folder and file support
- ✅ Responsive design

### Future Enhancements
- 🔄 Carousel view mode
- 🔄 Grid layout options
- ✅ External URL support (opt-in, timeouts)
- 🔄 Image filtering and sorting
- 🔄 Batch operations
- 🔄 Settings panel

Contributions are welcome! Please feel free to:

- Share usage examples and feedback
- Help with documentation

### Development Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Use `npm run dev` for development with auto-rebuilding
4. Test in your Obsidian vault

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Built for the [Obsidian](https://obsidian.md) community
- Developed using [SpecKit](https://github.com/specify/specify) methodology
- Thanks to all contributors and testers

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](../../issues)
- 💡 **Feature Requests**: [GitHub Discussions](../../discussions)
- 📖 **Documentation**: [Plugin Wiki](../../wiki)

---

**Made with ❤️ for the Obsidian community**

*Transform your vault into a visual experience with beautiful image galleries!*