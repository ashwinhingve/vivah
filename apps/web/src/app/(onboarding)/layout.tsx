import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <header className="border-b border-[#C5A47E]/20 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <span className="font-playfair text-xl font-bold text-[#7B2D42]">Smart Shaadi</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
