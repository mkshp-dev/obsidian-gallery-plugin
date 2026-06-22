---
sidebar_position: 5
---

# Settings

You can configure plugin-wide behavior by opening **Settings → Gallery View**.

## Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Allow remote images | Off | Enable loading images from external URLs. Disabled by default to protect your privacy. If disabled, any `external` sources in your blocks will be skipped. |
| Remote load timeout (ms) | 30000 | How long the plugin waits for a remote image to load before giving up. Useful for slow network connections or slow remote servers. |
| Validate remote content type | Off | When enabled, the plugin performs a lightweight HEAD request to verify that a remote URL actually serves an image (e.g., `image/jpeg`) before attempting to load it. This reduces accidental loading of non-image resources, at the cost of one extra small network request per URL. |
| Detached gallery grace period (ms) | 30000 | How long to keep a gallery alive in memory after its container is removed from the view. This is useful for preventing galleries from reloading their images constantly if you frequently toggle between reading and editing modes. |
| Enable lifecycle logging | Off | Log gallery attach/detach events to the developer console. Useful for troubleshooting. |
