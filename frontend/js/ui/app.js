import { CONFIG, normalizeWeights, recommend } from '../engine/index.js';
import { setLang, t } from '../i18n/i18n.js';
import { get, set, subscribe } from '../state.js';
import { renderAuth } from './auth.js';
import { renderDestination } from './destination.js';
import { applySituationToForm, escapeHtml } from './form.js';
import { dismissLoginGate, showLoginGate } from './gate.js';
import { renderHome } from './home.js';
import { bindReveals } from './motion.js';
import { renderResults } from './results.js';
import { hydrateSession, isLoggedIn, logoutUser } from './session.js';
import { defaultSituation, validateSituation } from './situation.js';
import { isAuthRoute, parseUrl, writeUrl } from './url.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 * @typedef {import('./url.js').AppView} AppView
 * @typedef {import('./auth.js').AuthView} AuthView
 */

let homeRoot;
let resultsRoot;
let destinationRoot;
let authRoot;
/** @type {object[]} */
let destinations = [];
let rendering = false;
/** @type {{ view: AppView | null, lang: string | null, destinationId: string | null }} */
let painted = { view: null, lang: null, destinationId: null };

/**
 * Boot the Home / Results / Destination / Auth app into `#content`.
 */
export async function mountApp() {
  const content = document.querySelector('#content');
  if (!(content instanceof HTMLElement)) return;

  if (!get().lang) {
    const lang = await setLang();
    set({ lang });
  }

  content.innerHTML = `
    <div id="app-skeleton" class="app-skeleton" aria-busy="true" aria-live="polite">
      <div class="app-skeleton-bar"></div>
      <div class="app-skeleton-grid">
        <div class="app-skeleton-card"></div>
        <div class="app-skeleton-card"></div>
        <div class="app-skeleton-card"></div>
      </div>
      <p class="app-skeleton-label">${escapeSkeletonLabel()}</p>
    </div>
    <div id="view-home" hidden></div>
    <div id="view-results" hidden></div>
    <div id="view-destination" hidden></div>
    <div id="view-auth" hidden></div>
  `;
  homeRoot = content.querySelector('#view-home');
  resultsRoot = content.querySelector('#view-results');
  destinationRoot = content.querySelector('#view-destination');
  authRoot = content.querySelector('#view-auth');

  const [loadedDestinations, sessionUser] = await Promise.all([
    loadDestinations(),
    hydrateSession(),
  ]);
  destinations = loadedDestinations;
  content.querySelector('#app-skeleton')?.remove();

  const fromUrl = parseUrl();
  const initialSituation = fromUrl.situation;
  let initialView = fromUrl.view;
  let initialDestinationId = fromUrl.destinationId;
  const initialErrors = validateSituation(initialSituation);
  const canRun = Object.keys(initialErrors).length === 0;

  if (initialView === 'results' && !sessionUser) {
    initialView = 'home';
  }

  if (initialView === 'destination') {
    const found = destinations.find((dest) => dest.id === initialDestinationId);
    if (!found) {
      initialView = sessionUser ? 'results' : 'home';
      initialDestinationId = null;
    }
  }

  const initialWeights = normalizeWeights(CONFIG.defaultWeights);
  const recommendation =
    initialView === 'results' && canRun && sessionUser
      ? recommend(initialSituation, destinations, initialWeights)
      : initialView === 'destination' && canRun
        ? recommend(initialSituation, destinations, initialWeights)
        : null;

  set({
    situation: initialSituation,
    view: initialView,
    destinationId: initialDestinationId,
    errors: initialErrors,
    recommendation,
    destinations,
    user: sessionUser,
    weights: initialWeights,
  });

  writeUrl(initialSituation, initialView, { destinationId: initialDestinationId });

  if (fromUrl.view === 'results' && !sessionUser) {
    window.setTimeout(() => requireLogin(), 320);
  }

  subscribe((state) => {
    paint(state);
  });

  paint(get());

  window.addEventListener('popstate', () => {
    const parsed = parseUrl();
    const errors = validateSituation(parsed.situation);
    const ok = Object.keys(errors).length === 0;
    /** @type {Record<string, unknown>} */
    const next = {
      situation: parsed.situation,
      view: parsed.view,
      destinationId: parsed.destinationId,
      errors,
    };

    if (parsed.view === 'results' && !isLoggedIn()) {
      next.view = 'home';
      next.destinationId = null;
      next.recommendation = null;
      writeUrl(parsed.situation, 'home');
      set(next);
      requireLogin();
      return;
    }

    if (parsed.view === 'destination') {
      const found = destinations.some((dest) => dest.id === parsed.destinationId);
      if (!found) {
        next.view = isLoggedIn() ? 'results' : 'home';
        next.destinationId = null;
      }
    }

    if ((parsed.view === 'results' || parsed.view === 'destination') && ok) {
      next.recommendation = recommend(
        parsed.situation,
        destinations,
        /** @type {object} */ (get().weights),
      );
    }
    set(next);
  });

  document.querySelector('.logo')?.addEventListener('click', (event) => {
    event.preventDefault();
    goHome();
  });

  document.querySelector('a[href="#explore"]')?.addEventListener('click', () => {
    if (get().view !== 'home') goHome();
  });

  document.querySelector('[data-nav-login]')?.addEventListener('click', (event) => {
    event.preventDefault();
    goAuth('login');
  });

  document.querySelector('[data-nav-logout]')?.addEventListener('click', () => {
    void logoutUser().then(() => {
      set({ user: null, recommendation: null, view: 'home', destinationId: null });
      writeUrl(/** @type {Situation} */ (get().situation ?? defaultSituation()), 'home');
    });
  });
}

