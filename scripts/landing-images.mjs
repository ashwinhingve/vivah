/**
 * One-shot converter: reference PNGs in "landing page images/" →
 * optimized webp assets in apps/web/public/landing/.
 *
 * Run from repo root:  node scripts/landing-images.mjs
 */
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'landing page images';
const OUT = 'apps/web/public/landing';

const src = (name) => path.join(SRC, `ChatGPT Image Jul 9, 2026, ${name}.png`);

async function emit(name, pipeline) {
  const file = path.join(OUT, name);
  await pipeline.webp({ quality: 80 }).toFile(file);
  const { size } = await stat(file);
  const meta = await sharp(file).metadata();
  console.log(`${name}  ${meta.width}x${meta.height}  ${(size / 1024).toFixed(0)}KB`);
}

await mkdir(OUT, { recursive: true });

// Hero photo — couple in golden light (06_04_51)
{
  const img = sharp(src('06_04_51 PM'));
  await emit('couple-golden.webp', img.resize({ width: 1600, withoutEnlargement: true }));
}

// Demo-profile avatar — bride face crop from the same photo
{
  const meta = await sharp(src('06_04_51 PM')).metadata();
  const w = meta.width, h = meta.height;
  const size = Math.round(w * 0.21);
  const left = Math.round(w * 0.30);
  const top = Math.round(h * 0.195);
  const img = sharp(src('06_04_51 PM')).extract({ left, top, width: size, height: size }).resize(256, 256);
  await emit('avatar-bride.webp', img);
}

// Dusk lake-palace couple (06_04_26) — CTA banner + footer arch
{
  const img = sharp(src('06_04_26 PM'));
  await emit('couple-dusk.webp', img.resize({ width: 1920, withoutEnlargement: true }));
}

// Mandap-at-dusk panorama — strip 2 of the 4-strip sheet (06_04_45)
{
  const meta = await sharp(src('06_04_45 PM')).metadata();
  const h = meta.height;
  const top = Math.round(h * 0.259);
  const height = Math.round(h * 0.24);
  const img = sharp(src('06_04_45 PM')).extract({ left: 0, top, width: meta.width, height });
  await emit('mandap-dusk.webp', img);
}

// Ivory floral texture (06_05_11) — hero/section background
{
  const img = sharp(src('06_05_11 PM'));
  await emit('floral-ivory.webp', img.resize({ width: 1920, withoutEnlargement: true }));
}

console.log('done');
