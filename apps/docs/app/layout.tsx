import type { Metadata, Viewport } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@finapp/ui/web/styles.css';
import './docs.css';
import { THEME_SCRIPT, themeCss } from '@/lib/theme';
import { navigation } from '@/lib/content';
import { DocsHeader } from '@/components/DocsHeader';
import { Sidebar } from '@/components/Sidebar';

const brand = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const reading = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'FinApp Docs', template: '%s · FinApp Docs' },
  description: 'Guides for FinApp, the MCP server, the public REST API, webhooks and self-hosting.',
  applicationName: 'FinApp Docs',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nav = navigation();
  return (
    <html lang="en" className={`${brand.variable} ${reading.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <DocsHeader />
        <div className="shell">
          <Sidebar nav={nav} />
          <main id="content" className="main">
            {children}
          </main>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
