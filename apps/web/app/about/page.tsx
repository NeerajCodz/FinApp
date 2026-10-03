'use client';

import { Heart } from 'lucide-react';
import Image from 'next/image';
import appIcon from '../../../mobile/assets/icon.png';
import { Typography, useTheme } from '@finapp/ui/web';

export default function AboutPage() {
  const { tokens } = useTheme();

  return (
    <main className="finance-content">
      <section className="finance-page" style={{ maxWidth: 640, marginInline: 'auto', gap: 24 }}>
        <Typography variant="title">About Finapp</Typography>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Image
            src={appIcon}
            alt="Finapp app logo"
            width={96}
            height={96}
            style={{ borderRadius: 22 }}
          />
        </div>
        <section style={{ display: 'grid', gap: 12 }}>
          <Typography variant="bodyLarge">v1.1.3</Typography>
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
