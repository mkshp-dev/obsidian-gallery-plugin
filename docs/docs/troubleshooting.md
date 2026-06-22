---
sidebar_position: 6
---

# Troubleshooting

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

- Ensure **Allow remote images** is enabled in **Settings → Gallery View**.
- Check that the URL is publicly accessible and returns an image content type.
- Try enabling **Validate remote content type** to get early feedback on bad URLs.
- Increase the **Remote load timeout** if images are loading slowly.

## Immich share issues

- **Invalid URL:** Make sure the URL points to a valid Immich share link (typically containing `/share/`).
- **Password Required / 401 Unauthorized:** If the shared album requires a password and you haven't provided it, or if the password provided is incorrect, you will see a password authentication failure error. Make sure to specify the correct password in the `password` field of your source configuration.
- **Share not found:** The share may have been deleted, expired, or you might not have network access to the Immich server.
- **Empty share:** If the album is empty, the gallery will render normally but without any images.

## Performance with many images

- The plugin uses lazy loading automatically.
- Consider organizing large collections into subfolders and using `recursive: true` under your local source only when needed.
