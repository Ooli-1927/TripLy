import {
  CONFIG,
  collectWarnings,
  estimateTrip,
  scoreDestination,
} from '../engine/index.js';
import { t } from '../i18n/i18n.js';
import { formatNumber } from '../utils/format.js';
import { escapeAttr, escapeHtml } from './form.js';
import { icon } from './icons.js';
import { bindMediaFallbacks, bindMediaGallery, destMediaHtml } from './media.js';
import { bindReveals } from './motion.js';
import { showToast } from './toast.js';
import { mountWeather, weatherSlotHtml } from './weather.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 */

const FACTOR_KEYS = /** @type {const} */ (['tag', 'budget', 'time', 'season', 'offbeat']);

const TAG_KEYS = Object.freeze([
  'peaceful',
  'adventure',
  'cultural',
  'social',
  'photography',
  'hiking',
  'boating',
  'food',
  'history',
  'beach',
  'wildlife',
  'relaxing',
]);

const PERMIT_BY_CODE = Object.freeze({
  [CONFIG.permitCode.travel_pass]: 'travel_pass',
  [CONFIG.permitCode.permission_required]: 'permission_required',
  [CONFIG.permitCode.none]: 'none',
});

/**
 * Render the Destination Detail view.
 * @param {HTMLElement} root
 * @param {{
 *   destination: object,
 *   situation: Situation,
 *   lang: string,
 *   weights?: object,
 *   onBack: () => void,
 * }} options
 */
export function renderDestination(root, options) {
  root.hidden = false;
  const lang = options.lang === 'bn' ? 'bn' : 'en';
  const altLang = lang === 'bn' ? 'en' : 'bn';
  const dest = options.destination;
  const situation = options.situation;
  const name = dest.name?.[lang] || dest.name?.en || dest.id;
  const altName = dest.name?.[altLang] || '';
  const scored = scoreDestination(situation, dest, options.weights);
  const estimates = estimateTrip(situation, dest);
  const transport = estimates.roadKm * 2 * CONFIG.costPerKmBdt;
  const stayFood = situation.days * (dest.dailyCost ?? 0);
  const warnings = collectWarnings(dest);
  const summary = dest.summary?.[lang] || dest.summary?.en || '';
  const tips = dest.tips?.[lang] || dest.tips?.en || '';

  root.innerHTML = `
    <article class="dest-detail" data-dest-id="${escapeAttr(dest.id)}" data-reveal>
      <header class="dest-hero dest-hero--split" style="view-transition-name: dest-hero-${escapeAttr(dest.id)}">
        <div class="dest-hero-toolbar">
          <button type="button" class="btn-ghost dest-back" data-action="back">
            ${icon('arrow-left')}<span>${escapeHtml(t('dest.back'))}</span>
          </button>
          <button type="button" class="btn-secondary dest-share" data-action="share">
            ${icon('share')}<span>${escapeHtml(t('dest.share'))}</span>
          </button>
        </div>
        <div class="dest-hero-intro">
          <p class="dest-kicker">${escapeHtml(t('dest.kicker'))}</p>
          <h1 class="dest-title">${escapeHtml(name)}</h1>
          ${
            altName
              ? `<p class="dest-title-alt" lang="${altLang}">${escapeHtml(altName)}</p>`
              : ''
          }
          <div class="dest-meta">
            <span class="dest-place">${icon('map-pin')}<span>${escapeHtml(
              [dest.district, dest.division].filter(Boolean).join(' · '),
            )}</span></span>
            <span class="tier-badge tier-${escapeAttr(dest.popularityTier || 'hidden')}">${escapeHtml(
              t(`results.tier.${dest.popularityTier || 'hidden'}`),
            )}</span>
          </div>
          ${
            summary
              ? `<p class="dest-lead">${escapeHtml(summary)}</p>`
              : ''
          }
          ${weatherSlotHtml({
            id: dest.id,
            lat: dest.lat,
            lng: dest.lng,
            className: 'weather-slot--detail',
          })}
          <div class="dest-hero-score">
            ${fitRingSvg(Math.round(scored.total))}
          </div>
        </div>
        <div class="dest-hero-media">
          ${destMediaHtml({
            id: dest.id,
            name,
            spotLabel: t('results.spot'),
            photoSoonLabel: t('results.photoSoon'),
          })}
        </div>
      </header>

      <div class="dest-body">
        <div class="dest-tabs-wrap" data-reveal>
          <div class="tabs" role="tablist" aria-label="${escapeAttr(t('dest.tabsLabel'))}">
            ${tabButton('overview', t('dest.tab.overview'), true)}
            ${tabButton('cost', t('dest.tab.cost'), false)}
            ${tabButton('season', t('dest.tab.season'), false)}
            ${tabButton('gallery', t('dest.tab.gallery'), false)}
            ${tabButton('tips', t('dest.tab.tips'), false)}
          </div>

          <div
            class="tab-panel dest-panel"
            role="tabpanel"
            id="dest-panel-overview"
            aria-labelledby="dest-tab-overview"
          >
            ${overviewPanel(dest, summary, warnings, lang)}
          </div>
          <div
            class="tab-panel dest-panel"
            role="tabpanel"
            id="dest-panel-cost"
            aria-labelledby="dest-tab-cost"
            hidden
          >
            ${costPanel(estimates, transport, stayFood, situation, lang)}
          </div>
          <div
            class="tab-panel dest-panel"
            role="tabpanel"
            id="dest-panel-season"
            aria-labelledby="dest-tab-season"
            hidden
          >
            ${seasonPanel(dest, situation.month, lang)}
          </div>
          <div
            class="tab-panel dest-panel"
            role="tabpanel"
            id="dest-panel-gallery"
            aria-labelledby="dest-tab-gallery"
            hidden
          >
            ${galleryPanel(dest, name)}
          </div>
          <div
            class="tab-panel dest-panel"
            role="tabpanel"
            id="dest-panel-tips"
            aria-labelledby="dest-tab-tips"
            hidden
          >
            <p class="dest-tips">${escapeHtml(tips || t('dest.tipsEmpty'))}</p>
          </div>
        </div>

        <section class="dest-radar" aria-labelledby="dest-radar-title">
          <h2 id="dest-radar-title">${escapeHtml(t('dest.radar.title'))}</h2>
          <p class="dest-radar-lead">${escapeHtml(t('dest.radar.lead'))}</p>
          <div class="dest-radar-layout">
            ${radarSvg(scored.factors)}
            ${factorTable(scored, lang)}
          </div>
        </section>
      </div>
    </article>
  `;

  bindMediaFallbacks(root);
  bindMediaGallery(root);
  bindTabs(root);
  bindReveals(root);
  mountWeather(root, lang);
  root.querySelector('[data-action="back"]')?.addEventListener('click', () => options.onBack());
  root.querySelector('[data-action="share"]')?.addEventListener('click', () => shareDestination(name));
}

