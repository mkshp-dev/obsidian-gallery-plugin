# Templater Gallery Examples

This sample note demonstrates various ways to use Templater variables with the Obsidian Gallery Plugin. Copy any example and adapt it to your needs!

> **Prerequisites:**
> - Templater plugin installed and enabled
> - Gallery Plugin setting "Enable Templater integration" turned ON
> - Gallery Plugin setting "Allow remote images" turned ON (for URL examples)

---

## Example 1: Basic Frontmatter URLs

Use frontmatter properties to store image URLs, then reference them in your gallery.

```yaml
---
projectCover: https://images.unsplash.com/photo-1506744038136-46273834b3fb
headerImage: https://images.unsplash.com/photo-1472214103451-9374bd1c798e
galleryImage1: https://images.unsplash.com/photo-1441974231531-c6227db76b6e
galleryImage2: https://images.unsplash.com/photo-1426604966848-d7adac402bff
---
```

````markdown
```obs-gallery
view: thumbnail
urls:
  - <% tp.frontmatter.projectCover %>
  - <% tp.frontmatter.headerImage %>
  - <% tp.frontmatter.galleryImage1 %>
  - <% tp.frontmatter.galleryImage2 %>
```
````

---

## Example 2: Dynamic Folder Path

Automatically create a gallery from a subfolder relative to the current note's location.

````markdown
```obs-gallery
path: <% tp.file.folder() %>/attachments
view: grid
recursive: true
```
````

**What it does:**
- If this note is in `Projects/MyProject/`, it will look for images in `Projects/MyProject/attachments/`
- Automatically adapts to the note's location
- Perfect for project-based organization

---

## Example 3: Date-Based Galleries

Organize images by year/month and display the current month's gallery.

````markdown
```obs-gallery
path: DailyPhotos/<% tp.date.now("YYYY")%>/<% tp.date.now("MM-MMMM") %>
view: carousel
recursive: false
```
````

**Example paths generated:**
- January 2026: `DailyPhotos/2026/01-January`
- February 2026: `DailyPhotos/2026/02-February`

---

## Example 4: Array Iteration

If you have an array of URLs in frontmatter, you can iterate and expand them.

```yaml
---
galleryImages:
  - https://images.unsplash.com/photo-1469474968028-56623f02e42e
  - https://images.unsplash.com/photo-1501594907352-04cda38ebc29
  - https://images.unsplash.com/photo-1484402628941-0bb40fc029e7
---
```

````markdown
```obs-gallery
<%* 
const images = tp.frontmatter.galleryImages || [];
%>
urls:
<% images.map(url => `  - ${url}`).join('\n') %>
view: thumbnail
```
````

---

## Example 5: Conditional Gallery Source

Switch between local and remote images based on frontmatter flag.

```yaml
---
useRemoteGallery: true
remoteGalleryUrl: https://images.unsplash.com/photo-1506905925346-21bda4d32df4
localGalleryPath: Projects/Screenshots
---
```

````markdown
```obs-gallery
<%* 
if (tp.frontmatter.useRemoteGallery) { 
%>
urls:
  - <% tp.frontmatter.remoteGalleryUrl %>
view: carousel
<%* } else { %>
path: <% tp.frontmatter.localGalleryPath %>
view: grid
recursive: true
<%* } %>
```
````

---

## Example 6: Custom Templater User Functions

Create custom functions in Templater for reusable gallery logic.

**Setup your Templater user script** (e.g., in `.obsidian/scripts/user-functions.js`):

```javascript
// Get cover image based on project type
function getProjectCover(tp, projectType) {
    const covers = {
        'web': 'https://images.unsplash.com/photo-1547658719-da2b51169166',
        'mobile': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
        'design': 'https://images.unsplash.com/photo-1561070791-2526d30994b5'
    };
    return covers[projectType] || covers['web'];
}

module.exports = getProjectCover;
```

**Use it in your note:**

```yaml
---
projectType: mobile
---
```

````markdown
```obs-gallery
urls:
  - <% tp.user.getProjectCover(tp, tp.frontmatter.projectType) %>
view: thumbnail
```
````

---

## Example 7: File Name in Path

Use the current file's name to locate related images.

````markdown
```obs-gallery
path: Assets/<% tp.file.title %>/images
view: grid
recursive: true
```
````

**Example:**
- Note name: "Project Apollo"
- Will look in: `Assets/Project Apollo/images/`

---

## Example 8: Weekly Gallery

Show images from the current week's folder.

````markdown
```obs-gallery
path: WeeklyPhotos/<% tp.date.now("YYYY") %>/Week-<% tp.date.now("ww") %>
view: carousel
recursive: true
```
````

**Example paths:**
- Week 1, 2026: `WeeklyPhotos/2026/Week-01`
- Week 52, 2025: `WeeklyPhotos/2025/Week-52`

---

## Example 9: Mixing Local and Remote

Combine local vault images with remote URLs from frontmatter.

```yaml
---
featuredImage: https://images.unsplash.com/photo-1506744038136-46273834b3fb
additionalImages:
  - https://images.unsplash.com/photo-1472214103451-9374bd1c798e
  - https://images.unsplash.com/photo-1441974231531-c6227db76b6e
---
```

````markdown
```obs-gallery
path: <% tp.file.folder() %>/local-images
urls:
  - <% tp.frontmatter.featuredImage %>
<%* 
const additionalImages = tp.frontmatter.additionalImages || [];
for (let img of additionalImages) {
%>  - <% img %>
<%* } %>
view: grid
recursive: false
```
````

---

## Example 10: Environment-Based URLs

Switch between development and production image sources.

