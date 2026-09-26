import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@finapp/ui/web/styles.css';
import './globals.css';
import './landing.css';
import './auth.css';
import './finance.css';
import { Providers } from './providers';

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

export const metadata: Metadata = {
  title: 'Finapp — Money, in sync',
  description: 'A calmer way to keep spending, saving, and shared expenses in sync.',
  applicationName: 'Finapp',
  icons: { icon: '/icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
