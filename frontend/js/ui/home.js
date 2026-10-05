import { t } from '../i18n/i18n.js';
import { bindSituationForm, escapeAttr, escapeHtml, renderSituationForm } from './form.js';
import { icon } from './icons.js';
import { bindMediaFallbacks, bindMediaGallery, heroPath } from './media.js';
import { heroAtmosphereSvg, motifSvg } from './motifs.js';
import { bindReveals } from './motion.js';
import { bindCardThemes } from './palette.js';
import { ui } from './strings.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 */

/**
 * Render the Home view — modern split hero, marquee, bento mosaic.
 * @param {HTMLElement} root
 * @param {{
 *   situation: Situation,
 *   errors: Record<string, { key: string, vars?: Record<string, string | number> }>,
 *   lang: string,
 *   destinations?: object[],
 *   onChange: (partial: Partial<Situation>) => void,
 *   onSubmit: () => void,
 *   getSituation: () => Situation,
 * }} options
 */
export function renderHome(root, options) {
  root.hidden = false;
  const lang = options.lang === 'bn' ? 'bn' : 'en';
  const destinations = Array.isArray(options.destinations) ? options.destinations : [];

  root.innerHTML = `
    <section class="home home--modern" id="explore">
      <div class="hero hero--split">
        <div class="hero-photos" aria-hidden="true" data-hero-photos>
          ${heroPhotosHtml(destinations, lang)}
        </div>
        <div class="hero-photo-scrim" aria-hidden="true"></div>
        <div class="hero-atmosphere" aria-hidden="true">${heroAtmosphereSvg()}</div>
        <div class="hero-mesh" aria-hidden="true"></div>
        <div class="hero-grain" aria-hidden="true"></div>
        <div class="hero-orbs" aria-hidden="true">
          <span class="hero-orb hero-orb--a"></span>
          <span class="hero-orb hero-orb--b"></span>
          <span class="hero-orb hero-orb--c"></span>
        </div>

        <div class="hero-layout">
          <div class="hero-copy">
            <p class="hero-brand">${icon('compass')}<span>${escapeHtml(t('app.name'))}</span></p>
            <h1 class="hero-title">${accentTitle(t('hero.title'))}</h1>
            <p class="hero-lead">${escapeHtml(t('hero.lead'))}</p>
            <form class="home-form home-form--hero" novalidate>
              <header class="form-chrome">
                <span class="form-chrome-dot" aria-hidden="true"></span>
                <div class="form-chrome-text">
                  <span class="form-chrome-label">${escapeHtml(t('home.formLabel'))}</span>
                  <span class="form-chrome-sub">${escapeHtml(ui('sentenceLead'))}</span>
                </div>
              </header>
              <div data-form-mount></div>
            </form>
          </div>

          <div class="hero-visual" aria-hidden="true">
            <div class="hero-orbit"></div>
            ${floatStackHtml(destinations, lang)}
          </div>
        </div>

        ${marqueeHtml(destinations, lang)}
      </div>

      ${bentoHtml(destinations, lang)}

      <section class="section" id="how" aria-labelledby="how-title">
        <div class="section-inner">
          <header class="section-head section-head--wide" data-reveal>
            <p class="section-kicker">${escapeHtml(t('how.kicker'))}</p>
            <h2 id="how-title">${escapeHtml(t('how.title'))}</h2>
            <p>${escapeHtml(t('how.lead'))}</p>
            <p class="section-note">${icon('info')}<span>${escapeHtml(t('how.note'))}</span></p>
          </header>
          <ol class="feature-rail">
            <li class="feature-item" data-reveal>
              <div class="feature-top">
                <span class="feature-icon" aria-hidden="true">${icon('sliders', { className: 'icon--lg' })}</span>
                <p class="feature-step-label">${escapeHtml(t('how.kicker'))} · 01</p>
              </div>
              <h3>${escapeHtml(t('how.step1.title'))}</h3>
              <p>${escapeHtml(t('how.step1.body'))}</p>
              <ul class="feature-chips">
                <li>${icon('peaceful')}<span>${escapeHtml(t('how.step1.a'))}</span></li>
                <li>${icon('wallet')}<span>${escapeHtml(t('how.step1.b'))}</span></li>
                <li>${icon('map-pin')}<span>${escapeHtml(t('how.step1.c'))}</span></li>
              </ul>
            </li>
            <li class="feature-item" data-reveal>
              <div class="feature-top">
                <span class="feature-icon" aria-hidden="true">${icon('sparkles', { className: 'icon--lg' })}</span>
                <p class="feature-step-label">${escapeHtml(t('how.kicker'))} · 02</p>
              </div>
              <h3>${escapeHtml(t('how.step2.title'))}</h3>
              <p>${escapeHtml(t('how.step2.body'))}</p>
              <ul class="feature-chips">
                <li>${icon('shield')}<span>${escapeHtml(t('how.step2.a'))}</span></li>
                <li>${icon('compare')}<span>${escapeHtml(t('how.step2.b'))}</span></li>
                <li>${icon('star')}<span>${escapeHtml(t('how.step2.c'))}</span></li>
              </ul>
            </li>
            <li class="feature-item" data-reveal>
              <div class="feature-top">
                <span class="feature-icon" aria-hidden="true">${icon('route', { className: 'icon--lg' })}</span>
                <p class="feature-step-label">${escapeHtml(t('how.kicker'))} · 03</p>
              </div>
              <h3>${escapeHtml(t('how.step3.title'))}</h3>
              <p>${escapeHtml(t('how.step3.body'))}</p>
              <ul class="feature-chips">
                <li>${icon('check')}<span>${escapeHtml(t('how.step3.a'))}</span></li>
                <li>${icon('wallet')}<span>${escapeHtml(t('how.step3.b'))}</span></li>
                <li>${icon('info')}<span>${escapeHtml(t('how.step3.c'))}</span></li>
              </ul>
            </li>
          </ol>
        </div>
      </section>

      <section class="section section--contrast" id="about" aria-labelledby="about-title">
        <div class="section-inner">
          <div class="about-panel" data-reveal="scale">
            <header class="section-head section-head--wide">
              <p class="section-kicker">${escapeHtml(t('about.kicker'))}</p>
              <h2 id="about-title">${escapeHtml(t('about.title'))}</h2>
              <p>${escapeHtml(t('about.lead'))}</p>
            </header>
            <dl class="about-stats">
              <div class="about-stat">
                <dt>${escapeHtml(t('about.stat1.label'))}</dt>
                <dd>${escapeHtml(t('about.stat1.value'))}</dd>
              </div>
              <div class="about-stat">
                <dt>${escapeHtml(t('about.stat2.label'))}</dt>
                <dd>${escapeHtml(t('about.stat2.value'))}</dd>
              </div>
              <div class="about-stat">
                <dt>${escapeHtml(t('about.stat3.label'))}</dt>
                <dd>${escapeHtml(t('about.stat3.value'))}</dd>
              </div>
            </dl>
            <ul class="about-pillars">
              <li>
                <span class="about-pillar-icon" aria-hidden="true">${icon('map')}</span>
                <div>
                  <strong>${escapeHtml(t('about.pillar1.title'))}</strong>
                  <p>${escapeHtml(t('about.pillar1.body'))}</p>
                </div>
              </li>
              <li>
                <span class="about-pillar-icon" aria-hidden="true">${icon('eye')}</span>
                <div>
                  <strong>${escapeHtml(t('about.pillar2.title'))}</strong>
                  <p>${escapeHtml(t('about.pillar2.body'))}</p>
                </div>
              </li>
              <li>
                <span class="about-pillar-icon" aria-hidden="true">${icon('image')}</span>
                <div>
                  <strong>${escapeHtml(t('about.pillar3.title'))}</strong>
                  <p>${escapeHtml(t('about.pillar3.body'))}</p>
                </div>
              </li>
            </ul>
            <p class="about-footnote">${icon('info')}<span>${escapeHtml(t('about.footnote'))}</span></p>
          </div>
        </div>
      </section>
    </section>
  `;

  bindHeroSlideshow(root);
  bindMediaFallbacks(root);
  bindMediaGallery(root);
  bindCardThemes(root);

  const mount = root.querySelector('[data-form-mount]');
  if (!(mount instanceof HTMLElement)) {
    bindReveals(root);
    return;
  }

  renderSituationForm(mount, {
    situation: options.situation,
    errors: options.errors,
    idPrefix: 'home',
    showSubmit: true,
    lang: options.lang,
  });

  bindSituationForm(mount, {
    getSituation: options.getSituation,
    onChange: options.onChange,
    lang: options.lang,
  });

  const form = root.querySelector('.home-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    options.onSubmit();
  });

  bindReveals(root);
}

