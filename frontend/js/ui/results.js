import {
  CONFIG,
  estimateTrip,
  explainMatch,
  explainWhyNot,
  normalizeWeights,
  rankStability,
} from '../engine/index.js';
import { t } from '../i18n/i18n.js';
import { formatNumber } from '../utils/format.js';
import { countConstraintCodes, suggestBestChange } from './empty.js';
import { bindSituationForm, escapeAttr, escapeHtml, renderEditPanel } from './form.js';
import { icon } from './icons.js';
import { bindMediaFallbacks, bindMediaGallery, destMediaHtml } from './media.js';
import { bindReveals, bindSummaryCollapse } from './motion.js';
import { bindCardThemes } from './palette.js';
import { ui } from './strings.js';
import { destinationHref } from './url.js';
import { mountWeather, weatherSlotHtml } from './weather.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 * @typedef {{ tag: number, budget: number, time: number, season: number, offbeat: number }} Weights
 */

const FACTOR_KEYS = /** @type {const} */ (['tag', 'budget', 'time', 'season', 'offbeat']);

const PERMIT_BY_CODE = Object.freeze({
  [CONFIG.permitCode.travel_pass]: 'travel_pass',
  [CONFIG.permitCode.permission_required]: 'permission_required',
  [CONFIG.permitCode.none]: 'none',
});

/**
 * Render the Results view.
 * @param {HTMLElement} root
 * @param {{
 *   situation: Situation,
 *   errors: Record<string, { key: string, vars?: Record<string, string | number> }>,
 *   lang: string,
 *   destinations: object[],
 *   recommendation: { ranked: object[], rejected: object[] } | null,
 *   weights?: Partial<Weights>,
 *   onChange: (partial: Partial<Situation>) => void,
 *   onWeightsChange: (weights: Weights) => void,
 *   getSituation: () => Situation,
 *   onBack: () => void,
 *   onOpenDestination?: (id: string) => void,
 *   onApplySuggestion: (partial: Partial<Situation>) => void,
 * }} options
 */
