import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#FEFAF6] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Mandala decoration — top right */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 opacity-[0.08]"
        fill="none"
      >
        <circle cx="200" cy="200" r="190" stroke="#C5A47E" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="155" stroke="#C5A47E" strokeWidth="1" />
        <circle cx="200" cy="200" r="120" stroke="#C5A47E" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="85" stroke="#C5A47E" strokeWidth="1" />
        <circle cx="200" cy="200" r="50" stroke="#C5A47E" strokeWidth="1.5" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x1 = 200 + 50 * Math.cos(r);
          const y1 = 200 + 50 * Math.sin(r);
          const x2 = 200 + 190 * Math.cos(r);
          const y2 = 200 + 190 * Math.sin(r);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C5A47E" strokeWidth="0.75" />;
        })}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const cx = 200 + 120 * Math.cos(r);
          const cy = 200 + 120 * Math.sin(r);
          return <circle key={deg} cx={cx} cy={cy} r="6" stroke="#C5A47E" strokeWidth="1" />;
        })}
      </svg>

      {/* Bottom left small mandala */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -bottom-10 -left-10 w-40 h-40 opacity-[0.06]"
        fill="none"
      >
        <circle cx="100" cy="100" r="95" stroke="#7B2D42" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="65" stroke="#7B2D42" strokeWidth="1" />
        <circle cx="100" cy="100" r="35" stroke="#7B2D42" strokeWidth="1.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const x1 = 100 + 35 * Math.cos(r);
          const y1 = 100 + 35 * Math.sin(r);
          const x2 = 100 + 95 * Math.cos(r);
          const y2 = 100 + 95 * Math.sin(r);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7B2D42" strokeWidth="0.75" />;
        })}
      </svg>

      <div className="mb-8 text-center relative z-10">
        <h1
          className="text-4xl font-bold text-[#7B2D42] tracking-tight"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Smart Shaadi
        </h1>
        <p className="text-sm text-[#C5A47E] mt-1 font-medium tracking-wide">Find your perfect match</p>
        <p className="text-xs text-[#6B6B76] mt-0.5">National Smart Marriage Ecosystem</p>
      </div>
      <div className="relative z-10 w-full flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}
