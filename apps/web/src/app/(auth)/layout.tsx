import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFAF6] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#7B2D42]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Smart Shaadi
        </h1>
        <p className="text-sm text-[#6B6B76] mt-1">National Smart Marriage Ecosystem</p>
      </div>
      {children}
    </div>
  );
}
