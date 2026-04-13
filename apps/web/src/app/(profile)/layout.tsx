import type { ReactNode } from 'react';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-start px-4 py-8">
      <div className="mb-6 text-center">
        <h1
          className="text-2xl font-bold text-[#0A1F4D]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Smart Shaadi
        </h1>
        <p className="text-xs text-[#64748B] mt-1">National Smart Marriage Ecosystem</p>
      </div>
      {children}
    </div>
  );
}
