import type { Metadata, Viewport } from 'next';
import { Cinzel, Cinzel_Decorative } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel',
  weight: ['400', '600', '700', '900'],
});

const cinzelDecorative = Cinzel_Decorative({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel-decorative',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://astrodorado.com'),
  title: {
    default: 'AstroDorado — Horóscopo diario con IA',
    template: '%s | AstroDorado',
  },
  description:
    'Horóscopo diario personalizado con astrología de precisión. 12 signos, amor, trabajo, suerte.',
  applicationName: 'AstroDorado',
  authors: [{ name: 'NextHorizont AI', url: 'https://nexthorizont.ai' }],
  creator: 'NextHorizont AI',
  publisher: 'NextHorizont AI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0014',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${cinzel.variable} ${cinzelDecorative.variable}`}>
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
