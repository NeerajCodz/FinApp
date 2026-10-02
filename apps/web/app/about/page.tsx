'use client';

import { Heart } from 'lucide-react';
import { Typography, useTheme } from '@finapp/ui/web';

export default function AboutPage() {
  const { tokens } = useTheme();

  return (
    <main className="finance-content">
      <section className="finance-page" style={{ maxWidth: 640, marginInline: 'auto', gap: 24 }}>
        <Typography variant="title">About Finapp</Typography>
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="bodyLarge">v1.0.0</Typography>
          <Typography variant="bodyLarge">
            Developer{' '}
            <a
              href="https://github.com/NeerajCodz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: tokens.primary }}
            >
              @NeerajCodz
            </a>
          </Typography>
        </section>
        <Typography variant="bodyLarge" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          Made with <Heart size={17} color={tokens.primary} aria-label="Heart" /> by Neeraj
        </Typography>
      </section>
    </main>
  );
}
