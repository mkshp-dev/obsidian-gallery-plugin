import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const targetVersion = process.env.npm_package_version;

// A prerelease version (e.g. "2.5.0-beta.0") per semver always carries a "-".
// Beta increments still need manifest.json updated so the built release
// assets carry the right version, but versions.json and docs-site versioning
// are stable-release-only concerns — skip them here so betas don't leave
// permanent, ever-growing artifacts behind.
const isPrerelease = targetVersion.includes('-');

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

if (isPrerelease) {
    console.log(`[version-bump] ${targetVersion} is a prerelease — skipping versions.json and docs-site versioning.`);
} else {
    // update versions.json with target version and minAppVersion from manifest.json
    // but only if the target version is not already in versions.json
    const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
    if (!(targetVersion in versions)) {
        versions[targetVersion] = minAppVersion;
        writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
    }

    // Tag documentation version in docs-site
    try {
        console.log(`[version-bump] Tagging docs-site version ${targetVersion}...`);
        execSync(`npx docusaurus docs:version ${targetVersion}`, { cwd: './docs-site', stdio: 'inherit' });
    } catch (e) {
        console.error('[version-bump] Failed to tag docs-site version:', e.message);
    }
}