export function renderResults(root, options) {
  root.hidden = false;
  const lang = options.lang === 'bn' ? 'bn' : 'en';
  const recommendation = options.recommendation ?? { ranked: [], rejected: [] };
  const ranked = recommendation.ranked;
  const rejected = recommendation.rejected;
  const byId = new Map(options.destinations.map((dest) => [dest.id, dest]));
  const editOpen = root.dataset.editOpen === 'true';
  const weightsOpen = root.dataset.weightsOpen === 'true';
  const weights = normalizeWeights(options.weights);
  const stability =
    ranked.length > 0
      ? rankStability(options.situation, options.destinations, weights)
      : null;

  root.innerHTML = `
    <section class="results">
      ${summaryBarHtml(options.situation, lang, editOpen, weightsOpen)}
      <div class="edit-panel" id="edit-panel" ${editOpen ? '' : 'hidden'}>
        <div data-form-mount></div>
      </div>
      ${weightsPanelHtml(weights, weightsOpen)}
      <div
        class="results-main"
        aria-live="polite"
        aria-label="${escapeAttr(t('a11y.resultsRegion'))}"
      >
        ${
          ranked.length > 0
            ? renderRanked(ranked, byId, options.situation, lang, stability)
            : renderEmpty(options.situation, options.destinations, rejected, lang)
        }
        ${
          ranked.length > 0 && rejected.length > 0
            ? renderRejected(rejected, byId, options.situation, lang)
            : ''
        }
      </div>
      ${fitScoreDialogHtml(weights)}
    </section>
  `;

  bindMediaFallbacks(root);
  bindMediaGallery(root);
  bindCardThemes(root);
  bindReveals(root);
  bindSummaryCollapse(root);
  mountWeather(root, lang);

  const mount = root.querySelector('[data-form-mount]');
  if (mount instanceof HTMLElement) {
    renderEditPanel(mount, {
      situation: options.situation,
      errors: options.errors,
      idPrefix: 'results',
      lang: options.lang,
    });
    bindSituationForm(mount, {
      getSituation: options.getSituation,
      onChange: options.onChange,
      lang: options.lang,
    });
  }

  root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    options.onBack();
  });

  root.querySelectorAll('[data-action="open-destination"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      if (!(node instanceof HTMLAnchorElement)) return;
      if (
        event instanceof MouseEvent &&
        (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      ) {
        return;
      }
      event.preventDefault();
      const id = node.getAttribute('data-id');
      if (id && options.onOpenDestination) options.onOpenDestination(id);
    });
  });

  root.querySelector('[data-action="toggle-edit"]')?.addEventListener('click', () => {
    const next = root.dataset.editOpen !== 'true';
    root.dataset.editOpen = next ? 'true' : 'false';
    const panel = root.querySelector('#edit-panel');
    const toggle = root.querySelector('[data-action="toggle-edit"]');
    if (panel instanceof HTMLElement) panel.hidden = !next;
    if (toggle instanceof HTMLButtonElement) {
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      const label = toggle.querySelector('[data-edit-label]');
      if (label) label.textContent = next ? ui('closeEdit') : ui('editSituation');
    }
  });

  root.querySelector('[data-action="toggle-weights"]')?.addEventListener('click', () => {
    const next = root.dataset.weightsOpen !== 'true';
    root.dataset.weightsOpen = next ? 'true' : 'false';
    const panel = root.querySelector('#weights-panel');
    const toggle = root.querySelector('[data-action="toggle-weights"]');
    if (panel instanceof HTMLElement) panel.hidden = !next;
    if (toggle instanceof HTMLButtonElement) {
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    }
  });

  root.querySelectorAll('[data-action="fit-help"]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = root.querySelector('#fit-score-dialog');
      if (dialog instanceof HTMLDialogElement) dialog.showModal();
    });
  });

  root.querySelectorAll('[data-action="apply-suggestion"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const el = /** @type {HTMLElement} */ (event.currentTarget);
      const kind = el.getAttribute('data-kind');
      const value = Number(el.getAttribute('data-value'));
      if (kind === 'days') options.onApplySuggestion({ days: value });
      if (kind === 'budget') options.onApplySuggestion({ budget: value });
      if (kind === 'month') options.onApplySuggestion({ month: value });
    });
  });

  bindWeightControls(root, weights, options.onWeightsChange);
}

/**
 * @param {HTMLElement} root
 * @param {Weights} weights
 * @param {(weights: Weights) => void} onWeightsChange
 */
function bindWeightControls(root, weights, onWeightsChange) {
  /** @type {Weights} */
  let draft = { ...weights };

  const syncLabels = () => {
    const normalized = normalizeWeights(draft);
    for (const key of FACTOR_KEYS) {
      const label = root.querySelector(`[data-weight-pct="${key}"]`);
      if (label) label.textContent = `${Math.round(normalized[key] * 100)}%`;
    }
  };

  root.querySelectorAll('[data-weight-key]').forEach((input) => {
    input.addEventListener('input', () => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = /** @type {keyof Weights} */ (input.getAttribute('data-weight-key'));
      draft = { ...draft, [key]: Number(input.value) / 100 };
      syncLabels();
      onWeightsChange(normalizeWeights(draft));
    });
  });

  root.querySelector('[data-action="reset-weights"]')?.addEventListener('click', () => {
    draft = { ...CONFIG.defaultWeights };
    for (const key of FACTOR_KEYS) {
      const input = root.querySelector(`[data-weight-key="${key}"]`);
      if (input instanceof HTMLInputElement) {
        input.value = String(Math.round(draft[key] * 100));
      }
    }
    syncLabels();
    onWeightsChange(normalizeWeights(draft));
  });
}

/**
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 * @param {boolean} editOpen
 * @param {boolean} weightsOpen
 */