/**
 * @param {import('../state.js').AppState} state
 */
function paint(state) {
  if (rendering) return;
  rendering = true;

  const active = document.activeElement;
  const activeId = active instanceof HTMLElement ? active.id : '';
  const selectionStart =
    active instanceof HTMLInputElement ? active.selectionStart : null;
  const selectionEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;

  try {
    const situation = /** @type {Situation} */ (state.situation ?? defaultSituation());
    const errors =
      /** @type {Record<string, { key: string, vars?: Record<string, string | number> }>} */ (
        state.errors ?? {}
      );
    const lang = state.lang === 'bn' ? 'bn' : 'en';
    let view = /** @type {AppView} */ (state.view ?? 'home');
    const destinationId =
      typeof state.destinationId === 'string' ? state.destinationId : null;

    if (
      !(homeRoot instanceof HTMLElement) ||
      !(resultsRoot instanceof HTMLElement) ||
      !(destinationRoot instanceof HTMLElement) ||
      !(authRoot instanceof HTMLElement)
    ) {
      return;
    }

    if (view === 'results' && !state.user) {
      view = 'home';
      writeUrl(situation, 'home');
      set({ view: 'home', recommendation: null, destinationId: null });
      return;
    }

    if (view === 'destination') {
      const dest = destinations.find((item) => item.id === destinationId);
      if (!dest) {
        view = state.user ? 'results' : 'home';
        writeUrl(situation, view);
        set({ view, destinationId: null });
        return;
      }
    }

    document.body.dataset.view = view;
    document.body.dataset.authed = state.user ? 'true' : 'false';

    hideAllViews();

    if (isAuthRoute(view)) {
      clearViewIfNeeded('home', homeRoot);
      clearViewIfNeeded('results', resultsRoot);
      clearViewIfNeeded('destination', destinationRoot);
      authRoot.hidden = false;

      if (painted.view !== view || painted.lang !== lang) {
        renderAuth(authRoot, {
          view: /** @type {AuthView} */ (view),
          lang,
          destinations,
          onNavigate: (next) => {
            if (next === 'home') goHome();
            else goAuth(next);
          },
          onAuthenticated: (user) => {
            set({ user, view: 'home', destinationId: null });
            writeUrl(situation, 'home');
          },
        });
      }
      painted = { view, lang, destinationId: null };
    } else if (view === 'home') {
      clearAuthIfNeeded();
      clearViewIfNeeded('results', resultsRoot);
      clearViewIfNeeded('destination', destinationRoot);
      homeRoot.hidden = false;

      const mount = homeRoot.querySelector('[data-form-mount]');
      if (painted.view === 'home' && painted.lang === lang && mount instanceof HTMLElement) {
        applySituationToForm(mount, {
          situation,
          errors,
          idPrefix: 'home',
          lang,
        });
      } else {
        renderHome(homeRoot, {
          situation,
          errors,
          lang,
          destinations,
          getSituation: () => /** @type {Situation} */ (get().situation),
          onChange: (partial) => updateSituation(partial, { recompute: false, view: 'home' }),
          onSubmit: submitSearch,
        });
      }
      painted = { view: 'home', lang, destinationId: null };
    } else if (view === 'destination') {
      clearAuthIfNeeded();
      clearViewIfNeeded('home', homeRoot);
      clearViewIfNeeded('results', resultsRoot);
      destinationRoot.hidden = false;
      const dest = destinations.find((item) => item.id === destinationId);
      const weights = normalizeWeights(
        /** @type {object} */ (state.weights ?? CONFIG.defaultWeights),
      );

      if (
        painted.view !== 'destination' ||
        painted.lang !== lang ||
        painted.destinationId !== destinationId
      ) {
        renderDestination(destinationRoot, {
          destination: dest,
          situation,
          lang,
          weights,
          onBack: goResults,
        });
        bindReveals(destinationRoot);
      }
      painted = { view: 'destination', lang, destinationId };
    } else {
      clearAuthIfNeeded();
      clearViewIfNeeded('home', homeRoot);
      clearViewIfNeeded('destination', destinationRoot);
      resultsRoot.hidden = false;
      const weights = normalizeWeights(
        /** @type {object} */ (state.weights ?? CONFIG.defaultWeights),
      );
      renderResults(resultsRoot, {
        situation,
        errors,
        lang,
        destinations,
        weights,
        recommendation: /** @type {{ ranked: object[], rejected: object[] } | null} */ (
          state.recommendation
        ),
        getSituation: () => /** @type {Situation} */ (get().situation),
        onChange: (partial) => updateSituation(partial, { recompute: true, view: 'results' }),
        onWeightsChange: (nextWeights) => {
          const sit = /** @type {Situation} */ (get().situation ?? defaultSituation());
          set({
            weights: nextWeights,
            recommendation: recommend(sit, destinations, nextWeights),
            view: 'results',
            destinationId: null,
          });
        },
        onBack: goHome,
        onOpenDestination: openDestination,
        onApplySuggestion: (partial) =>
          updateSituation(partial, { recompute: true, view: 'results' }),
      });
      bindReveals(resultsRoot);
      painted = { view: 'results', lang, destinationId: null };
    }

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el instanceof HTMLElement) {
        el.focus({ preventScroll: true });
        if (
          el instanceof HTMLInputElement &&
          selectionStart != null &&
          selectionEnd != null &&
          el.type !== 'range'
        ) {
          try {
            el.setSelectionRange(selectionStart, selectionEnd);
          } catch {
            /* Some input types do not support selection. */
          }
        }
      }
    }
  } finally {
    rendering = false;
  }
}

