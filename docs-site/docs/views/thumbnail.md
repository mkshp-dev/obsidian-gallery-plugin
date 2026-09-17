---
sidebar_position: 1
---

# Thumbnail view

![Thumbnail view screenshot](Thumb.png)

The default view. Displays images in a responsive grid. Clicking a thumbnail opens a full-size modal viewer.

````markdown
```obs-gallery
sources:
  - type: local
    path: Photos/Vacation
view:
  type: thumbnail
```
````

### Pagination

Add `pagination: true` (optionally with `itemsPerPage`) to page through large collections instead of lazy-loading the whole list. See the [Grid view](./grid.md#pagination) page for the config keys — they work the same way here.