/**
 * @param {string} id
 * @param {string} label
 * @param {boolean} selected
 */
function tabButton(id, label, selected) {
  return `
    <button
      type="button"
      class="tab"
      role="tab"
      id="dest-tab-${id}"
      aria-controls="dest-panel-${id}"
      aria-selected="${selected ? 'true' : 'false'}"
      tabindex="${selected ? '0' : '-1'}"
      data-tab="${id}"
    >${escapeHtml(label)}</button>
  `;
}

/**
 * @param {ParentNode} root
 */
function bindTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];

  /**
   * @param {string} id
   */
  const activate = (id) => {
    tabs.forEach((tab) => {
      const selected = tab.getAttribute('data-tab') === id;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      if (selected && tab instanceof HTMLElement) tab.focus({ preventScroll: true });
    });
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      panel.hidden = panel.id !== `dest-panel-${id}`;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      if (id) activate(id);
    });
    tab.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      const idx = tabs.indexOf(tab);
      let next = -1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (idx + 1) % tabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (idx - 1 + tabs.length) % tabs.length;
      }
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      event.preventDefault();
      const target = tabs[next];
      const id = target?.getAttribute('data-tab');
      if (id) activate(id);
    });
  });
}

/**
 * @param {object} dest
 * @param {string} summary
 * @param {Array<{ code: string, values: Record<string, number> }>} warnings
 * @param {'en' | 'bn'} lang
 */
function overviewPanel(dest, summary, warnings, lang) {
  const tags = TAG_KEYS.filter((key) => (dest.tags?.[key] ?? 0) >= 0.35);
  const chips =
    tags.length > 0
      ? `<ul class="dest-tags">
          ${tags
            .map(
              (tag) => `
            <li class="dest-tag">
              ${icon(tag)}
              <span>${escapeHtml(tagLabel(tag))}</span>
              <span class="dest-tag-score">${escapeHtml(
                formatNumber(Math.round((dest.tags[tag] ?? 0) * 100), lang),
              )}%</span>
            </li>`,
            )
            .join('')}
        </ul>`
      : `<p class="dest-empty">${escapeHtml(t('dest.tagsEmpty'))}</p>`;

  const notice =
    warnings.length > 0
      ? `<ul class="notice-list">${warnings.map((w) => warningHtml(w)).join('')}</ul>`
      : '';

  return `
    <p class="dest-summary">${escapeHtml(summary)}</p>
    <h3 class="dest-subhead">${escapeHtml(t('dest.tagsHeading'))}</h3>
    ${chips}
    ${notice}
  `;
}

