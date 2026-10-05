import { t } from '../i18n/i18n.js';
import { escapeAttr, escapeHtml } from './form.js';
import { icon } from './icons.js';
import { heroPath } from './media.js';
import { bindReveals } from './motion.js';
import { ORIGINS } from './situation.js';
import {
  authenticateUser,
  isValidBdPhone,
  registerUser,
  writeSession,
} from './session.js';

/**
 * @typedef {'login' | 'signup' | 'forgot' | 'reset'} AuthView
 * @typedef {{ email: string, name: string, provider?: string }} SessionUser
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Destination heroes for auth background slideshow */
const AUTH_BG_IDS = Object.freeze([
  'coxs-bazar',
  'saint-martin',
  'bandarban',
  'sundarbans',
  'sreemangal',
]);

/**
 * Render an auth screen into root.
 * @param {HTMLElement} root
 * @param {{
 *   view: AuthView,
 *   lang: string,
 *   destinations?: object[],
 *   onNavigate: (view: AuthView | 'home') => void,
 *   onAuthenticated: (user: SessionUser) => void,
 * }} options
 */
export function renderAuth(root, options) {
  root.hidden = false;
  const view = options.view;
  const lang = options.lang === 'bn' ? 'bn' : 'en';
  const destIds = authPhotoIds(options.destinations);

  root.innerHTML = `
    <section class="auth" data-auth-view="${escapeAttr(view)}" aria-label="${escapeAttr(t(`auth.${view}.title`))}">
      <div class="auth-photos" aria-hidden="true" data-auth-photos>
        ${destIds
          .map(
            (id) => `
          <figure class="auth-photo is-pending" data-auth-photo data-dest="${escapeAttr(id)}">
            <img
              src="${escapeAttr(heroPath(id))}"
              alt=""
              width="1600"
              height="900"
              decoding="async"
              fetchpriority="low"
            >
          </figure>`,
          )
          .join('')}
      </div>
      <div class="auth-photo-scrim" aria-hidden="true"></div>
      <div class="auth-sky" aria-hidden="true">
        <div class="auth-sky-grain"></div>
      </div>
      <div class="auth-stage">
        <div class="auth-toolbar">
          <button type="button" class="auth-back" data-auth-nav="home">
            <span class="auth-back-icon" aria-hidden="true">${icon('arrow-left')}</span>
            <span class="auth-back-copy">
              <span class="auth-back-label">${escapeHtml(t('auth.backHome'))}</span>
              <span class="auth-back-sub">${escapeHtml(t('auth.backHomeSub'))}</span>
            </span>
          </button>
        </div>
        <div class="auth-split">
          <aside class="auth-brand" data-reveal="left" aria-hidden="true">
            <div class="auth-brand-sheen"></div>
            <div class="auth-brand-top">
              <div class="auth-brand-mark">${icon('compass', { className: 'icon--lg' })}</div>
              <p class="auth-brand-badge">${escapeHtml(t('auth.brandBadge'))}</p>
            </div>
            <p class="auth-brand-kicker">${escapeHtml(t('app.name'))}</p>
            <h2 class="auth-brand-title">${escapeHtml(t('auth.brandTitle'))}</h2>
            <p class="auth-brand-lead">${escapeHtml(t('auth.brandLead'))}</p>
            <div class="auth-brand-chips">
              <span>${escapeHtml(t('auth.brandChip1'))}</span>
              <span>${escapeHtml(t('auth.brandChip2'))}</span>
              <span>${escapeHtml(t('auth.brandChip3'))}</span>
            </div>
            <ul class="auth-brand-points">
              <li><span class="auth-brand-point-icon">${icon('shield')}</span><span>${escapeHtml(t('auth.brandPoint1'))}</span></li>
              <li><span class="auth-brand-point-icon">${icon('map')}</span><span>${escapeHtml(t('auth.brandPoint2'))}</span></li>
              <li><span class="auth-brand-point-icon">${icon('sparkles')}</span><span>${escapeHtml(t('auth.brandPoint3'))}</span></li>
            </ul>
            <p class="auth-brand-foot">${icon('route')}<span>${escapeHtml(t('auth.brandFoot'))}</span></p>
          </aside>

          <div class="auth-panel" data-reveal>
            <div class="auth-card" data-auth-card>
              ${panelHtml(view)}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  bindAuthPhotos(root);
  bindAuthInteractions(root, {
    view,
    lang,
    onNavigate: options.onNavigate,
    onAuthenticated: options.onAuthenticated,
  });
  bindReveals(root);
}

/**
 * @param {object[] | undefined} destinations
 * @returns {string[]}
 */
function authPhotoIds(destinations) {
  if (Array.isArray(destinations) && destinations.length > 0) {
    const ids = destinations.map((d) => d.id).filter(Boolean);
    const ordered = AUTH_BG_IDS.filter((id) => ids.includes(id));
    return ordered.length > 0 ? ordered : ids.slice(0, 5);
  }
  return [...AUTH_BG_IDS];
}

/**
 * Soft crossfade of destination photos behind the auth glass panels.
 * @param {ParentNode} root
 */
function bindAuthPhotos(root) {
  const auth = root.querySelector('.auth');
  const stage = root.querySelector('[data-auth-photos]');
  if (!(auth instanceof HTMLElement) || !(stage instanceof HTMLElement)) return;

  /** @type {HTMLElement[]} */
  const ready = [];
  const slides = [...stage.querySelectorAll('[data-auth-photo]')].filter(
    (node) => node instanceof HTMLElement,
  );
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;

  const show = (next) => {
    ready.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === next);
    });
  };

  const start = () => {
    if (ready.length === 0) return;
    auth.classList.add('has-photos');
    show(0);
    if (timer) clearInterval(timer);
    if (reduce || ready.length < 2) return;
    timer = setInterval(() => {
      index = (index + 1) % ready.length;
      show(index);
    }, 7000);
  };

  slides.forEach((slide) => {
    const img = slide.querySelector('img');
    if (!(img instanceof HTMLImageElement)) {
      slide.remove();
      return;
    }
    const mark = () => {
      if (img.naturalWidth === 0) {
        slide.remove();
        return;
      }
      slide.classList.remove('is-pending');
      if (!ready.includes(slide)) ready.push(slide);
      start();
    };
    if (img.complete) mark();
    else {
      img.addEventListener('load', mark, { once: true });
      img.addEventListener(
        'error',
        () => {
          slide.remove();
        },
        { once: true },
      );
    }
  });
}

/**
 * @param {AuthView} view
 */
function panelHtml(view) {
  if (view === 'signup') return signupHtml();
  if (view === 'forgot') return forgotHtml();
  if (view === 'reset') return resetHtml();
  return loginHtml();
}

function loginHtml() {
  return `
    <header class="auth-card-head">
      <p class="auth-kicker">${escapeHtml(t('auth.login.kicker'))}</p>
      <h1 class="auth-title">${escapeHtml(t('auth.login.title'))}</h1>
      <p class="auth-lead">${escapeHtml(t('auth.login.lead'))}</p>
    </header>
    ${socialHtml()}
    <div class="auth-divider"><span>${escapeHtml(t('auth.orEmail'))}</span></div>
    <form class="auth-form" data-auth-form="login" novalidate>
      ${fieldEmail('login')}
      ${fieldPassword('login', 'password', t('auth.password'), true)}
      <div class="auth-row">
        <label class="auth-check">
          <input type="checkbox" name="remember" value="1">
          <span>${escapeHtml(t('auth.remember'))}</span>
        </label>
        <button type="button" class="auth-link" data-auth-nav="forgot">${escapeHtml(
          t('auth.forgotLink'),
        )}</button>
      </div>
      <p class="auth-form-error" data-auth-error hidden></p>
      <button type="submit" class="btn-primary auth-submit">
        ${icon('log-in')}<span>${escapeHtml(t('auth.login.submit'))}</span>
      </button>
    </form>
    <p class="auth-switch">
      ${escapeHtml(t('auth.login.noAccount'))}
      <button type="button" class="auth-link" data-auth-nav="signup">${escapeHtml(
        t('auth.login.goSignup'),
      )}</button>
    </p>
  `;
}

function signupHtml() {
  const cityOptions = ORIGINS.map(
    (origin) =>
      `<option value="${escapeAttr(origin)}">${escapeHtml(t(`origin.${origin}`))}</option>`,
  ).join('');

  return `
    <header class="auth-card-head">
      <p class="auth-kicker">${escapeHtml(t('auth.signup.kicker'))}</p>
      <h1 class="auth-title">${escapeHtml(t('auth.signup.title'))}</h1>
      <p class="auth-lead">${escapeHtml(t('auth.signup.lead'))}</p>
    </header>
    ${socialHtml()}
    <div class="auth-divider"><span>${escapeHtml(t('auth.orEmail'))}</span></div>
    <form class="auth-form" data-auth-form="signup" novalidate>
      <div class="auth-field">
        <label class="auth-label" for="auth-name">${escapeHtml(t('auth.name'))}</label>
        <div class="auth-input-wrap">
          ${icon('user')}
          <input id="auth-name" class="auth-input" name="name" type="text" autocomplete="name" required>
        </div>
        <p class="auth-field-error" data-error-for="name" hidden></p>
      </div>
      ${fieldEmail('signup')}
      <div class="auth-field-grid">
        <div class="auth-field">
          <label class="auth-label" for="auth-phone">${escapeHtml(t('auth.phone'))}</label>
          <div class="auth-input-wrap">
            ${icon('phone')}
            <input
              id="auth-phone"
              class="auth-input"
              name="phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="${escapeAttr(t('auth.phonePlaceholder'))}"
              required
            >
          </div>
          <p class="auth-field-error" data-error-for="phone" hidden></p>
        </div>
        <div class="auth-field">
          <label class="auth-label" for="auth-city">${escapeHtml(t('auth.city'))}</label>
          <div class="auth-input-wrap">
            ${icon('map-pin')}
            <select id="auth-city" class="auth-input auth-select" name="city" required>
              <option value="">${escapeHtml(t('auth.cityPlaceholder'))}</option>
              ${cityOptions}
            </select>
          </div>
          <p class="auth-field-error" data-error-for="city" hidden></p>
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="auth-age">${escapeHtml(t('auth.ageBand'))}</label>
        <div class="auth-input-wrap">
          ${icon('user')}
          <select id="auth-age" class="auth-input auth-select" name="ageBand" required>
            <option value="">${escapeHtml(t('auth.ageBandPlaceholder'))}</option>
            <option value="18-24">${escapeHtml(t('auth.age.18-24'))}</option>
            <option value="25-34">${escapeHtml(t('auth.age.25-34'))}</option>
            <option value="35-44">${escapeHtml(t('auth.age.35-44'))}</option>
            <option value="45-54">${escapeHtml(t('auth.age.45-54'))}</option>
            <option value="55+">${escapeHtml(t('auth.age.55plus'))}</option>
          </select>
        </div>
        <p class="auth-field-error" data-error-for="ageBand" hidden></p>
      </div>
      ${fieldPassword('signup', 'password', t('auth.password'), false)}
      <div class="auth-strength" data-auth-strength aria-hidden="true">
        <span class="auth-strength-bar" data-strength-bar></span>
        <span class="auth-strength-label" data-strength-label></span>
      </div>
      ${fieldPassword('signup', 'confirm', t('auth.confirmPassword'), false)}
      <p class="auth-storage-note">${escapeHtml(t('auth.storageNote'))}</p>
      <label class="auth-check auth-check--block">
        <input type="checkbox" name="terms" value="1" required>
        <span>${escapeHtml(t('auth.terms'))}</span>
      </label>
      <p class="auth-form-error" data-auth-error hidden></p>
      <button type="submit" class="btn-primary auth-submit">
        ${icon('sparkles')}<span>${escapeHtml(t('auth.signup.submit'))}</span>
      </button>
    </form>
    <p class="auth-switch">
      ${escapeHtml(t('auth.signup.hasAccount'))}
      <button type="button" class="auth-link" data-auth-nav="login">${escapeHtml(
        t('auth.signup.goLogin'),
      )}</button>
    </p>
  `;
}

function forgotHtml() {
  return `
    <header class="auth-card-head">
      <p class="auth-kicker">${escapeHtml(t('auth.forgot.kicker'))}</p>
      <h1 class="auth-title">${escapeHtml(t('auth.forgot.title'))}</h1>
      <p class="auth-lead">${escapeHtml(t('auth.forgot.lead'))}</p>
    </header>
    <form class="auth-form" data-auth-form="forgot" novalidate>
      ${fieldEmail('forgot')}
      <p class="auth-form-error" data-auth-error hidden></p>
      <button type="submit" class="btn-primary auth-submit">
        ${icon('mail')}<span>${escapeHtml(t('auth.forgot.submit'))}</span>
      </button>
    </form>
    <div class="auth-success" data-auth-success hidden>
      <div class="auth-success-icon" aria-hidden="true">${icon('mail', { className: 'icon--lg' })}</div>
      <h2 class="auth-success-title">${escapeHtml(t('auth.forgot.sentTitle'))}</h2>
      <p class="auth-success-lead" data-auth-success-lead></p>
      <button type="button" class="btn-primary auth-submit" data-auth-nav="reset">
        ${icon('key')}<span>${escapeHtml(t('auth.forgot.enterCode'))}</span>
      </button>
    </div>
    <p class="auth-switch">
      <button type="button" class="auth-link" data-auth-nav="login">${escapeHtml(
        t('auth.backLogin'),
      )}</button>
    </p>
  `;
}

function resetHtml() {
  return `
    <header class="auth-card-head">
      <p class="auth-kicker">${escapeHtml(t('auth.reset.kicker'))}</p>
      <h1 class="auth-title">${escapeHtml(t('auth.reset.title'))}</h1>
      <p class="auth-lead">${escapeHtml(t('auth.reset.lead'))}</p>
    </header>
    <form class="auth-form" data-auth-form="reset" novalidate>
      <div class="auth-field">
        <span class="auth-label" id="auth-otp-label">${escapeHtml(t('auth.reset.otp'))}</span>
        <div class="auth-otp" role="group" aria-labelledby="auth-otp-label">
          ${[0, 1, 2, 3, 4, 5]
            .map(
              (i) => `
            <input
              class="auth-otp-input"
              type="text"
              inputmode="numeric"
              maxlength="1"
              pattern="[0-9]"
              autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
              aria-label="${escapeAttr(t('auth.reset.otpDigit', { n: i + 1 }))}"
              data-otp-index="${i}"
            >`,
            )
            .join('')}
        </div>
        <p class="auth-field-error" data-error-for="otp" hidden></p>
      </div>
      ${fieldPassword('reset', 'password', t('auth.reset.newPassword'), false)}
      ${fieldPassword('reset', 'confirm', t('auth.confirmPassword'), false)}
      <p class="auth-form-error" data-auth-error hidden></p>
      <button type="submit" class="btn-primary auth-submit">
        ${icon('shield')}<span>${escapeHtml(t('auth.reset.submit'))}</span>
      </button>
    </form>
    <div class="auth-success" data-auth-success hidden>
      <div class="auth-success-icon" aria-hidden="true">${icon('check', { className: 'icon--lg' })}</div>
      <h2 class="auth-success-title">${escapeHtml(t('auth.reset.doneTitle'))}</h2>
      <p class="auth-success-lead">${escapeHtml(t('auth.reset.doneLead'))}</p>
      <button type="button" class="btn-primary auth-submit" data-auth-nav="login">
        ${icon('log-in')}<span>${escapeHtml(t('auth.backLogin'))}</span>
      </button>
    </div>
    <p class="auth-switch">
      <button type="button" class="auth-link" data-auth-nav="forgot">${escapeHtml(
        t('auth.reset.resend'),
      )}</button>
    </p>
  `;
}

function socialHtml() {
  return `
    <div class="auth-social">
      <button type="button" class="auth-social-btn" data-auth-social="google">
        <span class="auth-social-mark">${googleMark()}</span>
        <span class="auth-social-text">${escapeHtml(t('auth.continueGoogle'))}</span>
      </button>
      <button type="button" class="auth-social-btn" data-auth-social="facebook">
        <span class="auth-social-mark">${facebookMark()}</span>
        <span class="auth-social-text">${escapeHtml(t('auth.continueFacebook'))}</span>
      </button>
    </div>
  `;
}

/**
 * @param {string} prefix
 */
function fieldEmail(prefix) {
  return `
    <div class="auth-field">
      <label class="auth-label" for="auth-${prefix}-email">${escapeHtml(t('auth.email'))}</label>
      <div class="auth-input-wrap">
        ${icon('mail')}
        <input
          id="auth-${prefix}-email"
          class="auth-input"
          name="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          required
        >
      </div>
      <p class="auth-field-error" data-error-for="email" hidden></p>
    </div>
  `;
}

/**
 * @param {string} prefix
 * @param {string} name
 * @param {string} label
 * @param {boolean} withForgotSpacing
 */
function fieldPassword(prefix, name, label, withForgotSpacing) {
  void withForgotSpacing;
  return `
    <div class="auth-field">
      <label class="auth-label" for="auth-${prefix}-${name}">${escapeHtml(label)}</label>
      <div class="auth-input-wrap">
        ${icon('lock')}
        <input
          id="auth-${prefix}-${name}"
          class="auth-input"
          name="${escapeAttr(name)}"
          type="password"
          autocomplete="${name === 'password' ? (prefix === 'login' ? 'current-password' : 'new-password') : 'new-password'}"
          required
          minlength="8"
        >
        <button
          type="button"
          class="auth-eye"
          data-toggle-password="auth-${prefix}-${name}"
          aria-label="${escapeAttr(t('auth.showPassword'))}"
        >${icon('eye')}</button>
      </div>
      <p class="auth-field-error" data-error-for="${escapeAttr(name)}" hidden></p>
    </div>
  `;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   view: AuthView,
 *   lang: string,
 *   onNavigate: (view: AuthView | 'home') => void,
 *   onAuthenticated: (user: SessionUser) => void,
 * }} options
 */
function bindAuthInteractions(root, options) {
  root.querySelectorAll('[data-auth-nav]').forEach((node) => {
    node.addEventListener('click', () => {
      const next = node.getAttribute('data-auth-nav');
      if (!next) return;
      options.onNavigate(/** @type {AuthView | 'home'} */ (next));
    });
  });

  root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-password');
      const input = id ? document.getElementById(id) : null;
      if (!(input instanceof HTMLInputElement) || !(btn instanceof HTMLElement)) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eye-off' : 'eye');
      btn.setAttribute('aria-label', t(show ? 'auth.hidePassword' : 'auth.showPassword'));
    });
  });

  root.querySelectorAll('[data-auth-social]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('data-auth-social') || 'google';
      const label = provider === 'google' ? 'Google' : 'Facebook';
      // Demo session until Phase 2 OAuth
      const user = {
        email: `${provider}.guest@triply.demo`,
        name: label,
        provider,
      };
      writeSession(user);
      showToast(t('auth.socialDemo', { provider: label }));
      options.onAuthenticated(user);
    });
  });

  const form = root.querySelector('[data-auth-form]');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleSubmit(root, form, options);
    });
  }

  const password = root.querySelector('#auth-signup-password');
  if (password instanceof HTMLInputElement) {
    password.addEventListener('input', () => updateStrength(root, password.value));
  }

  bindOtpInputs(root);
}

/**
 * @param {HTMLElement} root
 * @param {HTMLFormElement} form
 * @param {{
 *   view: AuthView,
 *   onNavigate: (view: AuthView | 'home') => void,
 *   onAuthenticated: (user: SessionUser) => void,
 * }} options
 */
async function handleSubmit(root, form, options) {
  clearErrors(root);
  const data = new FormData(form);
  const kind = form.getAttribute('data-auth-form');
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

  try {
    if (kind === 'login') {
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      if (!EMAIL_RE.test(email)) return setFieldError(root, 'email', t('auth.error.email'));
      if (password.length < 8) return setFieldError(root, 'password', t('auth.error.passwordShort'));

      const result = await authenticateUser(email, password);
      if (!result.ok) {
        if (result.reason === 'storage') return setFormError(root, t('auth.error.storage'));
        return setFormError(root, t('auth.error.badCredentials'));
      }

      writeSession(result.user);
      showToast(t('auth.demoLogin'));
      options.onAuthenticated(result.user);
      return;
    }

    if (kind === 'signup') {
      const name = String(data.get('name') || '').trim();
      const email = String(data.get('email') || '').trim();
      const phone = String(data.get('phone') || '').trim();
      const city = String(data.get('city') || '').trim();
      const ageBand = String(data.get('ageBand') || '').trim();
      const password = String(data.get('password') || '');
      const confirm = String(data.get('confirm') || '');
      const terms = data.get('terms') === '1';
      const ageOk = ['18-24', '25-34', '35-44', '45-54', '55+'].includes(ageBand);

      if (name.length < 2) return setFieldError(root, 'name', t('auth.error.name'));
      if (!EMAIL_RE.test(email)) return setFieldError(root, 'email', t('auth.error.email'));
      if (!isValidBdPhone(phone)) return setFieldError(root, 'phone', t('auth.error.phone'));
      if (!ORIGINS.includes(city)) return setFieldError(root, 'city', t('auth.error.city'));
      if (!ageOk) return setFieldError(root, 'ageBand', t('auth.error.ageBand'));
      if (password.length < 8) return setFieldError(root, 'password', t('auth.error.passwordShort'));
      if (password !== confirm) return setFieldError(root, 'confirm', t('auth.error.passwordMatch'));
      if (!terms) return setFormError(root, t('auth.error.terms'));

      const result = await registerUser({ name, email, phone, city, ageBand, password });
      if (!result.ok) {
        if (result.reason === 'exists') return setFieldError(root, 'email', t('auth.error.exists'));
        if (result.reason === 'email') return setFieldError(root, 'email', t('auth.error.email'));
        if (result.reason === 'phone') return setFieldError(root, 'phone', t('auth.error.phone'));
        if (result.reason === 'city') return setFieldError(root, 'city', t('auth.error.city'));
        if (result.reason === 'ageBand') return setFieldError(root, 'ageBand', t('auth.error.ageBand'));
        if (result.reason === 'passwordShort') {
          return setFieldError(root, 'password', t('auth.error.passwordShort'));
        }
        return setFormError(root, t('auth.error.storage'));
      }

      writeSession(result.user);
      showToast(t('auth.demoSignup'));
      options.onAuthenticated(result.user);
      return;
    }

    if (kind === 'forgot') {
      const email = String(data.get('email') || '').trim();
      if (!EMAIL_RE.test(email)) return setFieldError(root, 'email', t('auth.error.email'));
      try {
        sessionStorage.setItem('triply.resetEmail', email);
      } catch {
        /* ignore */
      }
      form.hidden = true;
      const head = root.querySelector('.auth-card-head');
      if (head instanceof HTMLElement) head.hidden = true;
      const success = root.querySelector('[data-auth-success]');
      const lead = root.querySelector('[data-auth-success-lead]');
      if (lead) lead.textContent = t('auth.forgot.sentLead', { email });
      if (success instanceof HTMLElement) {
        success.hidden = false;
        success.classList.add('is-in');
      }
      showToast(t('auth.forgot.toast'));
      return;
    }

    if (kind === 'reset') {
      const otp = [...root.querySelectorAll('[data-otp-index]')]
        .map((el) => (el instanceof HTMLInputElement ? el.value : ''))
        .join('');
      const password = String(data.get('password') || '');
      const confirm = String(data.get('confirm') || '');
      if (!/^\d{6}$/.test(otp)) return setFieldError(root, 'otp', t('auth.error.otp'));
      if (password.length < 8) return setFieldError(root, 'password', t('auth.error.passwordShort'));
      if (password !== confirm) return setFieldError(root, 'confirm', t('auth.error.passwordMatch'));
      form.hidden = true;
      const head = root.querySelector('.auth-card-head');
      if (head instanceof HTMLElement) head.hidden = true;
      const success = root.querySelector('[data-auth-success]');
      if (success instanceof HTMLElement) {
        success.hidden = false;
        success.classList.add('is-in');
      }
      showToast(t('auth.reset.toast'));
    }
  } finally {
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
  }
}

/**
 * @param {HTMLElement} root
 */
function bindOtpInputs(root) {
  const inputs = [...root.querySelectorAll('[data-otp-index]')].filter(
    (el) => el instanceof HTMLInputElement,
  );
  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      if (input.value && index < inputs.length - 1) inputs[index + 1]?.focus();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1]?.focus();
      }
    });
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) || '';
      text.split('').forEach((ch, i) => {
        if (inputs[i]) inputs[i].value = ch;
      });
      inputs[Math.min(text.length, inputs.length) - 1]?.focus();
    });
  });
}

/**
 * @param {HTMLElement} root
 * @param {string} value
 */
function updateStrength(root, value) {
  const wrap = root.querySelector('[data-auth-strength]');
  const bar = root.querySelector('[data-strength-bar]');
  const label = root.querySelector('[data-strength-label]');
  if (!(wrap instanceof HTMLElement) || !(bar instanceof HTMLElement) || !label) return;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  wrap.dataset.level = String(score);
  bar.style.width = `${(score / 4) * 100}%`;
  const keys = ['auth.strength.none', 'auth.strength.weak', 'auth.strength.fair', 'auth.strength.good', 'auth.strength.strong'];
  label.textContent = t(keys[score] || keys[0]);
}

/**
 * @param {HTMLElement} root
 */
function clearErrors(root) {
  root.querySelectorAll('[data-error-for]').forEach((el) => {
    if (el instanceof HTMLElement) {
      el.hidden = true;
      el.textContent = '';
    }
  });
  const formError = root.querySelector('[data-auth-error]');
  if (formError instanceof HTMLElement) {
    formError.hidden = true;
    formError.textContent = '';
  }
}

/**
 * @param {HTMLElement} root
 * @param {string} field
 * @param {string} message
 */
function setFieldError(root, field, message) {
  const el = root.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
  if (el instanceof HTMLElement) {
    el.hidden = false;
    el.textContent = message;
  } else {
    setFormError(root, message);
  }
}

/**
 * @param {HTMLElement} root
 * @param {string} message
 */
function setFormError(root, message) {
  const el = root.querySelector('[data-auth-error]');
  if (!(el instanceof HTMLElement)) return;
  el.hidden = false;
  el.textContent = message;
}

/**
 * @param {string} message
 */
function showToast(message) {
  const region = document.querySelector('#toast-region');
  if (!(region instanceof HTMLElement)) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-in'));
  window.setTimeout(() => {
    toast.classList.remove('is-in');
    window.setTimeout(() => toast.remove(), 280);
  }, 3200);
}

function googleMark() {
  return `<svg class="auth-brand-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8A6.4 6.4 0 1 1 12 5.6c1.8 0 3 .8 3.7 1.5l2.5-2.4A10 10 0 1 0 12 22c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"/><path fill="#4285F4" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-2.1 0-3.9-1.1-4.8-2.8l-3.1 2.4A10 10 0 0 0 12 22c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z" opacity=".15"/><path fill="#34A853" d="M7.2 14.1A6.4 6.4 0 0 1 7 12c0-.7.1-1.4.3-2.1L4.2 7.5A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l4.1-2.3z"/><path fill="#FBBC05" d="M12 5.6c1.8 0 3 .8 3.7 1.5l2.5-2.4A10 10 0 0 0 4.2 7.5l3.1 2.4C8.1 8.2 9.9 5.6 12 5.6z"/></svg>`;
}

function facebookMark() {
  return `<svg class="auth-brand-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.4l-.5 3.5h-2.9V24C19.6 23.1 24 18.1 24 12.1z"/></svg>`;
}
