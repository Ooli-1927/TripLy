import { t } from '../i18n/i18n.js';
import { formatNumber } from '../utils/format.js';
import { escapeAttr, escapeHtml } from './form.js';
import { icon } from './icons.js';

const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_PREFIX = 'triply.weather.';
const MAX_PARALLEL = 3;

/**
 * @typedef {{
 *   tempC: number,
 *   code: number,
 *   humidity: number | null,
 *   windKmh: number | null,
 *   daily: Array<{ date: string, code: number, maxC: number, minC: number }>,
 *   fetchedAt: number,
 * }} WeatherBundle
 */

/**
 * Placeholder mount point for a destination weather chip.
 * @param {{ id: string, lat: number, lng: number, className?: string }} options
 * @returns {string}
 */
export function weatherSlotHtml(options) {
  const className = options.className ? `weather-slot ${options.className}` : 'weather-slot';
  return `
    <div
      class="${className}"
      data-weather
      data-dest-id="${escapeAttr(options.id)}"
      data-lat="${escapeAttr(String(options.lat))}"
      data-lng="${escapeAttr(String(options.lng))}"
    >
      <button
        type="button"
        class="weather-chip weather-chip--loading"
        data-weather-toggle
        aria-expanded="false"
        aria-controls="weather-panel-${escapeAttr(options.id)}"
        disabled
      >
        <span class="weather-chip-main">
          <span class="weather-skeleton" aria-hidden="true"></span>
          <span>${escapeHtml(t('weather.loading'))}</span>
        </span>
        <span class="weather-live">${escapeHtml(t('weather.live'))}</span>
      </button>
      <div
        class="weather-forecast"
        id="weather-panel-${escapeAttr(options.id)}"
        hidden
        aria-live="polite"
      ></div>
    </div>
  `;
}

/**
 * Fill all `[data-weather]` slots under root.
 * @param {ParentNode} root
 * @param {'en' | 'bn'} [lang]
 */
export function mountWeather(root, lang = 'en') {
  const slots = [...root.querySelectorAll('[data-weather]')];
  if (slots.length === 0) return;

  let index = 0;
  const workers = Array.from({ length: Math.min(MAX_PARALLEL, slots.length) }, async () => {
    while (index < slots.length) {
      const slot = slots[index];
      index += 1;
      if (!(slot instanceof HTMLElement)) continue;
      await hydrateSlot(slot, lang === 'bn' ? 'bn' : 'en');
    }
  });

  void Promise.all(workers);
}

/**
 * @param {HTMLElement} slot
 * @param {'en' | 'bn'} lang
 */
async function hydrateSlot(slot, lang) {
  const destId = slot.getAttribute('data-dest-id') || '';
  const lat = Number(slot.getAttribute('data-lat'));
  const lng = Number(slot.getAttribute('data-lng'));
  const toggle = slot.querySelector('[data-weather-toggle]');
  const panel = slot.querySelector('.weather-forecast');

  if (!destId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    paintUnavailable(slot);
    return;
  }

  try {
    const weather = await getWeatherCached(destId, lat, lng);
    paintReady(slot, weather, lang);
  } catch {
    paintUnavailable(slot);
    return;
  }

  if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    const next = !open;
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    panel.hidden = !next;
    slot.classList.toggle('is-open', next);
  });
}

/**
 * @param {string} destId
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<WeatherBundle>}
 */
export async function getWeatherCached(destId, lat, lng) {
  const key = CACHE_PREFIX + destId;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = /** @type {WeatherBundle} */ (JSON.parse(raw));
      if (
        parsed &&
        typeof parsed.fetchedAt === 'number' &&
        Date.now() - parsed.fetchedAt < CACHE_TTL_MS &&
        Number.isFinite(parsed.tempC)
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore bad cache */
  }

  const weather = await fetchWeather(lat, lng);
  try {
    sessionStorage.setItem(key, JSON.stringify(weather));
  } catch {
    /* quota / private mode */
  }
  return weather;
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<WeatherBundle>}
 */
