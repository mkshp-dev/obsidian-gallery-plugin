---
sidebar_position: 3
---

# Configuration

All options are written inside an `obs-gallery` fenced code block as YAML.

The plugin utilizes a structured nested configuration schema (v2). Legacy top-level options are still fully supported for backward compatibility.

## Parameters (v2 Schema)

| Parameter | Type | Description |
|-----------|------|-------------|
| `sources` | list of objects | **Required** (unless using legacy `path` or `urls`). A list of local or remote image sources to display. |
| `view` | object or string | **Optional** (defaults to `{ type: 'thumbnail' }`). Defines the layout. Can be a string (e.g., `thumbnail`) or an object containing a `type` property (`thumbnail`, `carousel`, or `grid`). |

### Source Object Fields

#### Local Source (`type: local`)
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | **Required**. Must be `local`. |
| `path` | string | — | **Required**. Vault-relative path to folder or file. |
| `recursive` | boolean | `true` | Include images in subfolders. |

#### External Source (`type: external`)
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | **Required**. Must be `external`. |
| `urls` | list of strings | — | **Required**. List of remote image URLs to load (requires enabling remote images in settings). |

---

## Backward Compatibility (v1 Schema)

For convenience and backward compatibility, the plugin transparently translates legacy root-level keys into the new structured format:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | — | Maps to a `local` source. Path to vault folder/file. |
| `recursive` | boolean | `false` | Maps to `recursive` on the local source. |
| `urls` | list | — | Maps to an `external` source with a list of URLs. |
| `view` | string | `thumbnail` | Maps to `view.type`. |

---

## Plugin settings

Open **Settings → Image Gallery** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Allow remote images | Off | Enable loading images from `urls` fields. Disabled by default to protect privacy. |
| Remote load timeout (ms) | 30000 | How long to wait for a remote image before giving up. |
| Validate remote content type | Off | Perform a HEAD request to verify a URL serves an image before loading it. |
| Detached gallery grace period (ms) | 30000 | How long to keep a gallery alive after its container is detached (useful during view mode toggles). |
| Enable lifecycle logging | Off | Log gallery attach/detach events to the console. Useful for troubleshooting. |
