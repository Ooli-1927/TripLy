/**
 * Format a number for display. Callers still label costs and times as estimates via i18n.
 * @param {number} value
 * @param {'en' | 'bn'} [lang='en']
 * @returns {string}
 */
export function formatNumber(value, lang = 'en') {
  const locale = lang === 'bn' ? 'bn-BD' : 'en-BD';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}
