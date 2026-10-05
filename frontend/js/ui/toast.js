/**
 * Show a short live-region toast.
 * @param {string} message
 */
export function showToast(message) {
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
