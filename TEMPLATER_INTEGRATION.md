# Templater Integration Guide

## Overview

The Gallery Plugin now supports dynamic variable expansion using the [Templater plugin](https://github.com/SilentVoid13/Templater). This allows you to use Templater syntax within gallery code blocks to populate URLs, paths, and other parameters dynamically.

## Setup

### Requirements
1. Install and enable the [Templater plugin](https://github.com/SilentVoid13/Templater)
2. Enable "Templater integration" in Gallery Plugin settings (Settings → Gallery Plugin)

### Configuration
- Navigate to: **Settings → Gallery Plugin → Enable Templater integration**
- Toggle the setting to **ON**
- Optionally enable "Enable lifecycle logging" for debugging

## How It Works

### Execution Flow
1. User creates an `obs-gallery` code block with Templater variables
2. Gallery Plugin checks if Templater integration is enabled in settings
3. If enabled, Templater variables are expanded **in-memory only** (non-destructive)
4. The expanded content is processed by the gallery engine
5. **Original source file remains unchanged** - template syntax is preserved
6. If Templater is unavailable, the original content is used (graceful fallback)

### Pre-Processing Architecture
- **Location**: `main.ts` → `expandTemplaterVariables()` method
- **Trigger**: Before `GalleryProcessor.processCodeBlock()`
- **Conditional**: Only runs when `settings.enableTemplaterIntegration === true`
- **Non-Destructive**: Uses Templater's parser API to expand in-memory without file modification
- **Fallback**: Silent failure returns original content

### Important: File Preservation
The Gallery Plugin **never modifies your source files**. Template syntax (`<% %>`) is:
- ✅ Expanded in-memory for gallery rendering
- ✅ Preserved in your source code
- ✅ Preserved when switching between edit/preview modes
- ✅ Never written back to disk

## Usage Examples

### 1. Frontmatter URLs

Pull image URLs from note frontmatter:

```markdown
---
coverImage: https://example.com/cover.jpg
headerImage: https://cdn.example.com/header.png
---

```obs-gallery
view: thumbnail
urls:
  - <% tp.frontmatter.coverImage %>
  - <% tp.frontmatter.headerImage %>
```
```

**Expands to:**
```yaml
view: thumbnail
urls:
  - https://example.com/cover.jpg
  - https://cdn.example.com/header.png
```

### 2. Dynamic Folder Paths

Use current file's folder path:

```markdown
```obs-gallery
path: <% tp.file.folder() %>/Screenshots
view: grid
recursive: true
```
```

**If file is in `Projects/MyProject/`, expands to:**
```yaml
path: Projects/MyProject/Screenshots
view: grid
recursive: true
```

### 3. Date-Based Galleries

Create galleries based on current date:

```markdown
```obs-gallery
path: DailyImages/<% tp.date.now("YYYY-MM") %>
view: carousel
```
```

**On January 2026, expands to:**
```yaml
path: DailyImages/2026-01
view: carousel
```

### 4. Custom Templater Functions

Use your own Templater user scripts:

```markdown
```obs-gallery
urls:
  - <% tp.user.getProjectCover("ProjectName") %>
  - <% tp.user.getRandomImage() %>
view: thumbnail
```
```

### 5. Combined Local + Remote

Mix local paths with dynamic URLs:

```markdown
```obs-gallery
path: <% tp.file.folder() %>/Local
urls:
  - <% tp.frontmatter.remoteGallery1 %>
  - <% tp.frontmatter.remoteGallery2 %>
view: grid
```
```

### 6. Conditional Logic

Use Templater's JavaScript execution:

```markdown
```obs-gallery
<%* 
const isProduction = tp.frontmatter.environment === 'production';
const baseUrl = isProduction ? 'https://cdn.example.com' : 'https://dev.example.com';
%>
urls:
  - <% baseUrl %>/image1.jpg
  - <% baseUrl %>/image2.jpg
view: thumbnail
```
```

## Supported Templater Features

### ✅ Supported
- `<% %>` - Variable interpolation
- `<%* %>` - JavaScript execution blocks
- `tp.file.*` - File system functions
- `tp.frontmatter.*` - Frontmatter access
- `tp.date.*` - Date functions
- `tp.user.*` - Custom user scripts
- `tp.config.*` - Templater configuration
- All standard Templater syntax

### ⚠️ Limitations
- Variables are expanded at **code block level** (before YAML parsing)
- File context must be available (won't work in empty notes without file path)
- Templater must be installed and enabled
- Requires valid file context in `MarkdownPostProcessorContext`

## Debugging

### Enable Debug Logging
1. Go to **Settings → Gallery Plugin**
2. Enable **"Enable lifecycle logging"**
3. Open Developer Console (Ctrl+Shift+I / Cmd+Opt+I)

### Debug Output Examples

**When Templater integration is disabled:**
```
Templater integration disabled in settings
```

**When Templater plugin not found:**
```
Templater plugin not found or not enabled
```

**When expansion succeeds:**
```
Templater expansion completed
Template variables were expanded
```

**When expansion fails:**
```
Templater expansion failed, using original source: [error details]
```

## Troubleshooting

### Gallery shows literal Templater syntax
**Problem:** You see `<% tp.frontmatter.coverImage %>` in error messages

**Solutions:**
1. Verify Templater plugin is installed and enabled
2. Check "Enable Templater integration" is ON in Gallery Plugin settings
3. Ensure the note has a valid file path (not an unsaved new note)
4. Enable lifecycle logging to see expansion status

### Template syntax disappears from source code (FIXED in latest version)
**Problem:** After rendering, the `<% %>` syntax is replaced with actual URLs in your source file

**This should NOT happen with the current version.** If you experience this:
1. Update to the latest version of the Gallery Plugin
2. The plugin now uses Templater's non-destructive parser API
3. Your source files should never be modified
4. If the issue persists, please report it as a bug

**Workaround for older versions:**
- Make a backup of your file before testing
- Undo (Ctrl+Z) immediately after noticing the change

### "File context not available"
**Problem:** Templater expansion fails with context error

**Solutions:**
1. Save the note before using gallery code blocks
2. Ensure you're not in an empty/untitled note
3. Check that the file exists in the vault

### Variables not expanding
**Problem:** Templater variables remain unexpanded

**Checks:**
1. Verify Templater syntax is correct (use `<% %>` not `{{ }}`)
2. Test the same variable in regular Templater context
3. Check frontmatter key names match exactly (case-sensitive)
4. Enable debug logging to see if expansion is attempted

## API Details

### Templater Detection
```typescript
const templater = (this.app as any).plugins?.getPlugin('templater-obsidian');
```

### Expansion Method (Non-Destructive)
```typescript
// Generate function context for the file
const functions = await templater.templater.functions_generator.generate_object(
    file,
    templater.templater.functions_generator.internal_functions.modules_array
);

// Parse commands in-memory without modifying the file
const expanded = await templater.templater.parser.parse_commands(source, functions);
```

**Why this approach:**
- ✅ Does NOT modify the source file
- ✅ Expands templates in-memory only
- ✅ Preserves original `<% %>` syntax in your notes
- ✅ Same expansion capabilities as regular Templater usage

### Settings Property
```typescript
interface GalleryPluginSettings {
    // ... other settings ...
    enableTemplaterIntegration?: boolean; // Default: false
}
```

## Performance Considerations

- **Minimal Overhead**: Templater expansion only runs when enabled in settings
- **Conditional Execution**: Skips entirely if setting is disabled
- **Caching**: Relies on Templater's internal caching mechanisms
- **Async**: Properly handles async Templater operations
- **Graceful Fallback**: No performance impact on failure

## Security Notes

1. **Templater Execution Context**: Variables run in Templater's security context
2. **User Scripts**: Custom `tp.user.*` functions have full system access (as per Templater design)
3. **URL Validation**: Expanded URLs still undergo normal gallery validation
4. **Remote Images**: Requires "Allow remote images" setting to be enabled separately

## Best Practices

### ✅ Do's
- Enable Templater integration only when needed
- Use frontmatter for static image lists
- Test Templater syntax in regular notes first
- Enable lifecycle logging during development
- Document expected frontmatter structure

### ❌ Don'ts
- Don't rely on Templater for security-critical operations
- Don't use complex JavaScript in production galleries (hard to debug)
- Don't mix too many dynamic sources (path + urls + conditions)
- Don't forget to handle missing frontmatter keys

## Migration Path

### Before (Static URLs)
```markdown
```obs-gallery
view: thumbnail
urls:
  - https://example.com/static1.jpg
  - https://example.com/static2.jpg
```
```

### After (Dynamic URLs)
```markdown
---
galleryImages:
  - https://example.com/static1.jpg
  - https://example.com/static2.jpg
---

```obs-gallery
view: thumbnail
urls:
  - <% tp.frontmatter.galleryImages[0] %>
  - <% tp.frontmatter.galleryImages[1] %>
```
```

## Integration Test Checklist

- [ ] Templater plugin installed and enabled
- [ ] Gallery Plugin "Enable Templater integration" setting ON
- [ ] Test basic frontmatter variable (`tp.frontmatter.X`)
- [ ] Test file path function (`tp.file.folder()`)
- [ ] Test date function (`tp.date.now()`)
- [ ] Test custom user script (if applicable)
- [ ] Verify graceful fallback when Templater disabled
- [ ] Check lifecycle logging output
- [ ] Test with remote images setting ON/OFF
- [ ] Validate expanded URLs work correctly

## Technical Implementation

### Files Modified
1. **main.ts**
   - Added `enableTemplaterIntegration` to settings interface
   - Added to `DEFAULT_SETTINGS`
   - Created `expandTemplaterVariables()` method (58 lines)
   - Integrated pre-processing in `processGalleryProfessional()`
   - Added settings UI toggle

### Total Changes
- **~70 lines of code** added
- **0 breaking changes**
- **100% backward compatible**
- **Graceful degradation** if Templater unavailable

### No Changes Required To
- `ParameterParser.ts` - Receives already-expanded content
- `GalleryProcessor.ts` - No awareness of Templater
- `ImageSource.ts` - Validates expanded URLs normally
- Any view components - Work with final processed data

## Future Enhancements

### Potential Improvements
- [ ] Cache expanded templates per file
- [ ] Support Templater v2.0+ features
- [ ] Add template validation before expansion
- [ ] Provide template suggestion helpers
- [ ] Integration with Dataview queries
- [ ] Template snippet library

### Requested Features
If you'd like to see additional Templater integration features, please:
1. Open an issue on GitHub
2. Provide use case examples
3. Share expected vs. actual behavior

---

**Last Updated**: January 2026
**Templater Version Tested**: Latest stable
**Gallery Plugin Version**: 1.0.0+
