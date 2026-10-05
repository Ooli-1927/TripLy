import { t } from '../i18n/i18n.js';
import { formatNumber } from '../utils/format.js';
import { icon } from './icons.js';
import {
  ACTIVITIES,
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  MOODS,
  ORIGINS,
} from './situation.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 */

/**
 * Modern situation form (home + results edit).
 * @param {HTMLElement} root
 * @param {{
 *   situation: Situation,
 *   errors?: Record<string, { key: string, vars?: Record<string, string | number> }>,
 *   idPrefix: string,
 *   showSubmit?: boolean,
 *   lang: string,
 * }} options
 */
export function renderSituationForm(root, options) {
  const { situation, errors = {}, idPrefix, showSubmit = false, lang } = options;
  const numberLang = lang === 'bn' ? 'bn' : 'en';
  const activityCount = situation.activities.length;

  root.innerHTML = `
    <div class="sit-form" role="group" aria-label="${escapeAttr(t('a11y.situationForm'))}">
      <div class="sit-field">
        <div class="sit-label-row">
          <span class="sit-label" id="${idPrefix}-mood-label">${escapeHtml(t('home.mood'))}</span>
        </div>
        <div class="mood-grid" role="radiogroup" aria-labelledby="${idPrefix}-mood-label">
          ${MOODS.map((mood) => {
            const pressed = situation.mood === mood;
            return `
            <button
              type="button"
              class="mood-tile"
              data-field="mood"
              data-value="${mood}"
              aria-pressed="${pressed ? 'true' : 'false'}"
            >
              <span class="mood-tile-icon">${icon(mood)}</span>
              <span>${escapeHtml(t(`mood.${mood}`))}</span>
            </button>`;
          }).join('')}
        </div>
        <div data-error-for="mood">${errorHtml(errors.mood, `${idPrefix}-mood-error`)}</div>
      </div>

      <div class="sit-field sit-field--budget">
        <div class="sit-label-row">
          <span class="sit-label" id="${idPrefix}-budget-label">${escapeHtml(t('home.budget'))}</span>
          <output class="sit-budget-value" id="${idPrefix}-budget-out" for="${idPrefix}-budget-range">${escapeHtml(
            formatBudget(situation.budget, numberLang),
          )}</output>
        </div>
        <div class="budget-control">
          <input
            type="range"
            id="${idPrefix}-budget-range"
            class="sit-range"
            min="${BUDGET_MIN}"
            max="${BUDGET_MAX}"
            step="${BUDGET_STEP}"
            value="${clampBudget(situation.budget)}"
            aria-labelledby="${idPrefix}-budget-label"
            aria-describedby="${idPrefix}-budget-out ${idPrefix}-budget-hint"
          >
          <div class="budget-edit">
            <div class="budget-input-wrap">
              ${icon('wallet')}
              <input
                type="number"
                id="${idPrefix}-budget"
                class="sit-number"
                min="${BUDGET_MIN}"
                max="${BUDGET_MAX}"
                step="${BUDGET_STEP}"
                value="${Math.round(situation.budget)}"
                inputmode="numeric"
                aria-labelledby="${idPrefix}-budget-label"
                ${errors.budget ? 'aria-invalid="true"' : ''}
              >
              <span class="budget-suffix">BDT</span>
            </div>
            <div class="budget-presets" role="group" aria-label="${escapeAttr(t('home.budgetPresets'))}">
              ${[5000, 10000, 15000, 25000]
                .map(
                  (amount) => `
                <button type="button" class="budget-preset" data-field="budget-preset" data-value="${amount}">
                  ${escapeHtml(formatNumber(amount, numberLang))}
                </button>`,
                )
                .join('')}
            </div>
          </div>
        </div>
        <p class="sit-hint" id="${idPrefix}-budget-hint">${escapeHtml(t('home.budgetHint'))}</p>
        <div data-error-for="budget">${errorHtml(errors.budget, `${idPrefix}-budget-error`)}</div>
      </div>

      <div class="sit-field">
        <div class="sit-label-row">
          <span class="sit-label" id="${idPrefix}-days-label">${escapeHtml(t('home.days'))}</span>
        </div>
        <div class="day-seg" role="group" aria-labelledby="${idPrefix}-days-label">
          ${[1, 2, 3, 4, 5]
            .map(
              (day) => `
            <button
              type="button"
              class="day-seg-btn"
              data-field="days"
              data-value="${day}"
              aria-pressed="${situation.days === day ? 'true' : 'false'}"
            >${day}<span>${escapeHtml(t('home.dayUnit'))}</span></button>`,
            )
            .join('')}
        </div>
        <div data-error-for="days">${errorHtml(errors.days, `${idPrefix}-days-error`)}</div>
      </div>

      <div class="sit-grid-2">
        <div class="sit-field">
          <label class="sit-label" for="${idPrefix}-origin">${escapeHtml(t('home.origin'))}</label>
          <div class="sit-select-wrap">
            ${icon('map-pin')}
            <select
              id="${idPrefix}-origin"
              class="sit-select"
              data-field="origin"
              ${errors.origin ? 'aria-invalid="true"' : ''}
            >
              ${ORIGINS.map(
                (origin) => `
                <option value="${origin}" ${situation.origin === origin ? 'selected' : ''}>
                  ${escapeHtml(t(`origin.${origin}`))}
                </option>`,
              ).join('')}
            </select>
          </div>
          <div data-error-for="origin">${errorHtml(errors.origin, `${idPrefix}-origin-error`)}</div>
        </div>
        <div class="sit-field">
          <label class="sit-label" for="${idPrefix}-month">${escapeHtml(t('home.month'))}</label>
          <div class="sit-select-wrap">
            ${icon('calendar')}
            <select
              id="${idPrefix}-month"
              class="sit-select"
              data-field="month"
              ${errors.month ? 'aria-invalid="true"' : ''}
            >
              ${Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                return `
                <option value="${month}" ${situation.month === month ? 'selected' : ''}>
                  ${escapeHtml(t(`month.${month}`))}
                </option>`;
              }).join('')}
            </select>
          </div>
          <div data-error-for="month">${errorHtml(errors.month, `${idPrefix}-month-error`)}</div>
        </div>
      </div>

      <div class="sit-field">
        <div class="sit-label-row">
          <span class="sit-label" id="${idPrefix}-activities-label">${escapeHtml(t('home.activities'))}</span>
          <span class="sit-meta" data-activity-meta>${
            activityCount > 0
              ? escapeHtml(t('home.activitiesPicked', { n: activityCount }))
              : escapeHtml(t('home.activitiesHint'))
          }</span>
        </div>
        <div class="activity-grid" role="group" aria-labelledby="${idPrefix}-activities-label">
          ${ACTIVITIES.map((activity) => {
            const pressed = situation.activities.includes(activity);
            return `
            <button
              type="button"
              class="activity-chip"
              data-field="activity"
              data-value="${activity}"
              aria-pressed="${pressed ? 'true' : 'false'}"
            >${icon(activity)}<span>${escapeHtml(t(`activity.${activity}`))}</span></button>`;
          }).join('')}
        </div>
      </div>

      <div class="sit-actions">
        ${
          showSubmit
            ? `<button type="submit" class="btn-primary sit-submit">${icon('arrow-right')}<span>${escapeHtml(
                t('home.submit'),
              )}</span></button>`
            : `<p class="sit-live-note">${escapeHtml(t('results.editHint'))}</p>`
        }
      </div>
    </div>
  `;
}

