import type { ReactNode } from 'react';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-8">
      <div className="mb-6 text-center">
        <h1
          className="text-2xl font-bold text-primary font-heading"
        >
          Smart Shaadi
        </h1>
        <p className="text-xs text-muted-foreground mt-1">National Smart Marriage Ecosystem</p>
      </div>
      {children}
    </div>
  );
}
