'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import { CategoryEmojiPicker, CategoryIcon } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { SignInGate } from '../../_personal';

export default function NewPersonalCategoryPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const trimmedName = name.trim();
    const trimmedIcon = icon.trim();
    if (!trimmedName) {
      setError('Enter a category name.');
      return;
    }
    if (trimmedIcon.length > 32) {
      setError('Choose an icon no longer than 32 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: trimmedName,
        ...(trimmedIcon ? { icon: trimmedIcon } : {}),
        isSystem: false,
        sortOrder: now,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'category', 'category.create', record, {
        name: trimmedName,
        ...(trimmedIcon ? { icon: trimmedIcon } : {}),
      });
      router.replace(`/category/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this category.');
    } finally {
      setSaving(false);
    }
  }
  if (!userId)
    return (
      <SignInGate eyebrow="NEW CATEGORY" title="Give activity a home.">
        Sign in to add a category to your local-first finance records.
      </SignInGate>
    );
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/categories" aria-label="Go back">
        <ArrowLeft size={19} />
      </Link>
      <div style={{ display: 'grid', gap: 30, flex: 1, alignContent: 'center' }}>
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CategoryIcon label={name.trim() || 'Category'} icon={icon || undefined} />
            <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 24 }}>
              {name.trim() || 'New category'}
            </h1>
          </div>
          <p className="finance-muted" style={{ maxWidth: 300, margin: 0 }}>
            Give your money a place to belong.
          </p>
          <CategoryEmojiPicker
            value={icon || undefined}
            onChange={(emoji) => setIcon(emoji ?? '')}
          />
        </section>
        <form className="finance-form" onSubmit={create}>
          <FinanceInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Groceries"
            maxLength={80}
            required
          />
          {error && (
            <p className="finance-form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Create category'}
          </Button>
        </form>
      </div>
    </div>
  );
}
