/**
 * Convert frontend/assets/img-source → frontend/assets/img/<destId>/{hero,spot-N}.webp
 * Does not modify img-source. Source folder "cox-bazar" maps to destination id "coxs-bazar".
 *
 * Usage: node scripts/prepare-images.mjs
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'frontend', 'assets', 'img-source');
const outRoot = path.join(root, 'frontend', 'assets', 'img');

/** Source folder name → destination id used by the app / GridFS */
const FOLDER_TO_DEST = Object.freeze({
  bandarban: 'bandarban',
  'cox-bazar': 'coxs-bazar',
  jaflong: 'jaflong',
  kuakata: 'kuakata',
  paharpur: 'paharpur',
  rangamati: 'rangamati',
  'saint-martin': 'saint-martin',
  sonargaon: 'sonargaon',
  sreemangal: 'sreemangal',
  sundarbans: 'sundarbans',
});

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

/**
 * @param {string} filename
 * @returns {'hero' | `spot-${number}` | null}
 */
function kindFromFilename(filename) {
  const base = filename.replace(IMAGE_EXT, '').toLowerCase();
  if (base === 'hero' || base.startsWith('hero-')) return 'hero';
  const spot = base.match(/^spot-([1-4])(?:-|$)/);
  if (spot) return /** @type {`spot-${number}`} */ (`spot-${spot[1]}`);
  return null;
}

async function main() {
  const folders = await readdir(sourceRoot, { withFileTypes: true });
  let written = 0;
  let skipped = 0;

  for (const dirent of folders) {
    if (!dirent.isDirectory()) continue;
    const destId = FOLDER_TO_DEST[dirent.name];
    if (!destId) {
      console.warn(`skip unknown folder: ${dirent.name}`);
      skipped += 1;
      continue;
    }

    const srcDir = path.join(sourceRoot, dirent.name);
    const outDir = path.join(outRoot, destId);
    await mkdir(outDir, { recursive: true });

    const files = await readdir(srcDir);
    for (const file of files) {
      if (!IMAGE_EXT.test(file)) continue;
      const kind = kindFromFilename(file);
      if (!kind) {
        console.warn(`skip unrecognized file: ${dirent.name}/${file}`);
        skipped += 1;
        continue;
      }

      const input = path.join(srcDir, file);
      const output = path.join(outDir, `${kind}.webp`);
      await sharp(input)
        .rotate()
        .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(output);
      written += 1;
      console.log(`${dirent.name}/${file} → img/${destId}/${kind}.webp`);
    }
  }

  console.log(`Done. written=${written} skipped=${skipped}`);
}

await main();