function hideAllViews() {
  if (homeRoot instanceof HTMLElement) homeRoot.hidden = true;
  if (resultsRoot instanceof HTMLElement) resultsRoot.hidden = true;
  if (destinationRoot instanceof HTMLElement) destinationRoot.hidden = true;
  if (authRoot instanceof HTMLElement) authRoot.hidden = true;
}

/**
 * @param {AppView | string} viewName
 * @param {Element | null} root
 */
function clearViewIfNeeded(viewName, root) {
  if (painted.view === viewName && root instanceof HTMLElement) {
    root.innerHTML = '';
  }
}

function clearAuthIfNeeded() {
  if (isAuthRoute(painted.view || '') && authRoot instanceof HTMLElement) {
    authRoot.innerHTML = '';
  }
}

/**
 * @param {Partial<Situation>} partial
 * @param {{ recompute: boolean, view: 'home' | 'results' }} options
 */
function updateSituation(partial, options) {
  const current = /** @type {Situation} */ (get().situation ?? defaultSituation());
  const situation = { ...current, ...partial };
  const errors = validateSituation(situation);
  /** @type {Record<string, unknown>} */
  const next = {
    situation,
    errors,
    view: options.view,
    destinationId: null,
  };

  const weights = normalizeWeights(
    /** @type {object} */ (get().weights ?? CONFIG.defaultWeights),
  );

  if (options.recompute && Object.keys(errors).length === 0) {
    next.recommendation = recommend(situation, destinations, weights);
    writeUrl(situation, 'results');
  } else if (options.recompute && Object.keys(errors).length > 0) {
    writeUrl(situation, options.view);
  } else if (options.view === 'home') {
    writeUrl(situation, 'home');
  }

  set(next);
}

