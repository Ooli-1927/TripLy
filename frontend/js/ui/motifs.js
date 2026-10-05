/**
 * Destination-type landscape motifs (SVG). Used until local photos exist.
 */

/** @type {Record<string, 'hills' | 'sea' | 'forest' | 'river' | 'heritage'>} */
const TYPE_BY_ID = {
  'coxs-bazar': 'sea',
  'saint-martin': 'sea',
  bandarban: 'hills',
  rangamati: 'river',
  sreemangal: 'forest',
  jaflong: 'hills',
  sonargaon: 'heritage',
  sundarbans: 'forest',
  kuakata: 'sea',
  paharpur: 'heritage',
};

/**
 * @param {string} id
 * @returns {'hills' | 'sea' | 'forest' | 'river' | 'heritage'}
 */
export function motifTypeFor(id) {
  return TYPE_BY_ID[id] ?? 'river';
}

/**
 * @param {string} id
 * @returns {string} SVG markup
 */
export function motifSvg(id) {
  const type = motifTypeFor(id);
  if (type === 'sea') return seaSvg();
  if (type === 'hills') return hillsSvg();
  if (type === 'forest') return forestSvg();
  if (type === 'heritage') return heritageSvg();
  return riverSvg();
}

/**
 * Full-bleed monsoon hero atmosphere (Home).
 * @returns {string}
 */
export function heroAtmosphereSvg() {
  return `
  <svg class="hero-atmosphere-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="#0a2430"/>
        <stop offset="45%" stop-color="#0e3d42"/>
        <stop offset="100%" stop-color="#0a2a24"/>
      </linearGradient>
    </defs>
    <rect width="1440" height="900" fill="url(#skyGrad)"/>
    <circle class="motif-sun" cx="1180" cy="150" r="58" fill="#f0c35a" opacity="0.55"/>
    <circle class="motif-sun" cx="1180" cy="150" r="110" fill="#1a8f63" opacity="0.12"/>
    <g class="motif-cloud" opacity="0.18" fill="#d7eaf2">
      <ellipse cx="220" cy="140" rx="90" ry="28"/>
      <ellipse cx="280" cy="132" rx="60" ry="22"/>
      <ellipse cx="160" cy="138" rx="50" ry="18"/>
    </g>
    <g class="motif-cloud motif-cloud--delay" opacity="0.12" fill="#d7eaf2">
      <ellipse cx="980" cy="220" rx="110" ry="30"/>
      <ellipse cx="1040" cy="210" rx="70" ry="24"/>
    </g>
    <path d="M0 400 C180 340, 320 440, 480 380 S780 300, 960 380 S1240 440, 1440 360 L1440 900 L0 900 Z" fill="#127a4e" opacity="0.45"/>
    <path d="M0 500 C200 440, 360 540, 560 480 S900 400, 1120 480 S1320 540, 1440 460 L1440 900 L0 900 Z" fill="#0f6b45" opacity="0.7"/>
    <path class="motif-wave" d="M0 600 C160 560, 320 640, 500 600 S820 520, 1020 600 S1280 660, 1440 600 L1440 900 L0 900 Z" fill="#1f7f96" opacity="0.55"/>
    <path class="motif-wave motif-wave--delay" d="M0 700 C200 660, 380 740, 580 700 S900 640, 1100 700 S1300 760, 1440 700 L1440 900 L0 900 Z" fill="#176f85" opacity="0.5"/>
    <path d="M0 800 C240 780, 480 820, 720 800 S1080 760, 1440 810 L1440 900 L0 900 Z" fill="#0b3d2a" opacity="0.45"/>
  </svg>`;
}

function seaSvg() {
  return `
  <svg class="motif-svg" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect width="640" height="360" fill="var(--motif-sky)"/>
    <circle class="motif-sun" cx="520" cy="78" r="36" fill="var(--color-accent-soft)" opacity="0.9"/>
    <path class="motif-wave" d="M0 180 C80 150, 160 210, 240 180 S400 130, 480 175 S580 210, 640 170 L640 360 L0 360 Z" fill="var(--motif-water)"/>
    <path class="motif-wave motif-wave--delay" d="M0 230 C100 210, 180 250, 280 225 S460 190, 560 230 S620 250, 640 235 L640 360 L0 360 Z" fill="var(--motif-sand)" opacity="0.8"/>
    <path class="motif-wave" d="M0 280 C120 265, 220 300, 340 275 S520 250, 640 285 L640 360 L0 360 Z" fill="var(--motif-water)" opacity="0.65"/>
  </svg>`;
}