function summaryBarHtml(situation, lang, editOpen, weightsOpen) {
  const activities =
    situation.activities.length > 0
      ? situation.activities.map((item) => t(`activity.${item}`)).join(', ')
      : ui('activitiesNone');

  return `
    <div class="summary-bar" data-summary-bar>
      <p class="summary-compact-line" aria-hidden="true">
        ${escapeHtml(t(`mood.${situation.mood}`))} · ${escapeHtml(formatNumber(situation.budget, lang))} BDT · ${situation.days}d · ${escapeHtml(t(`origin.${situation.origin}`))} · ${escapeHtml(t(`month.${situation.month}`))}
      </p>
      <div class="summary-chips" aria-label="${escapeAttr(t('results.summaryHeading'))}">
        <span class="summary-chip">${icon(situation.mood)}<span>${escapeHtml(t(`mood.${situation.mood}`))}</span></span>
        <span class="summary-chip">${icon('wallet')}<span>${escapeHtml(formatNumber(situation.budget, lang))} BDT</span></span>
        <span class="summary-chip">${icon('clock')}<span>${situation.days}d</span></span>
        <span class="summary-chip">${icon('map-pin')}<span>${escapeHtml(t(`origin.${situation.origin}`))}</span></span>
        <span class="summary-chip">${icon('calendar')}<span>${escapeHtml(t(`month.${situation.month}`))}</span></span>
        <span class="summary-chip summary-chip--soft">${escapeHtml(activities)}</span>
      </div>
      <div class="summary-actions">
        <button
          type="button"
          class="btn-secondary"
          data-action="toggle-weights"
          aria-expanded="${weightsOpen ? 'true' : 'false'}"
          aria-controls="weights-panel"
        >${icon('sliders')}<span>${escapeHtml(t('results.weightsToggle'))}</span></button>
        <button
          type="button"
          class="btn-secondary"
          data-action="toggle-edit"
          aria-expanded="${editOpen ? 'true' : 'false'}"
          aria-controls="edit-panel"
        >${editOpen ? icon('close') : icon('info')}<span data-edit-label>${escapeHtml(
          editOpen ? ui('closeEdit') : ui('editSituation'),
        )}</span></button>
        <button
          type="button"
          class="btn-restart"
          data-action="back"
          title="${escapeAttr(t('results.backHint'))}"
        >${icon('refresh')}<span>${escapeHtml(t('results.back'))}</span></button>
      </div>
    </div>
  `;
}

/**
 * @param {Weights} weights
 * @param {boolean} open
 */
function weightsPanelHtml(weights, open) {
  const rows = FACTOR_KEYS.map((key) => {
    const pct = Math.round(weights[key] * 100);
    return `
      <label class="weight-row">
        <span class="weight-row-label">
          <span>${escapeHtml(t(`results.factorName.${key}`))}</span>
          <span data-weight-pct="${key}">${pct}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value="${pct}"
          data-weight-key="${key}"
          aria-label="${escapeAttr(t(`results.factorName.${key}`))}"
        >
      </label>
    `;
  }).join('');

  return `
    <div class="weights-panel" id="weights-panel" ${open ? '' : 'hidden'}>
      <header class="weights-head">
        <div>
          <h2>${escapeHtml(t('results.weightsTitle'))}</h2>
          <p>${escapeHtml(t('results.weightsLead'))}</p>
        </div>
        <button type="button" class="btn-secondary" data-action="reset-weights">
          ${icon('refresh')}<span>${escapeHtml(t('results.weightsReset'))}</span>
        </button>
      </header>
      <div class="weight-sliders">${rows}</div>
    </div>
  `;
}

/**
 * @param {object[]} ranked
 * @param {Map<string, object>} byId
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 * @param {{ label: string, changedCount: number, total: number } | null} stability
 */
