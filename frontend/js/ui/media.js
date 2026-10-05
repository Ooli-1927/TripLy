import { apiUrl } from '../config.js';
import { t } from '../i18n/i18n.js';
import { escapeAttr, escapeHtml } from './form.js';
import { openLightbox } from './lightbox.js';
import { motifSvg, motifTypeFor } from './motifs.js';

/**
 * Destination images are collected from MongoDB GridFS via API URLs.
 * Seed from frontend/assets/img/<id>/… with `npm run seed:images`.
 * Missing files fall back to animated SVG motifs — never invent URLs or credits.
 */

const SPOT_COUNT = 4;

/**
 * @param {string} destId
 * @returns {string}
 */
export function heroPath(destId) {
  return apiUrl(`/api/media/dest/${encodeURIComponent(destId)}/hero`);
}

/**
 * @param {string} destId
 * @param {number} index 1..4
 * @returns {string}
 */
export function spotPath(destId, index) {
  return apiUrl(`/api/media/dest/${encodeURIComponent(destId)}/spot-${index}`);
}

/**
 * Build gallery slides for a destination. When `frame` is given, photo readiness
 * is read from the live media DOM; otherwise the lightbox probes each file.
 * @param {string} destId
 * @param {HTMLElement | null} [frame]
 * @returns {import('./lightbox.js').GallerySlide[]}
 */
export function buildDestSlides(destId, frame = null) {
  const motif = frame?.querySelector('.media-fallback')?.innerHTML || motifSvg(destId);
  const heroImg = frame?.querySelector('[data-media="hero"]');
  const hasHero = frame
    ? frame.classList.contains('has-photo') &&
      heroImg instanceof HTMLImageElement &&
      !heroImg.hidden
    : undefined;

  /** @type {import('./lightbox.js').GallerySlide[]} */
  const slides = [
    {
      label: t('gallery.hero'),
      photoSrc: heroPath(destId),
      motifHtml: motif,
      hasPhoto: hasHero,
    },
  ];

  for (let n = 1; n <= SPOT_COUNT; n += 1) {
    const thumb = frame?.querySelector(`[data-spot="${n}"]`);
    const hasSpot = frame ? Boolean(thumb && !thumb.classList.contains('is-empty')) : undefined;
    slides.push({
      label: `${t('results.spot')} ${n}`,
      photoSrc: spotPath(destId, n),
      motifHtml: motifSvg(destId),
      hasPhoto: hasSpot,
    });
  }

  return slides;
}

/**
 * Open the destination photo gallery.
 * @param {{ id: string, name: string, startIndex?: number, frame?: HTMLElement | null }} options
 */
export function openDestGallery(options) {
  openLightbox({
    title: options.name,
    slides: buildDestSlides(options.id, options.frame ?? null),
    startIndex: options.startIndex ?? 0,
  });
}

/**
 * Destination media frame: optional photo + animated motif fallback + spot strip.
 * @param {{
 *   id: string,
 *   name: string,
 *   rank?: number,
 *   spotLabel: string,
 *   photoSoonLabel: string,
 * }} options
 * @returns {string}
 */
export function destMediaHtml(options) {
  const { id, name, rank, spotLabel, photoSoonLabel } = options;
  const type = motifTypeFor(id);
  const spots = Array.from({ length: SPOT_COUNT }, (_, i) => {
    const n = i + 1;
    return `
      <button
        type="button"
        class="spot-thumb is-empty"
        data-spot="${n}"
        data-gallery-open
        data-gallery-index="${n}"
        aria-label="${escapeAttr(`${name} — ${spotLabel} ${n}`)}"
      >
        <img
          class="spot-thumb-img"
          src="${escapeAttr(spotPath(id, n))}"
          alt=""
          loading="lazy"
          decoding="async"
          data-media="spot"
        >
        <span class="spot-thumb-cap">${escapeHtml(spotLabel)} ${n}</span>
      </button>`;
  }).join('');

  return `
    <div
      class="media-frame motif-${escapeAttr(type)}"
      data-dest="${escapeAttr(id)}"
      data-dest-name="${escapeAttr(name)}"
    >
      ${rank != null ? `<span class="rank-badge" aria-hidden="true">#${rank}</span>` : ''}
      <button
        type="button"
        class="media-stage"
        data-gallery-open
        data-gallery-index="0"
        aria-label="${escapeAttr(t('gallery.open', { name }))}"
      >
        <div class="media-fallback" aria-hidden="true">${motifSvg(id)}</div>
        <img
          class="media-photo"
          src="${escapeAttr(heroPath(id))}"
          alt="${escapeAttr(name)}"
          loading="lazy"
          decoding="async"
          data-media="hero"
        >
        <p class="media-photo-soon" hidden>${escapeHtml(photoSoonLabel)}</p>
        <span class="media-view-cue" aria-hidden="true">${iconCue()}${escapeHtml(t('gallery.view'))}</span>
      </button>
      <div class="spot-strip" aria-label="${escapeAttr(spotLabel)}">
        ${spots}
      </div>
    </div>`;
}

/** @returns {string} */
function iconCue() {
  return `<svg class="icon" aria-hidden="true" focusable="false"><use href="assets/icons.svg#icon-image"></use></svg>`;
}

/**
 * Wire image load/error so missing local files keep the motif fallback.
 * @param {ParentNode} root
 */
export function bindMediaFallbacks(root) {
  root.querySelectorAll('[data-media="hero"]').forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    const frame = node.closest('.media-frame, .bento-card, .float-card');
    const soon = frame?.querySelector('.media-photo-soon');
    const markFallback = () => {
      frame?.classList.add('is-fallback');
      node.hidden = true;
      if (soon instanceof HTMLElement) soon.hidden = false;
    };
    if (node.complete) {
      if (node.naturalWidth === 0) markFallback();
      else frame?.classList.add('has-photo');
    } else {
      node.addEventListener('load', () => frame?.classList.add('has-photo'), { once: true });
      node.addEventListener('error', markFallback, { once: true });
    }
  });

  root.querySelectorAll('[data-media="spot"]').forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    const thumb = node.closest('.spot-thumb');
    const markEmpty = () => thumb?.classList.add('is-empty');
    const markReady = () => thumb?.classList.remove('is-empty');
    if (node.complete) {
      if (node.naturalWidth === 0) markEmpty();
      else markReady();
    } else {
      node.addEventListener('load', markReady, { once: true });
      node.addEventListener('error', markEmpty, { once: true });
    }
  });
}

/**
 * Open lightbox when hero/spot media is clicked.
 * @param {ParentNode} root
 */
export function bindMediaGallery(root) {
  root.querySelectorAll('[data-gallery-open]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const trigger = /** @type {HTMLElement} */ (event.currentTarget);
      const frame = trigger.closest('.media-frame');
      const destId =
        frame?.getAttribute('data-dest') || trigger.getAttribute('data-gallery-dest') || '';
      const name =
        frame?.getAttribute('data-dest-name') ||
        trigger.getAttribute('data-gallery-name') ||
        destId;
      if (!destId) return;

      const startIndex = Number(trigger.getAttribute('data-gallery-index') || '0');
      openDestGallery({
        id: destId,
        name,
        startIndex: Number.isFinite(startIndex) ? startIndex : 0,
        frame: frame instanceof HTMLElement ? frame : null,
      });
    });
  });
}
