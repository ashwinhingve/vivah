# PWA Icons

This directory should contain the following PNG icon files (generated from the Smart Shaadi brand mark):

## Required Files

### Main Icons
- `icon-192x192.png` — 192×192 PNG icon for PWA homescreen (any purpose)
- `icon-512x512.png` — 512×512 PNG icon for PWA splash screen (any purpose)

### Maskable Icons (for adaptive icon shape)
- `icon-192x192-maskable.png` — 192×192 PNG icon for adaptive display (maskable purpose)
- `icon-512x512-maskable.png` — 512×512 PNG icon for adaptive display (maskable purpose)

### Screenshots
- `screenshot-540x720.png` — 540×720 PNG screenshot of the app in action

## Generation Instructions

All icons should be generated from the Smart Shaadi brand mark using the following specifications:

**Design**
- Source: The brand mandap + diya motif from `src/app/apple-icon.tsx` or `src/components/marketing/Logo.tsx`
- Background: #FEFAF6 (warm ivory)
- Brand color: #7B2D42 (burgundy)
- Style: Modern, clean, matrimonial aesthetic

**Maskable Icons (Android Adaptive Icon)**
- The icon must work when cropped to various shapes (circle, rounded square, teardrop)
- Safe zone: Inner 66% of the square (72px for 192×192, 338px for 512×512)
- Extended zone: Full image, used for safe areas in adaptive display

**Screenshots**
- Show the dashboard/matches feed page
- Include the brand colors and UI elements
- No text overlays required; focus on the UI

### Generation Tools
- **Node.js + Sharp**: `pnpm add --save-dev sharp` (for batch PNG generation)
- **ImageMagick**: `convert` CLI (if Sharp not available)
- **Online PWA Generator**: https://www.pwabuilder.com/ (supports batch icon generation)
- **Figma Export**: If design is available in Figma, export directly to PNG

### Example Command (using Sharp in Node.js)
```javascript
const sharp = require('sharp');

// SVG brand mark from icon.svg
const svg = `<svg ...>...</svg>`;

// Generate icons
await sharp(Buffer.from(svg))
  .png()
  .resize(192, 192)
  .toFile('icon-192x192.png');

await sharp(Buffer.from(svg))
  .png()
  .resize(512, 512)
  .toFile('icon-512x512.png');
```

### Next Steps
1. Generate the icons using your preferred tool
2. Place them in this directory (`apps/web/public/icons/`)
3. Run `pnpm build` to verify the manifest resolves correctly
4. Test with `pnpm dev` and open Chrome DevTools → Application → Manifest to verify

## References
- Next.js manifest.ts: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- PWA Icon Requirements: https://web.dev/add-manifest/#create-the-manifest
- Android Adaptive Icon: https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive
