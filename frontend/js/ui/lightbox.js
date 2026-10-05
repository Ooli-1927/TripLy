import { escapeAttr, escapeHtml } from './form.js';
import { icon } from './icons.js';
import { t } from '../i18n/i18n.js';

/**
 * @typedef {{
 *   label: string,
 *   photoSrc?: string,
 *   motifHtml?: string,
 *   hasPhoto?: boolean,
 * }} GallerySlide
 */

/**
 * Open an accessible image gallery dialog.
 * @param {{
 *   title: string,
 *   slides: GallerySlide[],
 *   startIndex?: number,
 * }} options
 */
export function openLightbox(options) {
  const slides = options.slides.filter(Boolean);
  if (slides.length === 0) return;

  let index = Math.min(Math.max(options.startIndex ?? 0, 0), slides.length - 1);
  document.querySelector('#triply-lightbox')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'triply-lightbox';
  dialog.className = 'lightbox';
  dialog.innerHTML = `
    <div class="lightbox-shell">
      <header class="lightbox-top">
        <div class="lightbox-heading">
          <p class="lightbox-kicker">${escapeHtml(t('gallery.label'))}</p>
          <h2 class="lightbox-title">${escapeHtml(options.title)}</h2>
        </div>
        <button type="button" class="lightbox-close btn-ghost" data-lightbox="close" aria-label="${escapeAttr(
          t('gallery.close'),
        )}">${icon('close')}</button>
      </header>
      <div class="lightbox-stage" data-lightbox-stage></div>
      <div class="lightbox-nav">
        <button type="button" class="lightbox-btn" data-lightbox="prev" aria-label="${escapeAttr(
          t('gallery.prev'),
        )}">${icon('arrow-left')}</button>
        <p class="lightbox-count" data-lightbox-count></p>
        <button type="button" class="lightbox-btn" data-lightbox="next" aria-label="${escapeAttr(
          t('gallery.next'),
        )}">${icon('arrow-right')}</button>
      </div>
      <div class="lightbox-thumbs" data-lightbox-thumbs role="tablist" aria-label="${escapeAttr(
        t('gallery.label'),
      )}"></div>
    </div>
  `;

  document.body.appendChild(dialog);

  const stage = dialog.querySelector('[data-lightbox-stage]');
  const count = dialog.querySelector('[data-lightbox-count]');
  const thumbs = dialog.querySelector('[data-lightbox-thumbs]');
  let paintToken = 0;

  /**
   * @param {GallerySlide} slide
   * @param {(ok: boolean) => void} done
   */
  const resolvePhoto = (slide, done) => {
    if (!slide.photoSrc || slide.hasPhoto === false) {
      done(false);
      return;
    }
    if (slide.hasPhoto === true) {
      done(true);
      return;
    }
    const probe = new Image();
    probe.onload = () => done(true);
    probe.onerror = () => done(false);
    probe.src = slide.photoSrc;
  };

  const paint = () => {
    const slide = slides[index];
    if (!(stage instanceof HTMLElement) || !slide) return;
    const token = ++paintToken;

    if (count) {
      count.textContent = t('gallery.of', { current: index + 1, total: slides.length });
    }

    stage.innerHTML = `<div class="lightbox-loading" aria-hidden="true"></div>`;

    resolvePhoto(slide, (ok) => {
      if (token !== paintToken) return;
      if (ok && slide.photoSrc) {
        stage.innerHTML = `<img class="lightbox-image" src="${escapeAttr(slide.photoSrc)}" alt="${escapeAttr(
          `${options.title} — ${slide.label}`,
        )}">`;
      } else if (slide.motifHtml) {
        stage.innerHTML = `<div class="lightbox-motif">${slide.motifHtml}</div>`;
      } else {
        stage.innerHTML = `<p class="lightbox-empty">${escapeHtml(t('gallery.empty'))}</p>`;
      }
    });

    if (thumbs instanceof HTMLElement) {
      thumbs.innerHTML = slides
        .map((item, i) => {
          const active = i === index ? 'is-active' : '';
          const showPhoto = item.hasPhoto !== false && item.photoSrc;
          const preview = showPhoto
            ? `<img src="${escapeAttr(item.photoSrc || '')}" alt="" loading="lazy" data-thumb-img>`
            : item.motifHtml || '';
          return `<button type="button" class="lightbox-thumb ${active}" data-lightbox-index="${i}" aria-label="${escapeAttr(
            item.label,
          )}"${i === index ? ' aria-current="true"' : ''}>${preview}<span>${escapeHtml(
            item.label,
          )}</span></button>`;
        })
        .join('');

      thumbs.querySelectorAll('[data-thumb-img]').forEach((node) => {
        if (!(node instanceof HTMLImageElement)) return;
        const parent = node.parentElement;
        const slideIndex = Number(parent?.getAttribute('data-lightbox-index'));
        const fallback = slides[slideIndex]?.motifHtml;
        const swap = () => {
          if (fallback) node.replaceWith(...Array.from(createFragment(fallback).childNodes));
          else node.remove();
        };
        if (node.complete && node.naturalWidth === 0) swap();
        else node.addEventListener('error', swap, { once: true });
      });
    }
  };

  /**
   * @param {string} html
   * @returns {DocumentFragment}
   */
  function createFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }

  const go = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    paint();
  };

  dialog.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target === dialog) {
      dialog.close();
      return;
    }
    const action = target.closest('[data-lightbox]')?.getAttribute('data-lightbox');
    if (action === 'close') dialog.close();
    if (action === 'prev') go(index - 1);
    if (action === 'next') go(index + 1);
    const thumb = target.closest('[data-lightbox-index]');
    if (thumb) go(Number(thumb.getAttribute('data-lightbox-index')));
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    }
  });

  dialog.addEventListener('close', () => {
    dialog.remove();
  });

  paint();
  dialog.showModal();
  dialog.querySelector('[data-lightbox="close"]')?.focus();
}