/**
 * Update an already-mounted form without replacing the DOM tree.
 * Skips controls the user is currently interacting with.
 * @param {HTMLElement} root
 * @param {{
 *   situation: Situation,
 *   errors?: Record<string, { key: string, vars?: Record<string, string | number> }>,
 *   idPrefix: string,
 *   lang: string,
 * }} options
 */
export function applySituationToForm(root, options) {
  const { situation, errors = {}, idPrefix, lang } = options;
  const numberLang = lang === 'bn' ? 'bn' : 'en';
  const active = document.activeElement;

  root.querySelectorAll('[data-field="mood"]').forEach((el) => {
    const value = el.getAttribute('data-value');
    const next = value === situation.mood ? 'true' : 'false';
    if (el.getAttribute('aria-pressed') !== next) {
      el.setAttribute('aria-pressed', next);
    }
  });

  root.querySelectorAll('[data-field="days"]').forEach((el) => {
    const value = Number(el.getAttribute('data-value'));
    const next = value === situation.days ? 'true' : 'false';
    if (el.getAttribute('aria-pressed') !== next) {
      el.setAttribute('aria-pressed', next);
    }
  });

  root.querySelectorAll('[data-field="activity"]').forEach((el) => {
    const value = el.getAttribute('data-value');
    const pressed = value ? situation.activities.includes(value) : false;
    const next = pressed ? 'true' : 'false';
    if (el.getAttribute('aria-pressed') !== next) {
      el.setAttribute('aria-pressed', next);
    }
  });

  const meta = root.querySelector('[data-activity-meta]');
  if (meta) {
    meta.textContent =
      situation.activities.length > 0
        ? t('home.activitiesPicked', { n: situation.activities.length })
        : t('home.activitiesHint');
  }

  const budgetOut = root.querySelector(`#${CSS.escape(`${idPrefix}-budget-out`)}`);
  const budgetRange = root.querySelector(`#${CSS.escape(`${idPrefix}-budget-range`)}`);
  const budgetInput = root.querySelector(`#${CSS.escape(`${idPrefix}-budget`)}`);

  if (budgetOut) budgetOut.textContent = formatBudget(situation.budget, numberLang);

  if (budgetRange instanceof HTMLInputElement && active !== budgetRange) {
    budgetRange.value = String(clampBudget(situation.budget));
  }
  if (budgetInput instanceof HTMLInputElement && active !== budgetInput) {
    budgetInput.value = String(Math.round(situation.budget));
    budgetInput.setAttribute('aria-invalid', errors.budget ? 'true' : 'false');
  }

  const origin = root.querySelector(`#${CSS.escape(`${idPrefix}-origin`)}`);
  if (origin instanceof HTMLSelectElement && active !== origin) {
    origin.value = situation.origin;
  }
  const month = root.querySelector(`#${CSS.escape(`${idPrefix}-month`)}`);
  if (month instanceof HTMLSelectElement && active !== month) {
    month.value = String(situation.month);
  }

  setError(root, 'mood', errors.mood, `${idPrefix}-mood-error`);
  setError(root, 'budget', errors.budget, `${idPrefix}-budget-error`);
  setError(root, 'days', errors.days, `${idPrefix}-days-error`);
  setError(root, 'origin', errors.origin, `${idPrefix}-origin-error`);
  setError(root, 'month', errors.month, `${idPrefix}-month-error`);
}

