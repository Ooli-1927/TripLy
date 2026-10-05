import { t } from '../i18n/i18n.js';
import { escapeHtml } from './form.js';
import { icon } from './icons.js';

/**
 * Remove any open login-gate modal immediately.
 */
export function dismissLoginGate() {
  document.querySelectorAll('[data-login-gate]').forEach((node) => node.remove());
  document.body.classList.remove('has-login-gate');
}

/**
 * Show an animated “log in first” modal for gated actions.
 * @param {{
 *   onLogin: () => void,
 *   onSignup: () => void,
 * }} options
 */
export function showLoginGate(options) {
  dismissLoginGate();

  const overlay = document.createElement('div');
  overlay.className = 'login-gate';
  overlay.setAttribute('data-login-gate', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'login-gate-title');
  overlay.innerHTML = `
    <div class="login-gate-backdrop" data-gate-dismiss></div>
    <div class="login-gate-card" data-gate-card>
      <div class="login-gate-orbit" aria-hidden="true"></div>
      <div class="login-gate-icon" aria-hidden="true">${icon('lock', { className: 'icon--lg' })}</div>
      <p class="login-gate-kicker">${escapeHtml(t('gate.kicker'))}</p>
      <h2 id="login-gate-title" class="login-gate-title">${escapeHtml(t('gate.title'))}</h2>
      <p class="login-gate-lead">${escapeHtml(t('gate.lead'))}</p>
      <div class="login-gate-actions">
        <button type="button" class="btn-primary login-gate-login">
          ${icon('log-in')}<span>${escapeHtml(t('gate.login'))}</span>
        </button>
        <button type="button" class="btn-secondary login-gate-signup">
          ${icon('user')}<span>${escapeHtml(t('gate.signup'))}</span>
        </button>
      </div>
      <button type="button" class="login-gate-close" data-gate-dismiss aria-label="${escapeHtml(
        t('gate.close'),
      )}">${icon('close')}</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('has-login-gate');

  const previouslyFocused = document.activeElement;
  const loginBtn = overlay.querySelector('.login-gate-login');
  if (loginBtn instanceof HTMLElement) {
    window.requestAnimationFrame(() => {
      overlay.classList.add('is-in');
      loginBtn.focus();
    });
  } else {
    window.requestAnimationFrame(() => overlay.classList.add('is-in'));
  }

  const close = () => {
    overlay.classList.remove('is-in');
    overlay.classList.add('is-out');
    document.body.classList.remove('has-login-gate');
    window.setTimeout(() => {
      overlay.remove();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    }, 280);
  };

  overlay.querySelectorAll('[data-gate-dismiss]').forEach((node) => {
    node.addEventListener('click', close);
  });

  overlay.querySelector('.login-gate-login')?.addEventListener('click', () => {
    dismissLoginGate();
    options.onLogin();
  });

  overlay.querySelector('.login-gate-signup')?.addEventListener('click', () => {
    dismissLoginGate();
    options.onSignup();
  });

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
}
