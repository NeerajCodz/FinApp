import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Manrope } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import appIcon from '../../mobile/assets/icon.png';
import '@finapp/ui/web/styles.css';
import './admin.css';
import { Providers } from './providers';

const spaceGrotesk = localFont({
  src: [
    { path: '../../web/public/fonts/SpaceGrotesk-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../web/public/fonts/SpaceGrotesk-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../web/public/fonts/SpaceGrotesk-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../../web/public/fonts/SpaceGrotesk-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
  fallback: ['Avenir Next', 'sans-serif'],
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const metadata: Metadata = {
  title: 'Finapp Admin',
  description: 'Finapp staff console.',
  applicationName: 'Finapp Admin',
  icons: { icon: appIcon.src },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