function renderRanked(ranked, byId, situation, lang, stability) {
  const badge = stability
    ? `<p class="stability-badge stability-badge--${escapeAttr(stability.label)}" title="${escapeAttr(
        t(`results.stability.${stability.label}.detail`, {
          changed: stability.changedCount,
          same: stability.total - stability.changedCount,
          total: stability.total,
        }),
      )}">
        <span class="stability-label">${escapeHtml(t(`results.stability.${stability.label}`))}</span>
        <span class="stability-detail">${escapeHtml(
          t(`results.stability.${stability.label}.detail`, {
            changed: stability.changedCount,
            same: stability.total - stability.changedCount,
            total: stability.total,
          }),
        )}</span>
      </p>`
    : '';

  return `
    <div class="results-toolbar">
      <div class="results-toolbar-main">
        <h2>${escapeHtml(t('results.heading'))}</h2>
        ${badge}
      </div>
      <p class="results-count">${icon('sparkles')}<span>${escapeHtml(
        t('results.count', { n: ranked.length }),
      )}</span></p>
    </div>
    <ol class="result-list">
      ${ranked
        .map((item, index) => renderCard(item, byId.get(item.id), situation, lang, index + 1))
        .join('')}
    </ol>
  `;
}

/**
 * @param {object} item
 * @param {object | undefined} dest
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 * @param {number} rank
 */
function renderCard(item, dest, situation, lang, rank) {
  if (!dest) return '';
  const estimates = estimateTrip(situation, dest);
  const name = dest.name?.[lang] || dest.name?.en || dest.id;
  const place = [dest.district, dest.division].filter(Boolean).join(' · ');
  const score = Math.round(item.total);
  const matched = matchedTags(situation, dest);
  const warnings = (item.warnings ?? []).map((warning) => warningHtml(warning)).join('');
  const explanation = explainMatch(situation, dest, item);

  return `
    <li class="result-card" data-reveal data-reveal-delay="${(rank - 1) * 55}">
      <div class="card-lead">
        <div class="card-top">
          <div class="card-title-row">
            <h3 class="card-title">
              <a
                class="card-title-link"
                href="${escapeAttr(destinationHref(situation, dest.id))}"
                data-action="open-destination"
                data-id="${escapeAttr(dest.id)}"
                style="view-transition-name: dest-hero-${escapeAttr(dest.id)}"
              >${escapeHtml(name)}</a>
            </h3>
            <div class="card-meta">
              <span class="tier-badge tier-${escapeAttr(dest.popularityTier)}">${escapeHtml(
                t(`results.tier.${dest.popularityTier}`),
              )}</span>
              ${
                place
                  ? `<span class="card-place">${icon('map-pin')}<span>${escapeHtml(place)}</span></span>`
                  : ''
              }
            </div>
          </div>
          <div class="fit-ring-wrap">
            ${fitRingSvg(score)}
            <button
              type="button"
              class="fit-help-btn"
              data-action="fit-help"
              aria-label="${escapeAttr(t('results.fitScoreHow'))}"
              title="${escapeAttr(t('results.fitScoreHow'))}"
            >${icon('info')}</button>
          </div>
        </div>
      </div>
      ${destMediaHtml({
        id: dest.id,
        name,
        rank,
        spotLabel: t('results.spot'),
        photoSoonLabel: t('results.photoSoon'),
      })}
      <div class="card-body">
        <dl class="estimate-grid">
          <div class="estimate-item">
            <dt>${icon('clock')}<span>${escapeHtml(t('results.travelTime'))}</span></dt>
            <dd>
              ${escapeHtml(t('results.hours', { n: formatHours(estimates.oneWayHours, lang) }))}
              <span class="estimate-tag">${escapeHtml(t('results.estimate'))}</span>
            </dd>
          </div>
          <div class="estimate-item">
            <dt>${icon('wallet')}<span>${escapeHtml(t('results.estCost'))}</span></dt>
            <dd>
              ${escapeHtml(t('results.bdt', { n: formatNumber(Math.round(estimates.estCost), lang) }))}
              <span class="estimate-tag">${escapeHtml(t('results.estimate'))}</span>
            </dd>
          </div>
        </dl>
        ${weatherSlotHtml({ id: dest.id, lat: dest.lat, lng: dest.lng })}
        <div class="card-foot">
          ${
            matched.length > 0
              ? `<div class="matched">
                  <span class="matched-label">${escapeHtml(t('results.matchedTags'))}</span>
                  <ul class="matched-list">
                    ${matched
                      .map(
                        (tag) =>
                          `<li>${icon(tag)}<span>${escapeHtml(tagLabel(tag))}</span></li>`,
                      )
                      .join('')}
                  </ul>
                </div>`
              : ''
          }
          ${whyMatchHtml(explanation, lang)}
          ${warnings ? `<ul class="notice-list">${warnings}</ul>` : ''}
        </div>
      </div>
    </li>
  `;
}

