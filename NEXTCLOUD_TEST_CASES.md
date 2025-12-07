/**
 * Manual test cases for Nextcloud integration
 * 
 * These are example code blocks to test manually in Obsidian
 * Copy and paste into a note to test the feature
 */

/**
 * Test Case 1: Basic Nextcloud query
 * Expected: Gallery shows images from Nextcloud folder
 */
/*
```obs-gallery
view: thumbnail

```nextcloud
folder: Photos/2024/
filter:
  - extension: jpg
format: https://cloud.example.com/{{name}}
```
```
*/

/**
 * Test Case 2: Mixed local and Nextcloud images
 * Expected: Gallery shows both local images and Nextcloud images
 */
/*
```obs-gallery
path: local-images
view: grid

```nextcloud
folder: SharedAlbum/
format: https://cloud.example.com/{{name}}
```
```
*/

/**
 * Test Case 3: With existing urls field
 * Expected: Nextcloud URLs appended to existing URLs
 */
/*
```obs-gallery
urls:
  - https://example.com/manual-url.jpg
view: carousel

```nextcloud
folder: Work/Presentations/
filter:
  - extension: png
format: https://cloud.example.com/{{path}}
```
```
*/

/**
 * Test Case 4: Backward compatibility - no Nextcloud block
 * Expected: Works as before, no errors
 */
/*
```obs-gallery
path: images
view: thumbnail
recursive: true
```
*/

/**
 * Test Case 5: Error handling - plugin not installed
 * Expected: Friendly error message about missing plugin
 */
/*
```obs-gallery
view: thumbnail

```nextcloud
folder: Test/
format: https://cloud.example.com/{{name}}
```
```
*/

/**
 * Test Case 6: Error handling - empty results
 * Expected: Friendly error message about no results
 */
/*
```obs-gallery
view: thumbnail

```nextcloud
folder: NonExistentFolder/
format: https://cloud.example.com/{{name}}
```
```
*/

/**
 * Test Case 7: Remote images disabled
 * Expected: Error message to enable remote images setting
 */
/*
(Disable "Allow remote images" in plugin settings first)

```obs-gallery
view: thumbnail

```nextcloud
folder: Photos/
format: https://cloud.example.com/{{name}}
```
```
*/

/**
 * Implementation verification checklist:
 * 
 * ✓ extractNextcloudQuery() - Detects and extracts nested nextcloud block
 * ✓ executeNextcloudQuery() - Calls obsidian-nextcloud-bridge API
 * ✓ injectNextcloudUrls() - Injects URLs into YAML
 * ✓ parseAndValidateConfiguration() - Preprocesses before YAML parsing
 * ✓ Error handling - Missing plugin
 * ✓ Error handling - Empty results
 * ✓ Error handling - API not available
 * ✓ Error handling - Remote images disabled
 * ✓ Backward compatibility - Existing galleries work unchanged
 * ✓ TypeScript compilation - No errors
 * ✓ Build succeeds - main.js generated
 * ✓ Tests pass - Backward compatibility verified
 */
