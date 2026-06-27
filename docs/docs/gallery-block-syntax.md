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

See the [Sources](./category/sources) section for details on configuring specific source types (`local`, `external`, `immich-share`, `immich`).

### `view`

**Optional**. Defaults to `{ type: 'thumbnail' }`. The `view` key defines how the gallery will be laid out. It can be a simple string (e.g., `thumbnail`) or an object containing a `type` property (`thumbnail`, `carousel`, or `grid`).

See the [Views](./category/views) section for details on specific view types.

---

## Backward Compatibility

> [!NOTE]
> For convenience and backward compatibility, the plugin transparently translates legacy v1 root-level keys (like `path: Images/Screenshots` or `urls: [...]`) into the new structured format. However, the v2 schema documented above is the preferred format going forward.