/**
 * Emphasize the last word of the title for a modern accent mark.
 * @param {string} title
 */
function accentTitle(title) {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 2) return escapeHtml(title);
  const last = parts.pop();
  return `${escapeHtml(parts.join(' '))} <span class="title-accent">${escapeHtml(last ?? '')}</span>`;
}

/**
 * Soft-animated destination photo slides for the hero background.
 * Uses GridFS via `/api/media/dest/<id>/hero` — missing files are skipped.
 * @param {object[]} destinations
 * @param {'en' | 'bn'} lang
 */
function heroPhotosHtml(destinations, lang) {
  return destinations
    .map((dest) => {
      const name = dest.name?.[lang] || dest.name?.en || dest.id;
      return `
        <figure class="hero-photo is-pending" data-hero-photo data-dest="${escapeAttr(dest.id)}">
          <img
            src="${escapeAttr(heroPath(dest.id))}"
            alt=""
            width="1600"
            height="900"
            decoding="async"
            fetchpriority="low"
          >
          <figcaption class="sr-only">${escapeHtml(name)}</figcaption>
        </figure>`;
    })
    .join('');
}

/**
 * Crossfade ready hero photos. Falls back to gradient atmosphere when none load.
 * @param {ParentNode} root
 */
function bindHeroSlideshow(root) {
  const hero = root.querySelector('.hero--split');
  const stage = root.querySelector('[data-hero-photos]');
  if (!(hero instanceof HTMLElement) || !(stage instanceof HTMLElement)) return;

  /** @type {HTMLElement[]} */
  const ready = [];
  const slides = [...stage.querySelectorAll('[data-hero-photo]')].filter(
    (node) => node instanceof HTMLElement,
  );

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;
  let cycling = false;

  const show = (nextIndex) => {
    ready.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === nextIndex);
    });
  };

  const ensureCycle = () => {
    if (ready.length === 0) return;
    hero.classList.add('has-photos');
    if (!cycling) {
      cycling = true;
      index = 0;
      show(0);
    }
    if (timer) clearInterval(timer);
    if (reduce || ready.length < 2) return;
    timer = setInterval(() => {
      index = (index + 1) % ready.length;
      show(index);
    }, 6000);
  };

  slides.forEach((slide) => {
    const img = slide.querySelector('img');
    if (!(img instanceof HTMLImageElement)) {
      slide.remove();
      return;
    }

    const accept = () => {
      if (img.naturalWidth === 0) {
        slide.remove();
        return;
      }
      slide.classList.remove('is-pending');
      slide.classList.add('is-ready');
      if (!ready.includes(slide)) ready.push(slide);
      ensureCycle();
    };

    const reject = () => {
      slide.remove();
    };

    if (img.complete) {
      if (img.naturalWidth > 0) accept();
      else reject();
    } else {
      img.addEventListener('load', accept, { once: true });
      img.addEventListener('error', reject, { once: true });
    }
  });
}

