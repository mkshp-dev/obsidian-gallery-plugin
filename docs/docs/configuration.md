---
sidebar_position: 3
---

# Configuration

All options are written inside an `obs-gallery` fenced code block as YAML.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | — | Path to a vault folder or file (relative to vault root). Required unless `urls` is provided. |
| `view` | string | `thumbnail` | Gallery layout. One of `thumbnail`, `carousel`, `grid`. |
| `recursive` | boolean | `false` | Include images from subfolders. |
| `urls` | list | — | List of external image URLs. Requires **Allow remote images** in plugin settings. |

## Plugin settings

Open **Settings → Image Gallery** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Allow remote images | Off | Enable loading images from `urls` fields. Disabled by default to protect privacy. |
| Remote load timeout (ms) | 30000 | How long to wait for a remote image before giving up. |
| Validate remote content type | Off | Perform a HEAD request to verify a URL serves an image before loading it. |
| Detached gallery grace period (ms) | 30000 | How long to keep a gallery alive after its container is detached (useful during view mode toggles). |
| Enable lifecycle logging | Off | Log gallery attach/detach events to the console. Useful for troubleshooting. |
