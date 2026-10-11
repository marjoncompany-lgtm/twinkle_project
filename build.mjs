import { mkdir, rm, copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const indexFile = path.join(root, 'index.html');
const productionFile = path.join(root, 'production.js');

async function readable(file) {
  try { await access(file, constants.R_OK); return true; }
  catch { return false; }
}

if (!(await readable(indexFile))) {
  throw new Error('Build failed: index.html must be in the repository root.');
}
if (!(await readable(productionFile))) {
  throw new Error('Build failed: production.js must be in the repository root. Upload the complete ZIP contents, not only selected files.');
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'src'), { recursive: true });
await copyFile(indexFile, path.join(dist, 'index.html'));
// index.html loads /src/production.js, so place the root-level source at that output path.
await copyFile(productionFile, path.join(dist, 'src', 'production.js'));
console.log('Build complete: dist/index.html and dist/src/production.js are ready for Cloudflare Pages.');
