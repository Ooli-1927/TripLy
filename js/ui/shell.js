import { setLang, t } from '../i18n/i18n.js';
import { get, set, subscribe } from '../state.js';

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
    toggle.textContent = t(next === 'bn' ? 'lang.switchToBn' : 'lang.switchToEn');
    toggle.lang = next;
  }

  document.title = t('app.name');
  document.body.dataset.ready = 'true';
}

/**
 * Bind the language toggle and paint the shell from the store.
 */
export function mountShell() {
  subscribe(() => {
    render();
  });

  const toggle = document.querySelector('#lang-toggle');
  toggle?.addEventListener('click', async () => {
    const current = get().lang === 'bn' ? 'bn' : 'en';
    const lang = await setLang(current === 'bn' ? 'en' : 'bn');
    set({ lang });
  });

  setLang().then((lang) => {
    set({ lang });
  });
}
