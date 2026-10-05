/**
 * Build an inline SVG sprite from Lucide (MIT) icons.
 * Usage: node scripts/build-icons.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = path.join(root, 'node_modules', 'lucide-static', 'icons');
const outDir = path.join(root, 'frontend', 'assets');
const outFile = path.join(outDir, 'icons.svg');

/** @type {Record<string, string>} logical name → lucide file stem */
const ICONS = {
  // Moods
  peaceful: 'leaf',
  adventure: 'mountain',
  cultural: 'landmark',
  social: 'users',
  // Activities
  photography: 'camera',
  hiking: 'footprints',
  boating: 'sailboat',
  food: 'utensils',
  history: 'book-open',
  beach: 'palmtree',
  wildlife: 'bird',
  relaxing: 'coffee',
  // UI
  'map-pin': 'map-pin',
  clock: 'clock',
  wallet: 'wallet',
  calendar: 'calendar',
  share: 'share-2',
  compare: 'git-compare',
  info: 'info',
  warning: 'triangle-alert',
  language: 'languages',
  sun: 'sun',
  moon: 'moon',
  cloud: 'cloud',
  'cloud-sun': 'cloud-sun',
  'cloud-rain': 'cloud-rain',
  'cloud-fog': 'cloud-fog',
  'cloud-lightning': 'cloud-lightning',
  'cloud-snow': 'cloud-snow',
  wind: 'wind',
  droplet: 'droplet',
  close: 'x',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  compass: 'compass',
  sparkles: 'sparkles',
  route: 'route',
  check: 'check',
  map: 'map',
  image: 'image',
  star: 'star',
  mail: 'mail',
  lock: 'lock',
  eye: 'eye',
  'eye-off': 'eye-off',
  user: 'user',
  phone: 'phone',
  'log-in': 'log-in',
  'log-out': 'log-out',
  key: 'key',
  shield: 'shield-check',
  sliders: 'sliders-horizontal',
  refresh: 'refresh-cw',
};

/**
 * @param {string} svg
 * @param {string} id
 */
function toSymbol(svg, id) {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch?.[1] ?? '0 0 24 24';
  const inner = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>/i, '')
    .replace(/\sfill="none"/g, '')
    .replace(/\sstroke="currentColor"/g, '')
    .replace(/\sstroke-width="2"/g, '')
    .replace(/\sstroke-linecap="round"/g, '')
    .replace(/\sstroke-linejoin="round"/g, '')
    .trim();

  return `<symbol id="icon-${id}" viewBox="${viewBox}">${inner}</symbol>`;
}

async function main() {
  const symbols = [];
  for (const [name, fileStem] of Object.entries(ICONS)) {
    const filePath = path.join(iconDir, `${fileStem}.svg`);
    const svg = await readFile(filePath, 'utf8');
    symbols.push(toSymbol(svg, name));
  }

  const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
${symbols.join('\n')}
</svg>
`;

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, sprite, 'utf8');
  console.log(`Wrote ${Object.keys(ICONS).length} icons → ${path.relative(root, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
