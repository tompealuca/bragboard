// Renders the Bragboard icon (podium + crown) into every size the app needs.
// Run with: node scripts/generate-icons.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GRADIENT = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8466FF"/>
    <stop offset="1" stop-color="#5531E8"/>
  </linearGradient>`;

function mark({ bar = '#FFFFFF', crown = '#FFC23D', accent = '#E2DAFF' } = {}) {
  return `
    <rect x="218" y="480" width="180" height="300" rx="28" fill="${accent}"/>
    <rect x="422" y="360" width="180" height="420" rx="28" fill="${bar}"/>
    <rect x="626" y="560" width="180" height="220" rx="28" fill="${accent}"/>
    <path d="M412 330 L412 236 L462 286 L512 206 L562 286 L612 236 L612 330 Z" fill="${crown}" stroke="${crown}" stroke-width="16" stroke-linejoin="round"/>
    <circle cx="412" cy="222" r="20" fill="${crown}"/>
    <circle cx="512" cy="190" r="22" fill="${crown}"/>
    <circle cx="612" cy="222" r="20" fill="${crown}"/>`;
}

// The mark is drawn on a 1024 canvas; this centers and scales it.
function group(content, scale) {
  const cx = 512;
  const cy = 485; // visual center of podium + crown
  return `<g transform="translate(${512 - cx * scale} ${512 - cy * scale}) scale(${scale})">${content}</g>`;
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${GRADIENT}${defs}</defs>${body}</svg>`;

const icons = {
  // full-bleed square; iOS and launchers round the corners themselves
  icon: svg(`<rect width="1024" height="1024" fill="url(#bg)"/>${group(mark(), 1)}`),
  // Android adaptive icon: content must stay inside the middle ~66%
  androidForeground: svg(group(mark(), 0.62)),
  androidBackground: svg(`<rect width="1024" height="1024" fill="url(#bg)"/>`),
  androidMonochrome: svg(group(mark({ bar: '#FFFFFF', crown: '#FFFFFF', accent: '#FFFFFF' }), 0.62)),
  splash: svg(group(mark(), 0.9)),
  // rounded version for in-app use and the web
  rounded: svg(`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${group(mark(), 0.92)}`),
};

function render(name, size, file) {
  const png = new Resvg(icons[name], { fitTo: { mode: 'width', value: size } }).render().asPng();
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log('wrote', file, `${size}px`);
}

render('icon', 1024, 'assets/images/icon.png');
render('androidForeground', 1024, 'assets/images/android-icon-foreground.png');
render('androidBackground', 1024, 'assets/images/android-icon-background.png');
render('androidMonochrome', 1024, 'assets/images/android-icon-monochrome.png');
render('splash', 512, 'assets/images/splash-icon.png');
render('rounded', 256, 'assets/images/logo.png');
render('rounded', 48, 'assets/images/favicon.png');
render('icon', 180, 'public/apple-touch-icon.png');
render('icon', 192, 'public/logo192.png');
render('icon', 512, 'public/logo512.png');
writeFileSync(join(root, 'assets/images/icon.svg'), icons.rounded);
