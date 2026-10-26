---
sidebar_position: 3
---

# Gallery block syntax

All options are written inside an `obs-gallery` fenced code block as YAML.

The plugin utilizes a structured nested configuration schema (v2) consisting of a `sources` array and a `view` object.

> [!TIP]
> You don't have to write YAML by hand. Use the **Gallery View: Insert gallery** command from the command palette to open an interactive builder that generates the block for you. See [Gallery Builder](./gallery-builder) for details.
>
> Additionally, Gallery View provides **YAML autocomplete** inside `obs-gallery` blocks — press your autocomplete key while typing a field value to get context-aware suggestions.

## Structure

```yaml
sources:
  - type: local
    path: Images
view:
  type: thumbnail
```

### `sources`

**Required** (unless using legacy syntax). The `sources` key takes a list of objects. Each object represents an image source. You can define multiple sources in a single gallery block, and the plugin will load images from all of them.

See the [Sources](./category/sources) section for details on configuring specific source types (`local`, `external`, `immich-share`, `immich`, `nextcloud-share`, `nextcloud`).

### `view`

**Optional**. Defaults to `thumbnail`. The `view` key sets how the gallery is laid out. It can be just the view name, or an object with the name under `type` plus options:

```yaml
view: masonry          # short form
```

```yaml
view:                  # long form, with options
  type: masonry
  pagination: true
  itemsPerPage: 24
```

| Key | Values | Default | Description |
|---|---|---|---|
| `type` | `thumbnail`, `carousel`, `masonry`, `justified`, `embed` | `thumbnail` | The layout. The older name `grid` is still accepted and renders as `masonry`. |
| `pagination` | `true` / `false` | The **Enable pagination by default** setting (off) | Show a fixed number of images per page with Prev/Next buttons, instead of one long scroll. All views except `carousel`. |
| `itemsPerPage` | whole number, 1–10000 | The **Images per page** setting (24) | Images per page when pagination is on. All views except `carousel`. |
| `captions` | `true` / `false` | The **Show captions** setting (on) | `true`: captions under each image. `false`: captions only on hover. All views. |
| `frame` | `true` / `false` | The **Show gallery frame** setting (on) | `false` removes the box around the gallery (border, shadow, background and padding), so the images sit directly in the note. Thumbnail tiles keep their card look. All views except `embed`, which never has a frame. |
| `rowHeight` | number of pixels, 40–1000 | 220 | Target row height. `justified` only. |
| `columnWidth` | number of pixels, 60–1000 | 220 | Minimum column width; the number of columns follows the note's width. `masonry` only. |
| `gap` | number of pixels, 0–64 | 8 (masonry), 4 (justified) | Space between images. `masonry` and `justified`. |
| `height` | number of pixels, 120–1500 | 420 | Height of the stage. `carousel` only. |

These options override the plugin settings, and any [CSS snippet](./views/masonry.md#customizing-with-css) sizes, for this gallery only:

```yaml
view:
  type: justified
  rowHeight: 160
  gap: 2
  captions: false
```

A value of the wrong type or out of range (for example `rowHeight: big`) stops the gallery with an error. An unknown option, or one that doesn't apply to the chosen view (for example `rowHeight` on a masonry gallery), is ignored and noted in a line under the gallery, so typos such as `itemPerPage` don't go unnoticed. Turning off **Error messages** in settings hides these notes too.

See the [Views](./category/views) section for each layout, and the [Image viewer](./views/image-viewer.md) for what happens when you click an image.

---

## Backward Compatibility

> [!NOTE]
> For convenience and backward compatibility, the plugin transparently translates legacy v1 root-level keys into the new structured format. However, the v2 schema documented above is the preferred format going forward.

| Legacy key | Same as |
|---|---|
| `path: Images` | a `local` source with that `path` |
| `recursive: false` | `recursive` on that `local` source (default `true`) |
| `urls: [...]` | an `external` source with those `urls` |

```yaml
path: Images/Screenshots
recursive: false
view: masonry
```
