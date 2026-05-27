## 2024-05-26 - [Avoid split in isImageFile]
**Learning:** Found string split operations in `isImageFile` are very slow when processing thousands of files in a folder scan.
**Action:** Replaced string splitting with fast `indexOf` checks and substrings to remove query/fragment, which performs ~4x faster without hardcoding extensions or using risky regex.