/**
 * @param {import('../engine/explain.js').MatchExplanation} explanation
 * @param {'en' | 'bn'} lang
 */
function whyMatchHtml(explanation, lang) {
  const maxContribution = Math.max(
    ...FACTOR_KEYS.map((key) => explanation.contributions[key] ?? 0),
    0.0001,
  );

  const factorIcon = {
    tag: 'sparkles',
    budget: 'wallet',
    time: 'clock',
    season: 'calendar',
    offbeat: 'adventure',
  };

  const bars = FACTOR_KEYS.map((key) => {
    const contribution = explanation.contributions[key] ?? 0;
    const factor = explanation.factors[key] ?? 0;
    const width = Math.round((contribution / maxContribution) * 100);
    const top = key === explanation.topFactor ? ' is-top' : '';
    const valueLabel = t('results.why.factorValue', {
      points: formatNumber(Math.round(contribution * 10) / 10, lang),
      factor: formatNumber(Math.round(factor * 100), lang),
    });
    return `
      <li class="why-factor why-factor--${key}${top}">
        <div class="why-factor-head">
          <span class="why-factor-name">${icon(factorIcon[key])}<span>${escapeHtml(
            t(`results.factorName.${key}`),
          )}</span></span>
          <span class="why-factor-value">${escapeHtml(valueLabel)}</span>
        </div>
        <div class="why-bar" role="img" aria-label="${escapeAttr(valueLabel)}">
          <span class="why-bar-fill" style="width:${width}%"></span>
        </div>
      </li>
    `;
  }).join('');

  const matched =
    explanation.matchedActivities.length > 0
      ? explanation.matchedActivities.map((a) => tagLabel(a)).join(', ')
      : t('results.why.none');
  const unmatched =
    explanation.unmatchedActivities.length > 0
      ? explanation.unmatchedActivities.map((a) => tagLabel(a)).join(', ')
      : t('results.why.none');

  return `
    <details class="why-match" data-reveal="scale">
      <summary>
        <span class="why-summary-main">
          <span class="why-summary-icon" aria-hidden="true">${icon('sparkles')}</span>
          <span>${escapeHtml(t('results.why.summary'))}</span>
        </span>
        <span class="why-summary-cue" aria-hidden="true"></span>
      </summary>
      <div class="why-match-body">
        <p class="why-top">
          <span class="why-top-badge">${escapeHtml(t('results.why.topBadge'))}</span>
          <span class="why-top-factor">${icon(factorIcon[explanation.topFactor])}<span>${escapeHtml(
            t(`results.factorName.${explanation.topFactor}`),
          )}</span></span>
        </p>
        <div class="why-section">
          <h4 class="why-section-title">${escapeHtml(t('results.why.factorsHeading'))}</h4>
          <ul class="why-factors">${bars}</ul>
        </div>
        <div class="why-section">
          <h4 class="why-section-title">${escapeHtml(t('results.why.checksHeading'))}</h4>
          <ul class="why-meta">
            <li class="why-check">
              ${icon('clock')}
              <span>${escapeHtml(
                t('results.why.travel', {
                  hours: formatHours(explanation.travelHours, lang),
                  limit: formatHours(explanation.hoursLimit, lang),
                }),
              )}</span>
            </li>
            <li class="why-check">
              ${icon('wallet')}
              <span>${escapeHtml(
                t('results.why.cost', {
                  cost: formatNumber(Math.round(explanation.estCost), lang),
                  budget: formatNumber(Math.round(explanation.budget), lang),
                }),
              )}</span>
            </li>
            <li class="why-check">
              ${icon('calendar')}
              <span>${escapeHtml(t(`results.why.season.${explanation.seasonStatus}`))}</span>
            </li>
            <li class="why-check">
              ${icon('sparkles')}
              <span>${escapeHtml(t('results.why.matched', { list: matched }))}</span>
            </li>
            <li class="why-check">
              ${icon('info')}
              <span>${escapeHtml(t('results.why.unmatched', { list: unmatched }))}</span>
            </li>
          </ul>
        </div>
      </div>
    </details>
  `;
}