/**
 * @param {{ oneWayHours: number, estCost: number, roadKm: number }} estimates
 * @param {number} transport
 * @param {number} stayFood
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 */
function costPanel(estimates, transport, stayFood, situation, lang) {
  const rows = [
    {
      key: 'transport',
      label: t('dest.cost.transport'),
      value: Math.round(transport),
    },
    {
      key: 'stayFood',
      label: t('dest.cost.stayFood', { days: situation.days }),
      value: Math.round(stayFood),
    },
    {
      key: 'total',
      label: t('dest.cost.total'),
      value: Math.round(estimates.estCost),
    },
  ];

  return `
    <p class="dest-cost-lead">${escapeHtml(
      t('dest.cost.lead', {
        origin: t(`origin.${situation.origin}`),
        days: situation.days,
      }),
    )}</p>
    <dl class="dest-cost-list">
      ${rows
        .map(
          (row) => `
        <div class="dest-cost-row dest-cost-row--${row.key}">
          <dt>${escapeHtml(row.label)}</dt>
          <dd>
            ${escapeHtml(t('results.bdt', { n: formatNumber(row.value, lang) }))}
            <span class="estimate-tag">${escapeHtml(t('results.estimate'))}</span>
          </dd>
        </div>`,
        )
        .join('')}
    </dl>
    <p class="dest-cost-meta">
      ${escapeHtml(
        t('dest.cost.travelHours', {
          hours: formatHours(estimates.oneWayHours, lang),
        }),
      )}
      <span class="estimate-tag">${escapeHtml(t('results.estimate'))}</span>
    </p>
  `;
}

/**
 * @param {object} dest
 * @param {number} selectedMonth
 * @param {'en' | 'bn'} lang
 */
function seasonPanel(dest, selectedMonth, lang) {
  const best = new Set(dest.bestMonths ?? []);
  const open = new Set(dest.access?.openMonths ?? []);
  const cells = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const status = seasonStatus(month, best, open);
    const selected = month === selectedMonth ? ' is-selected' : '';
    return `
      <li class="season-cell season-${status}${selected}" aria-label="${escapeAttr(
        `${t(`month.${month}`)} — ${t(`dest.season.${status}`)}${
          month === selectedMonth ? `, ${t('dest.season.selected')}` : ''
        }`,
      )}">
        <span class="season-month">${escapeHtml(monthShort(month, lang))}</span>
        <span class="season-status">${escapeHtml(t(`dest.season.${status}`))}</span>
        ${
          month === selectedMonth
            ? `<span class="season-selected-mark">${escapeHtml(t('dest.season.selected'))}</span>`
            : ''
        }
      </li>`;
  }).join('');

  return `
    <p class="dest-season-lead">${escapeHtml(t('dest.season.lead'))}</p>
    <ul class="season-grid" aria-label="${escapeAttr(t('dest.season.gridLabel'))}">
      ${cells}
    </ul>
    <ul class="season-legend">
      <li><span class="season-swatch season-best"></span>${escapeHtml(t('dest.season.best'))}</li>
      <li><span class="season-swatch season-adjacent"></span>${escapeHtml(t('dest.season.adjacent'))}</li>
      <li><span class="season-swatch season-off"></span>${escapeHtml(t('dest.season.off'))}</li>
      <li><span class="season-swatch season-closed"></span>${escapeHtml(t('dest.season.closed'))}</li>
    </ul>
  `;
}

/**
 * @param {object} dest
 * @param {string} name
 */
function galleryPanel(dest, name) {
  return `
    <p class="dest-gallery-lead">${escapeHtml(t('dest.gallery.lead'))}</p>
    <div class="dest-gallery-frame">
      ${destMediaHtml({
        id: dest.id,
        name,
        spotLabel: t('results.spot'),
        photoSoonLabel: t('results.photoSoon'),
      })}
    </div>
  `;
}

/**
 * @param {Record<string, number>} factors
 */
