## 2024-05-26 - [Avoid split in isImageFile]
**Learning:** Found string split operations in `isImageFile` are very slow when processing thousands of files in a folder scan.
**Action:** Replaced string splitting with fast `indexOf` checks and substrings to remove query/fragment, which performs ~4x faster without hardcoding extensions or using risky regex.

## 2025-02-15 - [Avoid O(N^2) array filtering with findIndex]
**Learning:** Using `filter` combined with `findIndex` to remove duplicates is O(N^2) and can become a significant performance bottleneck when dealing with arrays containing many items (e.g. many image links extracted from a file).
**Action:** Replace `array.filter((item, index, arr) => arr.findIndex(...) === index)` with an O(N) approach using a `Set` to track seen values.

## 2024-05-31 - Sequential Async Bottleneck in File System Scanning
**Learning:** Folder scanning implementations in Obsidian plugins can become major bottlenecks if they sequentially `await` I/O operations (like `adapter.stat()`) inside `for` loops, especially since image vaults often contain hundreds of files.
**Action:** When scanning the file system or mapping arrays with async I/O in plugin development, aggressively refactor sequential awaits into `Promise.all` batches, while ensuring error handling correctly isolates failures so they don't break the entire batch.
