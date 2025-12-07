# Nextcloud Integration Guide

The `obs-gallery` plugin now supports dynamic image loading from Nextcloud via the `obsidian-nextcloud-bridge` plugin.

## Overview

You can embed a Nextcloud query directly inside an `obs-gallery` code block. The plugin will:
1. Execute the Nextcloud query
2. Retrieve an array of URLs
3. Inject them into the gallery's `urls:` field
4. Render the gallery with the Nextcloud images

## Prerequisites

- Install and enable the [`obsidian-nextcloud-bridge`](https://github.com/your-repo/obsidian-nextcloud-bridge) plugin
- Configure your Nextcloud connection in that plugin's settings
- Enable "Allow remote images" in the Gallery Plugin settings

## Usage

### Basic Example

````markdown
```obs-gallery
path: 'images'
view: thumbnail

```nextcloud
folder: Photos/2024/
filter:
  - extension: jpg
format: https://cloud.example.com/{{name}}
```
```
````

### How It Works

1. **Query Extraction**: The plugin detects the nested ` ```nextcloud ` block
2. **Query Execution**: Calls `obsidian-nextcloud-bridge` API with the query text
3. **URL Injection**: Removes the nested block and adds URLs to `urls:` field:
   ```yaml
   path: 'images'
   view: thumbnail
   urls:
     - https://cloud.example.com/photo1.jpg
     - https://cloud.example.com/photo2.jpg
   ```
4. **Gallery Rendering**: Processes the modified YAML as normal

### Combining Local and Nextcloud Images

If you already have a `urls:` field, Nextcloud URLs will be **appended**:

````markdown
```obs-gallery
path: 'local-images'
view: grid
urls:
  - https://example.com/image1.jpg

```nextcloud
folder: SharedAlbum/
format: https://cloud.example.com/{{name}}
```
```
````

Result:
```yaml
path: 'local-images'
view: grid
urls:
  - https://example.com/image1.jpg
  - https://cloud.example.com/photo1.jpg
  - https://cloud.example.com/photo2.jpg
```

## Nextcloud Query Syntax

Refer to the `obsidian-nextcloud-bridge` documentation for query syntax. Typical format:

```yaml
folder: path/to/folder/
filter:
  - extension: jpg
  - extension: png
  - name_contains: vacation
sort: date_desc
limit: 50
format: https://your-nextcloud.com/remote.php/dav/files/username/{{path}}
```

## Error Handling

### Plugin Not Installed
**Error**: `Nextcloud plugin not found. Please install and enable the "obsidian-nextcloud-bridge" plugin to use Nextcloud queries in galleries.`

**Solution**: Install the `obsidian-nextcloud-bridge` plugin from Community Plugins.

### Query Returns No Results
**Error**: `Nextcloud query returned no results. Please check your query syntax and Nextcloud folder path.`

**Solution**:
- Verify the folder path exists in your Nextcloud
- Check filter criteria (extensions, name patterns)
- Test the query in the Nextcloud plugin directly

### Remote Images Disabled
**Error**: `No valid images: external URLs were present but remote image loading is disabled in plugin settings.`

**Solution**: Enable "Allow remote images" in the Gallery Plugin settings (Settings → Gallery Plugin → Allow remote images).

### API Not Available
**Error**: `Nextcloud plugin API not available. Please ensure you have the latest version of "obsidian-nextcloud-bridge" installed.`

**Solution**: Update the `obsidian-nextcloud-bridge` plugin to the latest version.

## Advanced Examples

### Carousel of Recent Nextcloud Photos

````markdown
```obs-gallery
view: carousel

```nextcloud
folder: Photos/Recent/
filter:
  - extension: jpg
sort: date_desc
limit: 20
format: https://cloud.example.com/remote.php/dav/files/{{user}}/{{path}}
```
```
````

### Mixed Local and Cloud Gallery

````markdown
```obs-gallery
path: 'vault-images'
view: grid
recursive: true

```nextcloud
folder: SharedAlbum/Vacation2024/
filter:
  - extension: jpg
  - extension: png
format: https://cloud.example.com/{{name}}
```
```
````

### Thumbnail View with Specific Nextcloud Folder

````markdown
```obs-gallery
view: thumbnail

```nextcloud
folder: Work/Presentations/
filter:
  - name_contains: slide
  - extension: png
format: https://your-nextcloud.com/files/{{path}}
```
```
````

## Backward Compatibility

All existing `obs-gallery` code blocks continue to work unchanged:

````markdown
```obs-gallery
path: 'images'
view: thumbnail
recursive: true
```
````

````markdown
```obs-gallery
urls:
  - https://example.com/image1.jpg
  - https://example.com/image2.jpg
view: carousel
```
````

Nextcloud integration is **opt-in** and only activates when a nested ` ```nextcloud ` block is detected.

## Troubleshooting

### Slow Loading
- Nextcloud queries may take time depending on folder size and network speed
- The plugin shows a loading indicator: "Processing Nextcloud query..."
- Consider using `limit:` in your query to reduce the number of URLs

### Authentication Issues
- Configure Nextcloud credentials in the `obsidian-nextcloud-bridge` plugin settings
- Ensure your Nextcloud user has access to the specified folders

### CORS Errors
- Nextcloud may require CORS configuration for external access
- Consult your Nextcloud admin or hosting provider

## Technical Details

### Implementation

1. **Detection**: Regex `/```nextcloud\s*([\s\S]*?)```/m`
2. **Extraction**: Query text is captured, nested block is removed from YAML
3. **API Call**: `app.plugins.plugins['obsidian-nextcloud-bridge'].api.runQuery(query)`
4. **URL Injection**: URLs added to `urls:` field (creates field if missing)
5. **YAML Parsing**: Modified YAML is parsed as normal

### Processing Order

```
Raw Code Block
   ↓
Extract Nextcloud Query (if present)
   ↓
Call Nextcloud API
   ↓
Remove Nested Block from YAML
   ↓
Inject URLs into urls: field
   ↓
Parse YAML
   ↓
Render Gallery
```

## Feedback and Support

If you encounter issues with Nextcloud integration:
1. Check this guide for common errors
2. Verify `obsidian-nextcloud-bridge` is installed and configured
3. Test the query in the Nextcloud plugin directly
4. Report issues with full error messages and query examples

Happy gallery building! 🖼️☁️