/**
 * @param {object[]} destinations
 * @param {'en' | 'bn'} lang
 */
function floatStackHtml(destinations, lang) {
  const picks = destinations.slice(0, 3);
  if (picks.length === 0) return '';
  return `
    <div class="float-stack">
      ${picks
        .map((dest, index) => {
          const name = dest.name?.[lang] || dest.name?.en || dest.id;
          return `
          <article class="float-card float-card--${index + 1}" data-dest="${escapeAttr(dest.id)}">
            <div class="float-media">
              <div class="float-fallback" aria-hidden="true">${motifSvg(dest.id)}</div>
              <img
                class="float-photo"
                src="${escapeAttr(heroPath(dest.id))}"
                alt=""
                width="640"
                height="400"
                loading="eager"
                decoding="async"
                data-media="hero"
              >
            </div>
            <div class="float-meta">
              <span class="float-rank">0${index + 1}</span>
              <strong>${escapeHtml(name)}</strong>
            </div>
          </article>`;
        })
        .join('')}
    </div>`;
}

/**
 * @param {object[]} destinations
 * @param {'en' | 'bn'} lang
 */
function marqueeHtml(destinations, lang) {
  if (destinations.length === 0) return '';
  const names = destinations.map((d) => d.name?.[lang] || d.name?.en || d.id);
  const items = [...names, ...names]
    .map((name) => `<span class="marquee-item">${icon('map-pin')}<span>${escapeHtml(name)}</span></span>`)
    .join('');
  return `
    <div class="hero-marquee" aria-label="${escapeAttr(t('mosaic.title'))}">
      <div class="marquee-track">${items}</div>
    </div>`;
}