function hillsSvg() {
  return `
  <svg class="motif-svg" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect width="640" height="360" fill="var(--motif-sky)"/>
    <circle class="motif-sun" cx="500" cy="70" r="28" fill="var(--color-accent-soft)" opacity="0.75"/>
    <path d="M0 280 L120 120 L220 220 L320 80 L440 210 L540 110 L640 250 L640 360 L0 360 Z" fill="var(--motif-land)" opacity="0.45"/>
    <path d="M0 300 L160 170 L280 260 L400 140 L640 280 L640 360 L0 360 Z" fill="var(--motif-land)"/>
    <path class="motif-wave" d="M0 320 C140 300, 280 340, 420 310 S560 300, 640 325 L640 360 L0 360 Z" fill="var(--motif-water)" opacity="0.4"/>
  </svg>`;
}

function forestSvg() {
  return `
  <svg class="motif-svg" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect width="640" height="360" fill="var(--motif-sky)"/>
    <ellipse class="motif-drift" cx="120" cy="210" rx="70" ry="90" fill="var(--motif-land)" opacity="0.65"/>
    <ellipse class="motif-drift motif-wave--delay" cx="230" cy="180" rx="85" ry="110" fill="var(--motif-land)"/>
    <ellipse class="motif-drift" cx="360" cy="200" rx="78" ry="100" fill="var(--motif-land)" opacity="0.85"/>
    <ellipse class="motif-drift motif-wave--delay" cx="500" cy="215" rx="72" ry="95" fill="var(--motif-land)" opacity="0.7"/>
    <rect x="0" y="290" width="640" height="70" fill="var(--motif-land)" opacity="0.35"/>
    <path class="motif-wave" d="M0 300 C140 285, 280 320, 420 295 S560 285, 640 310 L640 360 L0 360 Z" fill="var(--motif-water)" opacity="0.35"/>
  </svg>`;
}

function riverSvg() {
  return `
  <svg class="motif-svg" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect width="640" height="360" fill="var(--motif-sky)"/>
    <path d="M0 160 C100 100, 180 220, 280 150 S460 80, 640 170 L640 360 L0 360 Z" fill="var(--motif-land)" opacity="0.45"/>
    <path class="motif-wave" d="M0 220 C120 180, 200 260, 320 210 S500 160, 640 230 L640 360 L0 360 Z" fill="var(--motif-water)"/>
    <path class="motif-wave motif-wave--delay" d="M0 270 C140 245, 260 300, 400 265 S540 250, 640 280 L640 360 L0 360 Z" fill="var(--motif-water)" opacity="0.6"/>
  </svg>`;
}

function heritageSvg() {
  return `
  <svg class="motif-svg" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect width="640" height="360" fill="var(--motif-sky)"/>
    <circle class="motif-sun" cx="520" cy="80" r="22" fill="var(--color-accent)" opacity="0.7"/>
    <rect x="0" y="250" width="640" height="110" fill="var(--motif-sand)" opacity="0.5"/>
    <path d="M220 250 L320 90 L420 250 Z" fill="var(--motif-stone)"/>
    <rect x="255" y="170" width="130" height="80" fill="var(--motif-stone)" opacity="0.9"/>
    <rect x="295" y="195" width="50" height="55" fill="var(--motif-sky)"/>
    <rect x="140" y="220" width="55" height="30" fill="var(--motif-stone)" opacity="0.7"/>
    <rect x="445" y="220" width="55" height="30" fill="var(--motif-stone)" opacity="0.7"/>
    <path class="motif-wave" d="M0 300 C160 285, 320 315, 480 295 S600 290, 640 305 L640 360 L0 360 Z" fill="var(--motif-land)" opacity="0.2"/>
  </svg>`;
}
