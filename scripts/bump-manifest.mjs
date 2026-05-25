// Runs automatically as part of `npm version patch/minor/major`
// before npm creates the version commit — keeps manifest.json in sync.
import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

manifest.version = pkg.version;

writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json synced to version ${pkg.version}`);