/**
 * @param {object[]} rejected
 * @param {Map<string, object>} byId
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 */
function renderRejected(rejected, byId, situation, lang) {
  const cards = rejected
    .map((item) => {
      const dest = byId.get(item.id);
      if (!dest) return '';
      const name = dest.name?.[lang] || dest.name?.en || dest.id;
      const rows = explainWhyNot(situation, item, dest);
      const reasons = item.reasons
        .map((reason) => `<li>${escapeHtml(t(`constraint.${reason.code}`))}</li>`)
        .join('');

      const actionable = rows
        .filter((row) => row.sufficient)
        .map((row) => {
          const label =
            row.change.field === 'days'
              ? t('results.rejected.applyDays', { n: row.change.to })
              : row.change.field === 'budget'
                ? t('results.rejected.applyBudget', {
                    n: formatNumber(row.change.to, lang),
                  })
                : t('results.rejected.applyMonth', { month: t(`month.${row.change.to}`) });
          return `
            <li class="rejected-action">
              <p>${escapeHtml(
                t('results.rejected.counterfactual', {
                  code: t(`constraint.${row.code}`),
                  detail: label,
                }),
              )}</p>
              <button
                type="button"
                class="btn-secondary"
                data-action="apply-suggestion"
                data-kind="${row.change.field}"
                data-value="${row.change.to}"
              >${icon('sparkles')}<span>${escapeHtml(t('results.rejected.apply'))}</span></button>
            </li>
          `;
        })
        .join('');

      return `
        <li class="rejected-card">
          <h3>${escapeHtml(name)}</h3>
          <ul class="rejected-reasons">${reasons}</ul>
          ${
            actionable
              ? `<ul class="rejected-actions">${actionable}</ul>`
              : `<p class="rejected-none">${escapeHtml(t('results.rejected.noFix'))}</p>`
          }
        </li>
      `;
    })
    .join('');

  return `
    <section class="rejected-section" aria-labelledby="rejected-title">
      <header class="rejected-head">
        <h2 id="rejected-title">${escapeHtml(t('results.rejected.title'))}</h2>
        <p>${escapeHtml(t('results.rejected.lead'))}</p>
      </header>
      <ul class="rejected-list">${cards}</ul>
    </section>
  `;
}

/**
 * @param {number} score 0..100
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
 * @param {Situation} situation
 * @param {object[]} destinations
 * @param {object[]} rejected
 * @param {'en' | 'bn'} lang
 */
