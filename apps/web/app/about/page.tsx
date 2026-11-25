'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { Check, Copy, Heart } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { CoinLogo } from '@/components/brand/CoinLogo';
import { Button, Typography, useTheme } from '@finapp/ui/web';
import { diagnosticsText, versionRows } from '@finapp/ui/version';

export default function AboutPage() {
  const { tokens } = useTheme();
  const backend = useQuery(api.system.info, {});
  const [copied, setCopied] = React.useState(false);
  const rows = versionRows({
    platform: 'web',
    backend,
    commit: process.env.NEXT_PUBLIC_GIT_SHA,
    environment: process.env.NEXT_PUBLIC_DEPLOY_ENV,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(diagnosticsText(rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="finance-content">
      <section className="finance-page" style={{ maxWidth: 640, marginInline: 'auto', gap: 24 }}>
        <Typography variant="title">About Finapp</Typography>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 180 }}>
            <CoinLogo interactive />
          </div>
        </div>
        <section
          aria-label="Version information"
          style={{
            display: 'grid',
            gap: 2,
            padding: 16,
            borderRadius: 18,
            border: `1px solid ${tokens.borderSubtle}`,
            background: tokens.card,
          }}
        >
          <dl style={{ display: 'grid', gap: 10, margin: 0 }}>
            {rows.map((row) => (
              <div
                key={row.label}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}
              >
                <dt style={{ color: tokens.foregroundMuted }}>{row.label}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <div style={{ marginTop: 14 }}>
            <Button variant="outline" size="sm" onPress={() => void copy()}>
              {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{' '}
              {copied ? 'Copied' : 'Copy diagnostics'}
            </Button>
          </div>
        </section>
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
        <Typography variant="bodyLarge" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          Made with <Heart size={17} color={tokens.primary} aria-label="Heart" /> by Neeraj
        </Typography>
      </section>
    </main>
  );
}
