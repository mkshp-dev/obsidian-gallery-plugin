---
sidebar_position: 5
---

# Settings

You can configure plugin-wide behavior by opening **Settings → Gallery View**.

The settings panel is split into two tabs: **General** and **Providers**.

---

## General tab

The General tab controls core plugin behavior and remote image handling.

| Setting | Default | Description |
|---------|---------|-------------|
| Error display mode | `Full` | Controls how block-processing errors are shown. `Full` renders a styled error card. `Text only` outputs a plain-text message. `Hidden` silently suppresses all errors (useful for production vaults). |
| Show captions | `On` | Controls persistent caption display under images in Grid, Thumbnail, and Carousel views. When toggled off, persistent captions are hidden. |
| Caption max lines | `1` | Controls the maximum number of text lines displayed for image captions before truncating with an ellipsis (configurable between 1 and 5). |
| Allow remote images | Off | Enable loading images from external URLs. Disabled by default to protect your privacy. If disabled, any `external` sources in your blocks will be skipped. |
| Remote load timeout (ms) | 30000 | How long the plugin waits for a remote image to load before giving up. Useful for slow network connections or slow remote servers. |
| Validate remote content type | Off | When enabled, the plugin performs a lightweight HEAD request to verify that a remote URL actually serves an image (e.g., `image/jpeg`) before attempting to load it. This reduces accidental loading of non-image resources, at the cost of one extra small network request per URL. |
| Detached gallery grace period (ms) | 30000 | How long to keep a gallery alive in memory after its container is removed from the view. This is useful for preventing galleries from reloading their images constantly if you frequently toggle between reading and editing modes. |
| Enable lifecycle logging | Off | Log gallery attach/detach events to the developer console. Useful for troubleshooting. |

---

## Providers tab

The Providers tab manages authenticated connections to your Immich servers. These connections are used by the `immich` source type to display your personal albums, favorites, and more.

> [!NOTE]
> Public Immich **shared links** (`immich-share` source type) do not require any configuration here — they work without an account.

### Adding an Immich connection

1. Click **Add Immich connection**.
2. Fill in the three fields for the new connection:

| Field | Description |
|-------|-------------|
| **Connection key** | A short, memorable name you choose (e.g. `home`, `work`). This is what you type in your gallery blocks under `connection:`. It must be unique across your connections. |
| **Base URL** | The root URL of your Immich server, e.g. `https://immich.example.com`. |
| **API key** | A personal API key generated in your Immich account under **Account settings → API Keys**. |

3. Click **Test connection** to verify the credentials. A notice will confirm success or report the error.
4. Settings are saved automatically as you type.

### Removing a connection

Click **Remove connection** next to the connection you want to delete. This only removes the plugin's stored credentials — it does not affect your Immich server or any gallery blocks that reference the key.

> [!WARNING]
> If you remove a connection whose `key` is referenced in a gallery block, that block will show an error ("Connection not found") until you either restore the connection or update the block.
