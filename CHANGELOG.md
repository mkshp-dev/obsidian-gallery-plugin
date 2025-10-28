# Changelog

## Unreleased

### Added
- GridView renderer (responsive columns-based grid) — `src/views/GridView.ts`
- CarouselView getStats and GridView getStats to allow render-time detection
- Accessibility and keyboard navigation improvements for modal and thumbnails
- Visible Prev/Next buttons in modal
- Unit tests for view stats (`tests/unit/views.test.ts`)

### Fixed
- Render timeout in `GalleryProcessor` by implementing `getStats()` for views
- LazyLoader placeholder fallback for environments without canvas (jsdom)
- Grid view class name / lazy-loading mismatch and sizing issues
- Platform/esbuild build guidance for WSL (rebuild or reinstall node_modules)

### Changed
- Increased default grid column width and image max-height for improved visuals

---

Testing:
- npm ci && npm test (run in WSL if building there)

Notes:
- Please run a manual smoke test in Obsidian (editor & preview) to verify behavior in host app.