export async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: '3',
    timezone: 'auto',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather HTTP ${response.status}`);
  }
  const data = await response.json();
  const current = data?.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m))) {
    throw new Error('Weather payload incomplete');
  }

  const dates = Array.isArray(data?.daily?.time) ? data.daily.time : [];
  const codes = Array.isArray(data?.daily?.weather_code) ? data.daily.weather_code : [];
  const maxes = Array.isArray(data?.daily?.temperature_2m_max)
    ? data.daily.temperature_2m_max
    : [];
  const mins = Array.isArray(data?.daily?.temperature_2m_min)
    ? data.daily.temperature_2m_min
    : [];

  /** @type {WeatherBundle['daily']} */
  const daily = [];
  for (let i = 0; i < Math.min(3, dates.length); i += 1) {
    if (!Number.isFinite(Number(maxes[i])) || !Number.isFinite(Number(mins[i]))) continue;
    daily.push({
      date: String(dates[i]),
      code: Number(codes[i]) || 0,
      maxC: Number(maxes[i]),
      minC: Number(mins[i]),
    });
  }

  return {
    tempC: Number(current.temperature_2m),
    code: Number(current.weather_code) || 0,
    humidity: Number.isFinite(Number(current.relative_humidity_2m))
      ? Number(current.relative_humidity_2m)
      : null,
    windKmh: Number.isFinite(Number(current.wind_speed_10m))
      ? Number(current.wind_speed_10m)
      : null,
    daily,
    fetchedAt: Date.now(),
  };
}

/**
 * @param {number} code
 * @returns {{ key: string, icon: string }}
 */
export function mapWeatherCode(code) {
  if (code === 0) return { key: 'clear', icon: 'sun' };
  if (code === 1 || code === 2) return { key: 'clouds', icon: 'cloud-sun' };
  if (code === 3) return { key: 'clouds', icon: 'cloud' };
  if (code === 45 || code === 48) return { key: 'fog', icon: 'cloud-fog' };
  if (code >= 51 && code <= 57) return { key: 'drizzle', icon: 'cloud-rain' };
  if (code >= 61 && code <= 67) return { key: 'rain', icon: 'cloud-rain' };
  if (code >= 71 && code <= 77) return { key: 'snow', icon: 'cloud-snow' };
  if (code >= 80 && code <= 82) return { key: 'rain', icon: 'cloud-rain' };
  if (code >= 85 && code <= 86) return { key: 'snow', icon: 'cloud-snow' };
  if (code >= 95 && code <= 99) return { key: 'storm', icon: 'cloud-lightning' };
  return { key: 'clouds', icon: 'cloud' };
}

/**
 * @param {HTMLElement} slot
 * @param {WeatherBundle} weather
 * @param {'en' | 'bn'} lang
 */
function paintReady(slot, weather, lang) {
  const toggle = slot.querySelector('[data-weather-toggle]');
  const panel = slot.querySelector('.weather-forecast');
  if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;

  const mapped = mapWeatherCode(weather.code);
  const temp = formatTemp(weather.tempC, lang);
  const label = t(`weather.code.${mapped.key}`);
  const summary = t('weather.chipSummary', { temp, condition: label });

  toggle.disabled = false;
  toggle.classList.remove('weather-chip--loading', 'weather-chip--error');
  toggle.classList.add('weather-chip--ready');
  toggle.setAttribute('aria-label', `${t('weather.live')}: ${summary}. ${t('weather.forecastHint')}`);
  toggle.innerHTML = `
    <span class="weather-chip-main">
      ${icon(mapped.icon)}
      <span class="weather-chip-text">${escapeHtml(summary)}</span>
    </span>
    <span class="weather-live">${escapeHtml(t('weather.live'))}</span>
  `;

  const extras = [];
  if (weather.humidity != null) {
    extras.push(
      `<span class="weather-extra">${icon('droplet')}<span>${escapeHtml(
        t('weather.humidity', { n: formatNumber(Math.round(weather.humidity), lang) }),
      )}</span></span>`,
    );
  }
  if (weather.windKmh != null) {
    extras.push(
      `<span class="weather-extra">${icon('wind')}<span>${escapeHtml(
        t('weather.wind', { n: formatNumber(Math.round(weather.windKmh), lang) }),
      )}</span></span>`,
    );
  }

  const days = weather.daily
    .map((day) => {
      const dayMap = mapWeatherCode(day.code);
      return `
        <li class="weather-day">
          <span class="weather-day-name">${escapeHtml(formatDayName(day.date, lang))}</span>
          <span class="weather-day-cond">${icon(dayMap.icon)}<span>${escapeHtml(
            t(`weather.code.${dayMap.key}`),
          )}</span></span>
          <span class="weather-day-temp">${escapeHtml(
            t('weather.dayRange', {
              max: formatTemp(day.maxC, lang),
              min: formatTemp(day.minC, lang),
            }),
          )}</span>
        </li>`;
    })
    .join('');

  panel.innerHTML = `
    <p class="weather-forecast-title">${escapeHtml(t('weather.forecastTitle'))}</p>
    ${extras.length ? `<div class="weather-extras">${extras.join('')}</div>` : ''}
    ${
      days
        ? `<ul class="weather-days">${days}</ul>`
        : `<p class="weather-forecast-empty">${escapeHtml(t('weather.unavailable'))}</p>`
    }
  `;
}

/**
 * @param {HTMLElement} slot
 */
function paintUnavailable(slot) {
  const toggle = slot.querySelector('[data-weather-toggle]');
  const panel = slot.querySelector('.weather-forecast');
  if (!(toggle instanceof HTMLButtonElement)) return;
  toggle.disabled = true;
  toggle.classList.remove('weather-chip--loading');
  toggle.classList.add('weather-chip--error');
  toggle.removeAttribute('aria-expanded');
  toggle.innerHTML = `
    <span class="weather-chip-main">
      ${icon('cloud')}
      <span class="weather-chip-text">${escapeHtml(t('weather.unavailable'))}</span>
    </span>
  `;
  if (panel instanceof HTMLElement) {
    panel.hidden = true;
    panel.innerHTML = '';
  }
}

/**
 * @param {number} celsius
 * @param {'en' | 'bn'} lang
 */
function formatTemp(celsius, lang) {
  const n = formatNumber(Math.round(celsius), lang);
  return t('weather.temp', { n });
}

/**
 * @param {string} isoDate
 * @param {'en' | 'bn'} lang
 */
function formatDayName(isoDate, lang) {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
