'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LocalRecord } from '@/lib/offline/repository';

export function idOf(record: LocalRecord): string {
  return String(record.id ?? record._id ?? record.cloudId ?? '');
}

export function aliasesOf(record: LocalRecord): string[] {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

export function matchesId(record: LocalRecord, id: string): boolean {
  return aliasesOf(record).includes(id);
}

export function belongsToUser(record: LocalRecord, userId: string): boolean {
  return typeof record.ownerId !== 'string' || record.ownerId === userId;
}

export function localDependency(entity: 'account' | 'category' | 'budget', record: LocalRecord) {
  const id = idOf(record);
  return record.cloudId || record._id || !id ? null : `${entity}:${id}`;
}

export function syncedId(record: LocalRecord): string | null {
  const id = record.cloudId ?? record._id;
  return typeof id === 'string' && id.length > 0 && !id.startsWith('local-') ? id : null;
}

export function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export function minorToInput(value: unknown, currency: string): string {
  const amount = asMinor(value);
  const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2;
  if (digits === 0) return amount.toString();
  const divisor = 10n ** BigInt(digits);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / divisor}.${String(absolute % divisor).padStart(digits, '0')}`;
}


export function dateAtUtcStart(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime()
    : null;
}

export function SignInGate({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="finance-welcome">
      <p className="finance-kicker">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
      <Link className="finance-primary-link" href="/sign-in">
        Sign in <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="finance-page-heading">
      <div>
        <p className="finance-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="finance-muted">{description}</p>
      </div>
    </header>
  );
}