/**
 * @param {object[]} destinations
 * @param {'en' | 'bn'} lang
 */
function bentoHtml(destinations, lang) {
  if (destinations.length === 0) return '';
  const cards = destinations
    .slice(0, 10)
    .map((dest) => {
      const name = dest.name?.[lang] || dest.name?.en || dest.id;
      const place = [dest.district, dest.division].filter(Boolean).join(' · ');
      return `
        <li class="bento-card" data-reveal="scale">
          <button
            type="button"
            class="bento-open"
            data-gallery-open
            data-gallery-dest="${escapeAttr(dest.id)}"
            data-gallery-name="${escapeAttr(name)}"
            data-gallery-index="0"
            aria-label="${escapeAttr(t('gallery.open', { name }))}"
          >
            <div class="bento-media">
              <div class="bento-fallback" aria-hidden="true">${motifSvg(dest.id)}</div>
              <img
                class="bento-photo"
                src="${escapeAttr(heroPath(dest.id))}"
                alt=""
                loading="lazy"
                decoding="async"
                data-media="hero"
              >
            </div>
            <div class="bento-copy">
              <strong>${escapeHtml(name)}</strong>
              ${place ? `<span>${escapeHtml(place)}</span>` : ''}
            </div>
            <span class="media-view-cue" aria-hidden="true">${icon('image')}${escapeHtml(
              t('gallery.view'),
            )}</span>
          </button>
        </li>`;
    })
    .join('');

  return `
    <section class="mosaic mosaic--bento" aria-labelledby="mosaic-title">
      <div class="mosaic-inner">
        <header class="mosaic-head" data-reveal>
          <div>
            <p class="section-kicker">${escapeHtml(t('mosaic.kicker'))}</p>
            <h2 id="mosaic-title">${escapeHtml(t('mosaic.title'))}</h2>
          </div>
          <p>${escapeHtml(t('mosaic.lead'))}</p>
        </header>
        <ul class="bento-grid" aria-label="${escapeAttr(t('mosaic.title'))}">
          ${cards}
        </ul>
      </div>
    </section>`;
}