function radarSvg(factors) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const levels = [0.25, 0.5, 0.75, 1];

  const pointAt = (index, value) => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / FACTOR_KEYS.length;
    const r = radius * Math.min(1, Math.max(0, value));
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      lx: cx + Math.cos(angle) * (radius + 18),
      ly: cy + Math.sin(angle) * (radius + 18),
    };
  };

  const grid = levels
    .map((level) => {
      const pts = FACTOR_KEYS.map((_, i) => {
        const p = pointAt(i, level);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' ');
      return `<polygon class="radar-grid" points="${pts}" />`;
    })
    .join('');

  const axes = FACTOR_KEYS.map((_, i) => {
    const p = pointAt(i, 1);
    return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" />`;
  }).join('');

  const valuePts = FACTOR_KEYS.map((key, i) => {
    const p = pointAt(i, factors[key] ?? 0);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const labels = FACTOR_KEYS.map((key, i) => {
    const p = pointAt(i, 1);
    return `<text class="radar-label" x="${p.lx.toFixed(1)}" y="${p.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(
      t(`results.factorName.${key}`),
    )}</text>`;
  }).join('');

  return `
    <svg class="radar-chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeAttr(
      t('dest.radar.chartLabel'),
    )}">
      ${grid}
      ${axes}
      <polygon class="radar-value" points="${valuePts}" />
      ${labels}
    </svg>
  `;
}

/**
 * @param {{ factors: Record<string, number>, contributions: Record<string, number>, total: number }} scored
 * @param {'en' | 'bn'} lang
 */
function factorTable(scored, lang) {
  const rows = FACTOR_KEYS.map(
    (key) => `
    <tr>
      <th scope="row">${escapeHtml(t(`results.factorName.${key}`))}</th>
      <td>${escapeHtml(formatNumber(Math.round((scored.factors[key] ?? 0) * 100), lang))}%</td>
      <td>${escapeHtml(
        formatNumber(Math.round((scored.contributions[key] ?? 0) * 10) / 10, lang),
      )}</td>
    </tr>`,
  ).join('');

  return `
    <table class="dest-factor-table">
      <caption>${escapeHtml(t('dest.radar.tableCaption'))}</caption>
      <thead>
        <tr>
          <th scope="col">${escapeHtml(t('dest.radar.colFactor'))}</th>
          <th scope="col">${escapeHtml(t('dest.radar.colFactorPct'))}</th>
          <th scope="col">${escapeHtml(t('dest.radar.colPoints'))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <th scope="row">${escapeHtml(t('results.fitScore'))}</th>
          <td colspan="2">${escapeHtml(formatNumber(Math.round(scored.total), lang))}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/**
 * @param {number} month
 * @param {Set<number>} best
 * @param {Set<number>} open
 * @returns {'best' | 'adjacent' | 'off' | 'closed'}
 */
function seasonStatus(month, best, open) {
  if (!open.has(month)) return 'closed';
  if (best.has(month)) return 'best';
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  if (best.has(prev) || best.has(next)) return 'adjacent';
  return 'off';
}

/**
 * @param {number} month
 * @param {'en' | 'bn'} lang
 */
function monthShort(month, lang) {
  const full = t(`month.${month}`);
  if (lang === 'bn') return full.slice(0, 3);
  return full.slice(0, 3);
}

/**
 * @param {number} score
 */
function fitRingSvg(score) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  return `
    <div class="fit-ring" role="img" aria-label="${escapeAttr(`${t('results.fitScore')} ${score}`)}">
      <svg viewBox="0 0 84 84" aria-hidden="true" focusable="false">
        <circle class="fit-ring-track" cx="42" cy="42" r="${radius}" />
        <circle
          class="fit-ring-value"
          cx="42"
          cy="42"
          r="${radius}"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div class="fit-ring-label">
        <span class="fit-ring-score">${score}</span>
        <span class="fit-ring-caption">${escapeHtml(t('results.fitScore'))}</span>
      </div>
    </div>
  `;
}

/**
 * @param {{ code: string, values: Record<string, number> }} warning
 */
function warningHtml(warning) {
  if (warning.code === 'PERMIT_REQUIRED') {
    const permitKey = PERMIT_BY_CODE[warning.values.permit] ?? 'none';
    return `<li class="notice">${icon('warning')}<span>${escapeHtml(
      t('warning.permit', { permit: t(`permit.${permitKey}`) }),
    )}</span></li>`;
  }
  if (warning.code === 'MAX_STAY_LIMIT') {
    return `<li class="notice">${icon('clock')}<span>${escapeHtml(
      t('warning.maxStay', { hours: warning.values.hours }),
    )}</span></li>`;
  }
  if (warning.code === 'UNVERIFIED_DATA') {
    return `<li class="notice notice-muted">${icon('info')}<span>${escapeHtml(
      t('warning.unverified'),
    )}</span></li>`;
  }
  return '';
}

/**
 * @param {string} tag
 */
function tagLabel(tag) {
  if (tag === 'peaceful' || tag === 'adventure' || tag === 'cultural' || tag === 'social') {
    return t(`mood.${tag}`);
  }
  return t(`activity.${tag}`);
}

/**
 * @param {number} hours
 * @param {'en' | 'bn'} lang
 */
function formatHours(hours, lang) {
  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(hours);
}

/**
 * @param {string} name
 */
async function shareDestination(name) {
  const url = window.location.href;
  const title = t('dest.shareTitle', { name });
  const text = t('dest.shareText', { name });

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast(t('dest.shareCopied'));
      return;
    }
  } catch {
    /* fall through */
  }

  const input = document.createElement('input');
  input.value = url;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showToast(t('dest.shareCopied'));
  } catch {
    showToast(t('dest.shareFailed'));
  }
  input.remove();
}