function renderEmpty(situation, destinations, rejected, lang) {
  const codes = countConstraintCodes(rejected);
  const suggestion = suggestBestChange(situation, destinations, rejected);

  let actionHtml = `<p class="suggestion-text">${escapeHtml(t('empty.suggestion.none'))}</p>`;
  if (suggestion) {
    const text =
      suggestion.kind === 'days'
        ? t('empty.suggestion.days', { n: suggestion.value })
        : suggestion.kind === 'budget'
          ? t('empty.suggestion.budget', {
              n: formatNumber(suggestion.value, lang),
            })
          : t('empty.suggestion.month', { month: t(`month.${suggestion.value}`) });

    const nowLine = situationPreviewLine(situation, lang);
    const nextSituation = {
      ...situation,
      ...(suggestion.kind === 'days'
        ? { days: suggestion.value }
        : suggestion.kind === 'budget'
          ? { budget: suggestion.value }
          : { month: suggestion.value }),
    };
    const afterLine = situationPreviewLine(nextSituation, lang);

    actionHtml = `
      <p class="suggestion-kicker">${escapeHtml(t('empty.suggestionLead'))}</p>
      <p class="suggestion-text">${escapeHtml(text)}</p>
      <div class="empty-preview" aria-label="${escapeAttr(t('empty.previewLabel'))}">
        <div class="empty-preview-col">
          <span class="empty-preview-label">${escapeHtml(t('empty.previewNow'))}</span>
          <span class="empty-preview-value">${escapeHtml(nowLine)}</span>
        </div>
        <span class="empty-preview-arrow" aria-hidden="true">${icon('arrow-right')}</span>
        <div class="empty-preview-col empty-preview-col--next">
          <span class="empty-preview-label">${escapeHtml(t('empty.previewAfter'))}</span>
          <span class="empty-preview-value">${escapeHtml(afterLine)}</span>
          <span class="empty-preview-unlock">${escapeHtml(
            t('empty.previewUnlocks', { n: suggestion.unlocked }),
          )}</span>
        </div>
      </div>
      <button
        type="button"
        class="btn-primary"
        data-action="apply-suggestion"
        data-kind="${suggestion.kind}"
        data-value="${suggestion.value}"
      >${icon('sparkles')}<span>${escapeHtml(t('empty.applySuggestion'))}</span></button>
    `;
  }

  const details =
    codes.length > 0
      ? `<details class="empty-details">
          <summary>${escapeHtml(ui('seeWhy'))}</summary>
          <ul class="constraint-list">
            ${codes
              .map(
                (item) => `
              <li>
                <span class="constraint-name">${escapeHtml(t(`constraint.${item.code}`))}</span>
                <span class="constraint-count">${escapeHtml(
                  t('empty.constraintCount', {
                    code: item.code,
                    count: item.count,
                  }),
                )}</span>
              </li>`,
              )
              .join('')}
          </ul>
        </details>`
      : '';

  return `
    <div class="empty-state empty-state--friendly" data-reveal>
      <h2>${escapeHtml(t('empty.heading'))}</h2>
      <p>${escapeHtml(ui('emptyFriendlier'))}</p>
      <div class="suggestion-box">${actionHtml}</div>
      ${details}
    </div>
  `;
}

/**
 * @param {Situation} situation
 * @param {'en' | 'bn'} lang
 */
function situationPreviewLine(situation, lang) {
  return `${formatNumber(situation.budget, lang)} BDT · ${situation.days}d · ${t(`month.${situation.month}`)} · ${t(`origin.${situation.origin}`)}`;
}

/**
 * @param {Weights} weights
 */
function fitScoreDialogHtml(weights) {
  const pct = (value) => Math.round(value * 100);
  return `
    <dialog id="fit-score-dialog" class="fit-dialog">
      <form method="dialog" class="fit-dialog-inner">
        <h2>${escapeHtml(t('results.fitScoreDialogTitle'))}</h2>
        <p>${escapeHtml(t('results.fitScoreIntro'))}</p>
        <ul class="factor-list">
          <li>${escapeHtml(t('results.factor.tag', { weight: pct(weights.tag) }))}</li>
          <li>${escapeHtml(t('results.factor.budget', { weight: pct(weights.budget) }))}</li>
          <li>${escapeHtml(t('results.factor.time', { weight: pct(weights.time) }))}</li>
          <li>${escapeHtml(t('results.factor.season', { weight: pct(weights.season) }))}</li>
          <li>${escapeHtml(t('results.factor.offbeat', { weight: pct(weights.offbeat) }))}</li>
        </ul>
        <button type="submit" class="btn-primary">${icon('close')}<span>${escapeHtml(
          t('results.fitScoreDialogClose'),
        )}</span></button>
      </form>
    </dialog>
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
 * @param {Situation} situation
 * @param {{ tags?: Record<string, number> }} dest
 */
function matchedTags(situation, dest) {
  const tags = dest.tags ?? {};
  /** @type {string[]} */
  const matched = [];
  if ((tags[situation.mood] ?? 0) >= 0.35) matched.push(situation.mood);
  for (const activity of situation.activities) {
    if ((tags[activity] ?? 0) >= 0.35 && !matched.includes(activity)) {
      matched.push(activity);
    }
  }
  return matched;
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