```yaml
---
environment: production
devCDN: https://dev.example.com/images
prodCDN: https://cdn.example.com/images
imagePaths:
  - /gallery/img1.jpg
  - /gallery/img2.jpg
---
```

````markdown
```obs-gallery
<%* 
const baseUrl = tp.frontmatter.environment === 'production' 
    ? tp.frontmatter.prodCDN 
    : tp.frontmatter.devCDN;
const paths = tp.frontmatter.imagePaths || [];
%>
urls:
<% paths.map(path => `  - ${baseUrl}${path}`).join('\n') %>
view: thumbnail
```
````

---

## Example 11: Tag-Based Gallery Selection

Show different galleries based on note tags.

```yaml
---
tags: [project, web-design, portfolio]
---
```

````markdown
```obs-gallery
<%* 
const tags = tp.frontmatter.tags || [];
let galleryPath = 'Images/Default';

if (tags.includes('web-design')) {
    galleryPath = 'Images/WebDesign';
} else if (tags.includes('photography')) {
    galleryPath = 'Images/Photography';
} else if (tags.includes('portfolio')) {
    galleryPath = 'Images/Portfolio';
}
%>
path: <% galleryPath %>
view: grid
recursive: true
```
````

---

## Example 12: Relative Date Galleries

Show images from yesterday, last week, or last month.

````markdown
```obs-gallery
path: DailyCaptures/<% tp.date.now("YYYY-MM-DD", -1) %>
view: carousel
```
````

**Parameters:**
- `tp.date.now("YYYY-MM-DD", -1)` - Yesterday
- `tp.date.now("YYYY-MM-DD", -7)` - One week ago
- `tp.date.now("YYYY-MM", -1, "months")` - Last month

---

## Example 13: Dataview-Style Queries (Advanced)

Combine with file system queries to build dynamic galleries.

````markdown
```obs-gallery
<%* 
// Get all markdown files in current folder
const folder = tp.file.folder();
const files = app.vault.getMarkdownFiles().filter(f => 
    f.parent?.path === folder
);

// Extract cover images from frontmatter
const coverImages = files
    .map(f => app.metadataCache.getFileCache(f)?.frontmatter?.cover)
    .filter(Boolean);
%>
urls:
<% coverImages.map(url => `  - ${url}`).join('\n') %>
view: thumbnail
```
````

---

## Example 14: Season-Based Galleries

Display different galleries based on the current season.

````markdown
```obs-gallery
<%* 
const month = parseInt(tp.date.now("MM"));
let season = 'spring';

if (month >= 3 && month <= 5) season = 'spring';
else if (month >= 6 && month <= 8) season = 'summer';
else if (month >= 9 && month <= 11) season = 'autumn';
else season = 'winter';
%>
path: Nature/<% season %>
view: grid
recursive: true
```
````

---

## Example 15: Multi-Project Gallery

Aggregate images from multiple project folders.

```yaml
---
projects:
  - ProjectAlpha
  - ProjectBeta
  - ProjectGamma
---
```

````markdown
```obs-gallery
<%* 
const projects = tp.frontmatter.projects || [];
const basePath = 'Projects';
%>
<%* for (let project of projects) { %>
path: <% basePath %>/<% project %>/screenshots
<%* } %>
view: thumbnail
recursive: true
```
````

---

## Troubleshooting Tips

### Variables Not Expanding?

1. **Check Settings:**
   - Settings → Gallery Plugin → Enable Templater integration ✓
   - Settings → Gallery Plugin → Enable lifecycle logging ✓ (for debugging)

2. **Check Console (Ctrl+Shift+I):**
   - Look for "Templater expansion completed" message
   - Check for error messages

3. **Test Templater Syntax:**
   - Try the same variable outside the gallery block
   - Ensure Templater plugin is enabled

### Common Mistakes

❌ **Wrong:** `{{ tp.frontmatter.image }}`  
✅ **Correct:** `<% tp.frontmatter.image %>`

❌ **Wrong:** Unsaved/new note (no file context)  
✅ **Correct:** Save note first, then Templater has file context

❌ **Wrong:** Missing frontmatter key  
✅ **Correct:** Use fallback: `<% tp.frontmatter.image || 'default.jpg' %>`

---

## Best Practices

### 1. **Use Frontmatter for Configuration**
Store URLs and settings in frontmatter for easy editing without touching the code block.

### 2. **Provide Fallbacks**
```javascript
<% tp.frontmatter.galleryPath || 'Images/Default' %>
```

### 3. **Document Your Templates**
Add comments explaining what Templater variables do.

### 4. **Test Incrementally**
Start with simple variables, then add complexity.

### 5. **Enable Debug Logging**
Turn on lifecycle logging when developing templates.

---

## Quick Reference

| Templater Function | Example | Output |
|-------------------|---------|--------|
| `tp.frontmatter.key` | `<% tp.frontmatter.coverImage %>` | Frontmatter value |
| `tp.file.folder()` | `<% tp.file.folder() %>` | `Projects/MyProject` |
| `tp.file.title` | `<% tp.file.title %>` | `Note Title` |
| `tp.date.now("YYYY-MM-DD")` | `<% tp.date.now("YYYY-MM-DD") %>` | `2026-01-14` |
| `tp.date.now("YYYY")` | `<% tp.date.now("YYYY") %>` | `2026` |
| `tp.user.customFunction()` | `<% tp.user.getCover() %>` | Custom output |

---

## Additional Resources

- [Templater Documentation](https://silentvoid13.github.io/Templater/)
- [Gallery Plugin - Templater Integration Guide](TEMPLATER_INTEGRATION.md)
- [Obsidian Forum - Templater](https://forum.obsidian.md/tag/templater)

---

**Happy Templating! 🎨**

*Feel free to copy, modify, and share these examples!*
