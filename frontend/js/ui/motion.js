/**
 * Scroll / enter reveals. All motion gated by prefers-reduced-motion.
 */

/**
 * Observe `[data-reveal]` nodes and add `.is-in` when visible.
 * Optional stagger via `data-reveal-delay` (ms) or sibling index.
 * @param {ParentNode} [root=document]
 */
export function bindReveals(root = document) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes = [...root.querySelectorAll('[data-reveal]')];
  nodes.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) return;
    const explicit = Number(node.getAttribute('data-reveal-delay'));
    const delay = Number.isFinite(explicit) ? explicit : Math.min(index * 55, 360);
    node.style.setProperty('--reveal-delay', `${delay}ms`);
  });
  if (reduce) {
    nodes.forEach((node) => node.classList.add('is-in'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  nodes.forEach((node) => io.observe(node));
}

/**
 * Collapse the results situation bar after a short scroll.
 * @param {ParentNode} root
 */
export function bindSummaryCollapse(root) {
  const bar = root.querySelector('.summary-bar');
  if (!(bar instanceof HTMLElement)) return;

  const update = () => {
    bar.classList.toggle('is-compact', window.scrollY > 48);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/**
 * Toggle `.is-scrolled` on the site header after a small scroll.
 */
export function bindHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!(header instanceof HTMLElement)) return;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/**
 * Prevent accidental page zoom from touchpad pinch (Ctrl+wheel) and
 * Safari gesture events. Keyboard zoom (Ctrl +/- / 0) stays available.
 * Never applies layout transforms — those caused blank horizontal space.
 */
export function lockPageZoom() {
  const blockWheelZoom = (event) => {
    if (event.ctrlKey) event.preventDefault();
  };

  const blockDoubleClickZoom = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, input, select, textarea, label')) {
      event.preventDefault();
    }
  };

  window.addEventListener('wheel', blockWheelZoom, { passive: false, capture: true });
  document.addEventListener('dblclick', blockDoubleClickZoom, { capture: true });

  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (event) => {
      event.preventDefault();
    });
  }
}
