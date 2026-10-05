import { ACTIVITIES, MOODS, ORIGINS, defaultSituation } from './situation.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 * @typedef {'home' | 'results' | 'destination' | 'login' | 'signup' | 'forgot' | 'reset'} AppView
 */

const AUTH_VIEWS = new Set(['login', 'signup', 'forgot', 'reset']);

/**
 * @param {string | null} value
 * @returns {value is AppView}
 */
function isAuthView(value) {
  return typeof value === 'string' && AUTH_VIEWS.has(value);
}

/**
 * Read situation + view from the URL query string.
 * @param {URLSearchParams} [params]
 * @returns {{ situation: Situation, view: AppView, destinationId: string | null }}
 */
export function parseUrl(params = new URLSearchParams(window.location.search)) {
  const base = defaultSituation();
  const mood = params.get('mood');
  const origin = params.get('origin');
  const budgetRaw = params.get('budget');
  const daysRaw = params.get('days');
  const monthRaw = params.get('month');
  const offbeatRaw = params.get('offbeat');
  const activitiesRaw = params.get('activities');
  const viewRaw = params.get('view');
  const destinationIdRaw = params.get('id');

  const budget = budgetRaw == null ? NaN : Number(budgetRaw);
  const days = daysRaw == null ? NaN : Number(daysRaw);
  const month = monthRaw == null ? NaN : Number(monthRaw);
  const offbeat = offbeatRaw == null ? NaN : Number(offbeatRaw);

  /** @type {Situation} */
  const situation = {
    mood: mood && MOODS.includes(mood) ? mood : base.mood,
    budget: Number.isFinite(budget) && budget > 0 ? budget : base.budget,
    days: Number.isInteger(days) && days >= 1 && days <= 5 ? days : base.days,
    origin: origin && ORIGINS.includes(origin) ? origin : base.origin,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : base.month,
    activities: activitiesRaw
      ? activitiesRaw
          .split(',')
          .map((item) => item.trim())
          .filter((item) => ACTIVITIES.includes(item))
      : [],
    offbeat:
      Number.isFinite(offbeat) && offbeat >= 0 && offbeat <= 1 ? offbeat : base.offbeat,
  };

  const destinationId =
    typeof destinationIdRaw === 'string' && destinationIdRaw.trim()
      ? destinationIdRaw.trim()
      : null;

  /** @type {AppView} */
  let view = 'home';
  if (isAuthView(viewRaw)) view = viewRaw;
  else if (viewRaw === 'results') view = 'results';
  else if (viewRaw === 'destination' && destinationId) view = 'destination';

  return { situation, view, destinationId };
}

/**
 * Write situation + view into the URL without reloading.
 * @param {Situation} situation
 * @param {AppView} view
 * @param {{ destinationId?: string | null, push?: boolean }} [options]
 */
export function writeUrl(situation, view, options = {}) {
  const params = new URLSearchParams();

  if (isAuthView(view)) {
    params.set('view', view);
  } else {
    if (view === 'results') params.set('view', 'results');
    if (view === 'destination') {
      params.set('view', 'destination');
      if (options.destinationId) params.set('id', options.destinationId);
    }
    params.set('mood', situation.mood);
    params.set('budget', String(Math.round(situation.budget)));
    params.set('days', String(situation.days));
    params.set('origin', situation.origin);
    params.set('month', String(situation.month));
    params.set('offbeat', String(situation.offbeat));
    if (situation.activities.length > 0) {
      params.set('activities', situation.activities.join(','));
    }
  }

  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;

  if (options.push) {
    window.history.pushState(null, '', next);
  } else {
    window.history.replaceState(null, '', next);
  }
}

/**
 * Build a shareable destination href preserving the situation.
 * @param {Situation} situation
 * @param {string} destinationId
 * @returns {string}
 */
export function destinationHref(situation, destinationId) {
  const params = new URLSearchParams();
  params.set('view', 'destination');
  params.set('id', destinationId);
  params.set('mood', situation.mood);
  params.set('budget', String(Math.round(situation.budget)));
  params.set('days', String(situation.days));
  params.set('origin', situation.origin);
  params.set('month', String(situation.month));
  params.set('offbeat', String(situation.offbeat));
  if (situation.activities.length > 0) {
    params.set('activities', situation.activities.join(','));
  }
  return `?${params.toString()}`;
}

/**
 * @param {string} view
 * @returns {boolean}
 */
export function isAuthRoute(view) {
  return isAuthView(view);
}
