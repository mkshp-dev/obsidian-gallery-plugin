---
sidebar_position: 6
---

# Troubleshooting

> [!TIP]
> You can choose whether errors appear in gallery blocks with the **Error messages** setting in **Settings → Gallery View → General**. `Show` puts a one-line message where the gallery would be; `Hide` shows nothing (useful if you prefer to check the developer console instead).

## Gallery not appearing

- Verify that the path defined in your local source configuration (under `sources`) exists in your vault and that the spelling and casing match exactly.
- Confirm images are in a supported format: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, or a video: `.mp4`, `.m4v`, `.webm`, `.mov`, `.ogv`.
- Try switching between reading and editing mode to trigger a re-render.

## Video shows a dark tile or doesn't play

- The video's format may not be one Obsidian's player supports. MP4 (H.264) and WebM play everywhere; HEVC (often used by iPhone `.mov` files) doesn't play on every computer. Converting the file to H.264 MP4 fixes it.
- An external video's tile is dark when the website doesn't allow other sites to read its videos (CORS) and the video is over 50 MB or its size isn't reported. It still plays in the viewer. Links to video pages (YouTube, Vimeo) aren't video files and can't be shown.
- Immich and Nextcloud videos download when you open them in the viewer, so a long video can take a moment to start.
- An Immich or Nextcloud video that says it is too large to play here is over **Largest remote video to play** in Settings. Use the **Open in Immich** / **Open in Nextcloud** button, or raise the limit (`0` removes it).
- Nextcloud video tiles show a dark placeholder when the server makes no video previews and the video is over 50 MB (or you're on a phone or tablet). Nextcloud makes video previews only with the Movie preview provider and ffmpeg installed on the server; ask your Nextcloud admin to enable them.

## Modal not opening

- Confirm `styles.css` is present in the plugin folder.
- Open the developer console (**Ctrl+Shift+I** / **Cmd+Option+I**) and check for errors.

## Path issues

- Use paths relative to the vault root, e.g. `Images/Photos`.
- Do not include a leading or trailing slash.

## Remote images not loading

- Ensure **Allow remote images** is enabled in **Settings → Gallery View → General**.
- Check that the URL is publicly accessible and returns an image content type.
- Try enabling **Validate remote content type** to get early feedback on bad URLs.
- Increase the **Remote load timeout** if images are loading slowly.

## Immich share issues

- **Invalid URL:** Make sure the URL points to a valid Immich share link (typically containing `/share/`).
- **Password Required / 401 Unauthorized:** If the shared album requires a password and you haven't provided it, or if the password provided is incorrect, you will see a password authentication failure error. Make sure to specify the correct password in the `password` field of your source configuration.
- **Share not found:** The share may have been deleted, expired, or you might not have network access to the Immich server.
- **Empty share:** If the album is empty, the gallery will render normally but without any images.

## Authenticated Immich issues

Errors from authenticated Immich sources appear inline inside the gallery block itself.

- **"Connection not found":** The `connection` key in your gallery block does not match any key in **Settings → Gallery View → Providers**. Check for typos or case mismatches.
- **"Authentication failed":** Your API key may have expired or been revoked. Generate a new key in your Immich account settings and update the plugin.
- **Gallery blank/empty:** The album, favorites list, or filtered result may genuinely be empty. If using `albumIds`, verify the UUID is correct by checking the URL in your Immich web interface.
- **Tags or people not resolving:** Names must match exactly as they appear in Immich (case-sensitive). Use the **Insert gallery** builder to pick from live lists instead of typing names manually.
- **Several tags or people show nothing:** Immich returns only assets that match *all* listed tags or people. Use one per source, or add a source per person.
- **A date filter matches every photo or none:** `createdAfter` / `createdBefore` filter on the date a photo was *uploaded* to Immich. Use `takenAfter` / `takenBefore` to filter on the date it was *taken*.
- Click **Test connection** in the Providers settings tab to confirm credentials are valid before troubleshooting gallery blocks.

## Performance with many images

- The plugin uses lazy loading automatically.
- Consider organizing large collections into subfolders and using `recursive: true` under your local source only when needed.
