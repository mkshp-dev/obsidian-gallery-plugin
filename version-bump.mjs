import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

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

