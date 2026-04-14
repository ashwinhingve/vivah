import type { ReactNode } from 'react';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFAF6] flex flex-col items-center justify-start px-4 py-8">
      <div className="mb-6 text-center">
        <h1
          className="text-2xl font-bold text-[#7B2D42]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Smart Shaadi
        </h1>
        <p className="text-xs text-[#6B6B76] mt-1">National Smart Marriage Ecosystem</p>
      </div>
      {children}
    </div>
  );
}
