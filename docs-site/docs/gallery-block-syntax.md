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
| `pagination` | `true` / `false` | The **Enable pagination by default** setting (off) | Show a fixed number of images per page with Prev/Next buttons, instead of one long scroll. Not used by the `carousel` view. |
| `itemsPerPage` | a whole number above 0 | The **Images per page** setting (24) | Images per page when pagination is on. |

`pagination` and `itemsPerPage` override the plugin-wide defaults in [Settings](./settings.md#general-tab) for this gallery only.

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