function submitSearch() {
  if (!isLoggedIn()) {
    requireLogin();
    return;
  }

  const situation = /** @type {Situation} */ (get().situation ?? defaultSituation());
  const errors = validateSituation(situation);
  if (Object.keys(errors).length > 0) {
    set({ errors });
    return;
  }
  const weights = normalizeWeights(
    /** @type {object} */ (get().weights ?? CONFIG.defaultWeights),
  );
  const recommendation = recommend(situation, destinations, weights);
  writeUrl(situation, 'results');
  set({
    view: 'results',
    destinationId: null,
    errors: {},
    recommendation,
  });
}

function requireLogin() {
  showLoginGate({
    onLogin: () => goAuth('login'),
    onSignup: () => goAuth('signup'),
  });
}

function goHome() {
  const situation = /** @type {Situation} */ (get().situation ?? defaultSituation());
  writeUrl(situation, 'home');
  set({
    view: 'home',
    destinationId: null,
    errors: {},
    recommendation: null,
  });
}

function goResults() {
  const situation = /** @type {Situation} */ (get().situation ?? defaultSituation());
  const weights = normalizeWeights(
    /** @type {object} */ (get().weights ?? CONFIG.defaultWeights),
  );
  const errors = validateSituation(situation);
  const ok = Object.keys(errors).length === 0;

  if (!isLoggedIn()) {
    writeUrl(situation, 'home');
    set({ view: 'home', destinationId: null, recommendation: null });
    requireLogin();
    return;
  }

  const update = () => {
    writeUrl(situation, 'results');
    set({
      view: 'results',
      destinationId: null,
      errors,
      recommendation: ok ? recommend(situation, destinations, weights) : null,
    });
  };

  runViewTransition(update);
}

/**
 * @param {string} destinationId
 */
function openDestination(destinationId) {
  const situation = /** @type {Situation} */ (get().situation ?? defaultSituation());
  const found = destinations.some((dest) => dest.id === destinationId);
  if (!found) return;

  const update = () => {
    writeUrl(situation, 'destination', { destinationId, push: true });
    set({
      view: 'destination',
      destinationId,
    });
  };

  runViewTransition(update);
}

/**
 * @param {() => void} update
 */
function runViewTransition(update) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && typeof document.startViewTransition === 'function') {
    document.startViewTransition(update);
    return;
  }
  update();
}

/**
 * @param {AuthView} view
 */
function goAuth(view) {
  dismissLoginGate();
  const situation = /** @type {Situation} */ (get().situation ?? defaultSituation());
  writeUrl(situation, view);
  set({ view, destinationId: null });
}

/**
 * @returns {Promise<object[]>}
 */
async function loadDestinations() {
  const response = await fetch(new URL('../../data/destinations.json', import.meta.url));
  if (!response.ok) {
    throw new Error('Unable to load destinations');
  }
  return response.json();
}

/** @returns {string} */
function escapeSkeletonLabel() {
  return escapeHtml(t('app.loading'));
}
