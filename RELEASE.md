# Release guide

Releases are automated via GitHub Actions. Pushing a version tag to `main` triggers a build and creates a draft GitHub release with the compiled plugin assets attached.

---

## One-time setup

These steps only need to be done once before the first release.

### 1. Enable workflow write permissions

1. Go to your repository on GitHub.
2. Open **Settings → Actions → General**.
3. Scroll to **Workflow permissions**.
4. Select **Read and write permissions** and save.

### 2. Enable GitHub Pages (for documentation)

1. Go to **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Save. The docs site will be published automatically on the next push to `Dev`.

### 3. Submit to the community store (first release only)

Before submitting, make sure `main` has the final `manifest.json` with:
- `id`: `image-gallery`
- `version`: your release version (e.g. `1.0.0`)

Then:
1. Go to [community.obsidian.md](https://community.obsidian.md), sign in, and link your GitHub account.
2. Go to **Plugins → New plugin**.
3. Enter `https://github.com/mkshp-dev/obsidian-gallery-plugin`.
4. Agree to the developer policies and submit.

The automated review runs against the `main` branch. Once it passes, your plugin is listed and users can install it from within Obsidian.

---

## Making a release

### Step 1 — Work on Dev

Do all development on the `Dev` branch. When the feature or fix is ready:

```bash
# Make sure Dev is up to date and tests pass
git checkout Dev
npm test
```

### Step 2 — Merge to main

```bash
git checkout main
git merge Dev
git push origin main
```

### Step 3 — Bump the version

Edit **two files** — both must have the same version string:

| File | Field |
|------|-------|
| `manifest.json` | `"version"` |
| `package.json` | `"version"` |

Follow [Semantic Versioning](https://semver.org/):

| Change | Example |
|--------|---------|
| Bug fix | `1.0.0` → `1.0.1` |
| New feature (backwards-compatible) | `1.0.1` → `1.1.0` |
| Breaking change | `1.1.0` → `2.0.0` |

### Step 4 — Commit the version bump

```bash
git add manifest.json package.json
git commit -m "chore: release x.y.z"
git push origin main
```

### Step 5 — Tag the release

The tag **must exactly match** the `version` field in `manifest.json`. The workflow will fail if they differ.

```bash
git tag -a x.y.z -m "x.y.z"
git push origin x.y.z
```

### Step 6 — Publish the draft release

1. Go to your repository on GitHub and open the **Releases** tab.
2. You will see a **draft release** created by the workflow with `main.js`, `manifest.json`, and `styles.css` attached.
3. Click the pencil icon to edit it.
4. Write release notes (what changed, fixed, added).
5. Click **Publish release**.

Obsidian picks up the new version automatically. Users who have the plugin installed will be notified of the update.

---

## Versioning the `versions.json` (optional)

If you want older versions of Obsidian to know which minimum app version a plugin release requires, maintain a `versions.json` file at the repo root:

```json
{
  "1.0.0": "0.15.0",
  "1.1.0": "0.15.0"
}
```

Each key is a plugin version; the value is the minimum Obsidian version that release supports. Add a new entry for each release.

---

## Quick reference

```bash
# Full release flow (replace x.y.z with actual version)
git checkout main
git merge Dev
git push origin main
# Edit manifest.json and package.json to bump version
git add manifest.json package.json
git commit -m "chore: release x.y.z"
git push origin main
git tag -a x.y.z -m "x.y.z"
git push origin x.y.z
# Then publish the draft on GitHub Releases
```
