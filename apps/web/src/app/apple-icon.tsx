import { ImageResponse } from 'next/og';

// Apple ignores SVG favicons and applies its own rounded mask to home-screen
// icons, so this is a full-bleed burgundy PNG with the brand mark centered.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// FULL-detail mandap + diya motif, minus the background (the div paints it).
// Renders at 128px so the fine detail (finials, garland) stays legible.
// Geometry source of truth: src/components/marketing/Logo.tsx (BadgeSvg, full
// variant); the small-size favicon (src/app/icon.svg) uses the simplified
// variant. Hex mirrors globals.css tokens (Satori can't read CSS vars):
// gold #C5A47E, gold-light #D4B896, peach #F4D9C2, teal #0E7C7B.
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 32 32">
  <path d="M6.5 14 Q16 4.5 25.5 14" fill="none" stroke="#C5A47E" stroke-width="2.1" stroke-linecap="round"/>
  <circle cx="10.4" cy="8.4" r="0.9" fill="#D4B896"/>
  <circle cx="21.6" cy="8.4" r="0.9" fill="#D4B896"/>
  <rect x="5.3" y="13.4" width="2.5" height="9" rx="1.25" fill="#C5A47E"/>
  <rect x="24.2" y="13.4" width="2.5" height="9" rx="1.25" fill="#C5A47E"/>
  <rect x="4.5" y="21.6" width="23" height="2.6" rx="1.3" fill="#C5A47E"/>
  <path d="M11.7 18.6 C 12.9 21.4, 19.1 21.4, 20.3 18.6 Z" fill="#C5A47E"/>
  <path d="M16 9.4 C 19.6 12.8, 18.7 16.4, 16 18.4 C 13.3 16.4, 12.4 12.8, 16 9.4 Z" fill="#F4D9C2"/>
  <path d="M16 12.4 C 17.9 14.2, 17.4 16.2, 16 17.6 C 14.6 16.2, 14.1 14.2, 16 12.4 Z" fill="#0E7C7B"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // eslint-disable-next-line no-restricted-syntax -- ImageResponse (Satori) renders PNGs and cannot use Tailwind classNames; the brand burgundy must be a literal hex here.
          background: '#7B2D42',
        }}
      >
        <img
          width={128}
          height={128}
          alt="Smart Shaadi"
          src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`}
        />
      </div>
    ),
    size,
  );
}
