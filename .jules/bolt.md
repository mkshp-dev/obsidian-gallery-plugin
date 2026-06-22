## 2024-05-26 - [Avoid split in isImageFile]
**Learning:** Found string split operations in `isImageFile` are very slow when processing thousands of files in a folder scan.
**Action:** Replaced string splitting with fast `indexOf` checks and substrings to remove query/fragment, which performs ~4x faster without hardcoding extensions or using risky regex.

## 2025-02-15 - [Avoid O(N^2) array filtering with findIndex]
**Learning:** Using `filter` combined with `findIndex` to remove duplicates is O(N^2) and can become a significant performance bottleneck when dealing with arrays containing many items (e.g. many image links extracted from a file).
**Action:** Replace `array.filter((item, index, arr) => arr.findIndex(...) === index)` with an O(N) approach using a `Set` to track seen values.

## 2024-05-31 - Sequential Async Bottleneck in File System Scanning
**Learning:** Folder scanning implementations in Obsidian plugins can become major bottlenecks if they sequentially `await` I/O operations (like `adapter.stat()`) inside `for` loops, especially since image vaults often contain hundreds of files.
**Action:** When scanning the file system or mapping arrays with async I/O in plugin development, aggressively refactor sequential awaits into `Promise.all` batches, while ensuring error handling correctly isolates failures so they don't break the entire batch.
## 2024-03-22 - Fixed no-empty lint violations properly
**Learning:** Empty `catch {}` blocks lead to silent failures and trigger `no-empty` linting rules. Instead of just adding comments like `/* Ignore error */` as a band-aid, it is better to handle them either by validating checks before throwing, or by logging errors with `console.debug`.
**Action:** Replaced empty `catch` blocks with `catch (error) { console.debug('Ignored error:', error); }` to gracefully satisfy the linter and retain debuggability without breaking code flows. Changed `"no-empty": "off"` to `"no-empty": "error"` in `eslint.config.mts`.
## 2026-06-19 - [Fixed Window Timers Lint violations]\n**Learning:** The rule `obsidianmd/prefer-window-timers` was failing and caused lint violations because timers weren't prefixed with `window.` (which is required for popout window compatibility in Obsidian).\n**Action:** Replaced bare timer calls (like `setTimeout`) with `window.setTimeout` and similarly for other timers. To fix the linter, the ignored rule was also commented out in `eslint.config.mts`. Fixed the type for window timers in VaultWatcher.ts since `window.setTimeout` returns a `number` instead of `NodeJS.Timeout`.
## 2026-06-23 - [Object URL Memory Leak Prevention]
**Learning:** Blobs fetched via network calls (like Immich API) create `blob:` Object URLs that do not get garbage collected until explicitly revoked. If an active component repeatedly calls `URL.createObjectURL` without corresponding `URL.revokeObjectURL` calls tied to component teardown or data removal, a significant memory leak occurs.
**Action:** Use a reference-counted manager (e.g. `ObjectUrlManager`) that acquires, creates, and releases Object URLs based on stable keys. Ensure any `ImageSource` or component storing these URLs has a `destroy()` lifecycle method, and that parents (like `GalleryInstance` or `GalleryProcessor` on error paths) explicitly call it to clean up.