/**
 * Compact stacked edit panel (results drawer).
 * @param {HTMLElement} root
 * @param {{
 *   situation: Situation,
 *   errors?: Record<string, { key: string, vars?: Record<string, string | number> }>,
 *   idPrefix: string,
 *   lang: string,
 * }} options
 */
export function renderEditPanel(root, options) {
  renderSituationForm(root, {
    ...options,
    showSubmit: false,
  });
  root.querySelector('.sit-form')?.classList.add('sit-form--panel');
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   getSituation: () => Situation,
 *   onChange: (partial: Partial<Situation>) => void,
 *   lang: string,
 * }} handlers
 */
export function bindSituationForm(root, handlers) {
  const numberLang = handlers.lang === 'bn' ? 'bn' : 'en';

  root.querySelectorAll('[data-field="mood"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const value = el.getAttribute('data-value');
      if (!value) return;
      handlers.onChange({ mood: /** @type {Situation['mood']} */ (value) });
      if (el instanceof HTMLElement) {
        el.focus({ preventScroll: true });
      }
    });
  });

  root.querySelectorAll('[data-field="days"]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.getAttribute('data-value'));
      if (value) handlers.onChange({ days: value });
    });
  });

  root.querySelectorAll('[data-field="activity"]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-value');
      if (!value) return;
      const current = handlers.getSituation().activities;
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      handlers.onChange({ activities: next });
    });
  });

  const budgetRange = root.querySelector('[id$="-budget-range"]');
  const budgetInput = root.querySelector('[id$="-budget"]');
  const budgetOut = root.querySelector('[id$="-budget-out"]');

  /**
   * @param {number} value
   * @param {{ commit?: boolean }} [options]
   */
  const paintBudgetLocal = (value, options = {}) => {
    const clamped = clampBudget(value);
    if (budgetOut) budgetOut.textContent = formatBudget(clamped, numberLang);
    if (budgetRange instanceof HTMLInputElement && document.activeElement !== budgetRange) {
      budgetRange.value = String(clamped);
    }
    if (budgetInput instanceof HTMLInputElement && document.activeElement !== budgetInput) {
      budgetInput.value = String(Math.round(clamped));
    }
    if (options.commit) handlers.onChange({ budget: clamped });
  };

  budgetRange?.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    if (budgetOut) budgetOut.textContent = formatBudget(value, numberLang);
    if (budgetInput instanceof HTMLInputElement) budgetInput.value = String(Math.round(value));
  });

  budgetRange?.addEventListener('change', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    paintBudgetLocal(Number(target.value), { commit: true });
  });

  budgetInput?.addEventListener('input', (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    if (budgetOut) budgetOut.textContent = formatBudget(value, numberLang);
    if (budgetRange instanceof HTMLInputElement) {
      budgetRange.value = String(clampBudget(value));
    }
  });

  const commitBudgetInput = (event) => {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    paintBudgetLocal(value, { commit: true });
  };

  budgetInput?.addEventListener('change', commitBudgetInput);
  budgetInput?.addEventListener('blur', commitBudgetInput);

  root.querySelectorAll('[data-field="budget-preset"]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.getAttribute('data-value'));
      if (!Number.isFinite(value)) return;
      if (budgetRange instanceof HTMLInputElement) budgetRange.value = String(value);
      if (budgetInput instanceof HTMLInputElement) budgetInput.value = String(value);
      if (budgetOut) budgetOut.textContent = formatBudget(value, numberLang);
      handlers.onChange({ budget: value });
    });
  });

  const origin = root.querySelector('[data-field="origin"]');
  origin?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    handlers.onChange({ origin: /** @type {Situation['origin']} */ (target.value) });
  });

  const month = root.querySelector('[data-field="month"]');
  month?.addEventListener('change', (event) => {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    handlers.onChange({ month: Number(target.value) });
  });
}

/**
 * @param {number} budget
 * @param {'en' | 'bn'} lang
 */
function formatBudget(budget, lang) {
  return `${formatNumber(Math.round(budget), lang)} BDT`;
}

/**
 * @param {HTMLElement} root
 * @param {string} field
 * @param {{ key: string, vars?: Record<string, string | number> } | undefined} error
 * @param {string} id
 */
function setError(root, field, error, id) {
  const slot = root.querySelector(`[data-error-for="${field}"]`);
  if (!(slot instanceof HTMLElement)) return;
  slot.innerHTML = errorHtml(error, id);
}

/**
 * @param {number} budget
 */
function clampBudget(budget) {
  if (!Number.isFinite(budget)) return BUDGET_MIN;
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, budget));
}

/**
 * @param {{ key: string, vars?: Record<string, string | number> } | undefined} error
 * @param {string} id
 */
function errorHtml(error, id) {
  if (!error) return '';
  return `<p class="field-error" id="${id}" role="alert">${escapeHtml(t(error.key, error.vars))}</p>`;
}

/**
 * @param {string} value
 */
export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {string} value
 */
export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
