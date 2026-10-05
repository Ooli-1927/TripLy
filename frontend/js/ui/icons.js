/**
 * Inline Lucide sprite helper.
 * @param {string} name icon id without the `icon-` prefix
 * @param {{ className?: string, label?: string }} [options]
 * @returns {string} SVG markup
 */
export function icon(name, options = {}) {
  const className = options.className ? `icon ${options.className}` : 'icon';
  if (options.label) {
    return `<svg class="${className}" role="img" aria-label="${escapeAttr(options.label)}" focusable="false"><use href="assets/icons.svg#icon-${name}"></use></svg>`;
  }
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#icon-${name}"></use></svg>`;
}

/**
 * @param {string} value
 */
function escapeAttr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
