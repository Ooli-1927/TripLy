import { setLang, t } from '../i18n/i18n.js';
import { get, set, subscribe } from '../state.js';
import { icon } from './icons.js';

const THEME_KEY = 'triply.theme';

/**
 * Fill every `[data-i18n]` node from the active catalogue.
 */
function render() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const value = t(key);
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, value);
      return;
    }
    el.textContent = value;
  });

  const current = document.documentElement.lang === 'bn' ? 'bn' : 'en';
  const next = current === 'bn' ? 'en' : 'bn';
  const toggle = document.querySelector('#lang-toggle');
  if (toggle instanceof HTMLButtonElement) {
    toggle.innerHTML = `${icon('language')}<span>${t(
      next === 'bn' ? 'lang.switchToBn' : 'lang.switchToEn',
    )}</span>`;
    toggle.lang = next;
  }

  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeToggle = document.querySelector('#theme-toggle');
  if (themeToggle instanceof HTMLButtonElement) {
    themeToggle.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? t('theme.toLight') : t('theme.toDark'),
    );
  }

  const state = get();
  const view = state.view;
  const authed = Boolean(state.user);
  const loginNav = document.querySelector('[data-nav-login]');
  const logoutNav = document.querySelector('[data-nav-logout]');
  if (loginNav instanceof HTMLElement) loginNav.hidden = authed;
  if (logoutNav instanceof HTMLElement) {
    logoutNav.hidden = !authed;
    if (authed) {
      logoutNav.innerHTML = `${icon('log-out')}<span>${t('nav.logout')}</span>`;
    }
  }

  const authTitleKey =
    view === 'login'
      ? 'auth.login.title'
      : view === 'signup'
        ? 'auth.signup.title'
        : view === 'forgot'
          ? 'auth.forgot.title'
          : view === 'reset'
            ? 'auth.reset.title'
            : null;
  document.title = authTitleKey ? `${t(authTitleKey)} · ${t('app.name')}` : t('app.name');
  document.body.dataset.ready = 'true';
  document.body.dataset.authed = authed ? 'true' : 'false';
}

/**
 * @returns {'light' | 'dark'}
 */
function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {'light' | 'dark'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Bind the language toggle and paint the shell from the store.
 */
export function mountShell() {
  applyTheme(readTheme());

  subscribe(() => {
    render();
  });

  const toggle = document.querySelector('#lang-toggle');
  toggle?.addEventListener('click', async () => {
    const current = get().lang === 'bn' ? 'bn' : 'en';
    const lang = await setLang(current === 'bn' ? 'en' : 'bn');
    set({ lang });
  });

  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    render();
  });

  setLang().then((lang) => {
    set({ lang });
  });
}
