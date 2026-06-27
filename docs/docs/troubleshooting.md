---
sidebar_position: 6
---

# Troubleshooting

> [!TIP]
> You can control how errors appear in gallery blocks by adjusting the **Error display mode** setting in **Settings → Gallery View → General**. Set it to `Full` to see styled error cards, `Text only` for plain text, or `Hidden` to suppress display errors entirely (useful if you prefer to check the developer console instead).

## Gallery not appearing

- Verify that the path defined in your local source configuration (under `sources`) exists in your vault and that the spelling and casing match exactly.
- Confirm images are in a supported format: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.
- Try switching between reading and editing mode to trigger a re-render.

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
- Click **Test connection** in the Providers settings tab to confirm credentials are valid before troubleshooting gallery blocks.

## Performance with many images

- The plugin uses lazy loading automatically.
- Consider organizing large collections into subfolders and using `recursive: true` under your local source only when needed.
