import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Playfair_Display, Noto_Serif_Devanagari } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const notoDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600'],
  variable: '--font-hindi',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default:  "Smart Shaadi — India's Smart Marriage Ecosystem",
    template: '%s | Smart Shaadi',
  },
  description:
    'Find your life partner with Smart Shaadi — AI-powered matchmaking, Guna Milan compatibility, and complete wedding planning in one platform.',
  keywords: ['matrimonial', 'shaadi', 'marriage', 'Indian wedding', 'matchmaking'],
  authors:  [{ name: 'Smart Shaadi' }],
  robots:   { index: false, follow: false },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${notoDevanagari.variable}`}>
      <body className="bg-[#FEFAF6] text-[#2E2E38] antialiased overflow-x-clip">{children}</body>
    </html>
  );
}
