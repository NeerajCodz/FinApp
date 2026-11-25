import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Manrope, Source_Serif_4 } from 'next/font/google';
import appIcon from '../../mobile/assets/icon.png';
import '@finapp/ui/web/styles.css';
import './globals.css';
import './coin.css';
import './landing.css';
import './auth.css';
import './finance.css';
import './mcp.css';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/next';

const spaceGrotesk = localFont({
  src: [
    { path: '../public/fonts/SpaceGrotesk-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/SpaceGrotesk-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/SpaceGrotesk-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/SpaceGrotesk-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
  fallback: ['Avenir Next', 'sans-serif'],
});

/** Reading face for body copy (the brand face stays for headings, buttons and the logo). */
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

/** FinAI's voice in chat replies. */
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Finapp — Money, in sync',
  description: 'A calmer way to keep spending, saving, and shared expenses in sync.',
  applicationName: 'Finapp',
  icons: { icon: appIcon.src },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
