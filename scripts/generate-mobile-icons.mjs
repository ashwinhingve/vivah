/**
 * One-shot generator: Smart Shaadi brand mark → mobile launcher / splash /
 * adaptive-icon PNGs in apps/mobile/assets/images/.
 *
 * The geometry is the mandap-arch badge kept in sync with the web mark
 * (apps/web/src/app/icon.svg, apps/web/src/components/marketing/Logo.tsx and
 * apps/mobile/src/components/Logo.tsx). Rebuilt here at high resolution instead
 * of upscaling the 32px source so the icon stays crisp at 1024.
 *
 * The brand tile is BURGUNDY, so the launcher icon is full-bleed burgundy with
 * the gold arch + peach/teal flame-heart on top; the Android adaptive icon
 * splits that into a burgundy background layer + a motif-on-transparent
 * foreground (kept inside the ~66% safe zone the launcher may crop to).
 *
 * Run from repo root:  node scripts/generate-mobile-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'apps/mobile/assets/images';

// Brand palette (mirrors apps/mobile/src/theme/tokens.ts light palette).
const BURGUNDY = '#7B2D42';
const GOLD = '#C5A47E';
const PEACH = '#F4D9C2';
const TEAL = '#0E7C7B';

/**
 * The badge motif (arch + finials + pillars + garland + flame-heart) on a 32-unit
 * grid — the FULL variant from the web BadgeSvg. `colors` lets the monochrome
 * layer recolor every element to a single tone.
 */
function motif({ gold, peach, teal }) {
  return `
    <path d="M6.5 14 Q16 4.5 25.5 14" fill="none" stroke="${gold}" stroke-width="2.1" stroke-linecap="round"/>
    <circle cx="10.4" cy="8.4" r="0.9" fill="${gold}"/>
    <circle cx="21.6" cy="8.4" r="0.9" fill="${gold}"/>
    <rect x="5.3" y="13.4" width="2.5" height="9" rx="1.25" fill="${gold}"/>
    <rect x="24.2" y="13.4" width="2.5" height="9" rx="1.25" fill="${gold}"/>
    <rect x="4.5" y="21.6" width="23" height="2.6" rx="1.3" fill="${gold}"/>
    <path d="M11.7 18.6 C 12.9 21.4, 19.1 21.4, 20.3 18.6 Z" fill="${gold}"/>
    <path d="M16 9.4 C 19.6 12.8, 18.7 16.4, 16 18.4 C 13.3 16.4, 12.4 12.8, 16 9.4 Z" fill="${peach}"/>
    <path d="M16 12.4 C 17.9 14.2, 17.4 16.2, 16 17.6 C 14.6 16.2, 14.1 14.2, 16 12.4 Z" fill="${teal}"/>
  `;
}

/**
 * Compose a 1024×1024 SVG: optional background fill + the motif scaled to `span`
 * px and centered. `span` controls padding — smaller span = more breathing room.
 */
function compose({ bg, span, colors }) {
  const scale = span / 32;
  const offset = (1024 - span) / 2;
  const background = bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${background}
    <g transform="translate(${offset},${offset}) scale(${scale})">${motif(colors)}</g>
  </svg>`;
}

const brandColors = { gold: GOLD, peach: PEACH, teal: TEAL };
const monoColors = { gold: '#FFFFFF', peach: '#FFFFFF', teal: '#FFFFFF' };

// Full-bleed burgundy launcher badge (OS applies its own corner mask).
const iconSvg = compose({ bg: BURGUNDY, span: 660, colors: brandColors });
// Motif on transparent, held inside the adaptive safe zone.
const foregroundSvg = compose({ bg: null, span: 560, colors: brandColors });
// Splash mark — sits on the burgundy splash background (app.json), so transparent.
const splashSvg = compose({ bg: null, span: 720, colors: brandColors });
// Monochrome (Android themed icons) — single-tone silhouette on transparent.
const monoSvg = compose({ bg: null, span: 560, colors: monoColors });

async function render(svg, size, name) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log(`  ${name}  ${size}x${size}`);
}

async function solid(hex, size, name) {
  const file = path.join(OUT, name);
  const { r, g, b } = { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
  await sharp({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha: 1 } } })
    .png()
    .toFile(file);
  console.log(`  ${name}  ${size}x${size} solid ${hex}`);
}

await mkdir(OUT, { recursive: true });
console.log('Generating Smart Shaadi mobile icons →', OUT);

await render(iconSvg, 1024, 'icon.png'); // iOS + top-level launcher
await render(iconSvg, 64, 'favicon.png'); // expo web favicon
await render(foregroundSvg, 1024, 'android-icon-foreground.png');
await solid(BURGUNDY, 1024, 'android-icon-background.png');
await render(monoSvg, 1024, 'android-icon-monochrome.png');
await render(splashSvg, 512, 'splash-icon.png');

console.log('done');
