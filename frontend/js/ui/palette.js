/**
 * Extract a readable accent palette from a loaded image and apply it to result cards.
 * Same-origin media only (MongoDB GridFS via /api/media).
 */

/** @type {Map<string, CardPalette>} */
const cache = new Map();

/**
 * @typedef {{
 *   accent: string,
 *   accentDeep: string,
 * }} CardPalette
 */

/**
 * Bind image-driven themes onto `.result-card` and hero `.float-card` nodes.
 * @param {ParentNode} [root=document]
 */
export function bindCardThemes(root = document) {
  root.querySelectorAll('.result-card').forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    bindHeroTheme(card, (palette) => {
      card.style.setProperty('--card-accent', palette.accent);
      card.style.setProperty('--card-accent-deep', palette.accentDeep);
      card.classList.add('is-themed');
    });
  });

  root.querySelectorAll('.float-card').forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    bindHeroTheme(card, (palette) => {
      card.style.setProperty('--float-accent', palette.accent);
      card.classList.add('is-themed');
    });
  });
}

/**
 * @param {HTMLElement} card
 * @param {(palette: CardPalette) => void} apply
 */
function bindHeroTheme(card, apply) {
  const img = card.querySelector('[data-media="hero"]');
  if (!(img instanceof HTMLImageElement)) return;

  const run = () => {
    if (img.hidden || img.naturalWidth === 0) return;
    const destId = card.getAttribute('data-dest') || img.src;
    let palette = cache.get(destId);
    if (!palette) {
      palette = extractPalette(img);
      if (!palette) return;
      cache.set(destId, palette);
    }
    apply(palette);
  };

  if (img.complete) run();
  else img.addEventListener('load', run, { once: true });
}

/**
 * @param {HTMLImageElement} img
 * @returns {CardPalette | null}
 */
function extractPalette(img) {
  try {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    /** @type {Map<number, { count: number, r: number, g: number, b: number, sat: number }>} */
    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const { h, s, l } = rgbToHsl(r, g, b);
      if (s < 0.14 || l < 0.12 || l > 0.88) continue;
      const key = Math.round(h / 12) * 12;
      const prev = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, sat: 0 };
      prev.count += 1;
      prev.r += r;
      prev.g += g;
      prev.b += b;
      prev.sat += s;
      buckets.set(key, prev);
    }

    let best = null;
    let bestScore = 0;
    for (const entry of buckets.values()) {
      const avgSat = entry.sat / entry.count;
      const score = entry.count * (0.55 + avgSat);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (!best || best.count < 4) {
      // Fallback: average of mid-tone pixels
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const lum = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
        if (lum < 0.18 || lum > 0.82) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
      if (n < 4) return null;
      best = { count: n, r, g, b, sat: n * 0.35 };
    }

    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    return buildPalette(r, g, b);
  } catch {
    // Tainted canvas / decode errors — leave default theme
    return null;
  }
}

/**
 * Build accessible accent colors from a sample RGB.
 * Soft surfaces are derived in CSS so light/dark themes stay readable.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {CardPalette}
 */
function buildPalette(r, g, b) {
  const { h, s } = rgbToHsl(r, g, b);
  const sat = Math.min(0.72, Math.max(0.4, s));
  return {
    accent: hslToCss(h, sat, 0.44),
    accentDeep: hslToCss(h, Math.min(0.8, sat + 0.1), 0.3),
  };
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/**
 * @param {number} h
 * @param {number} s
 * @param {number} l
 */
function hslToCss(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}
