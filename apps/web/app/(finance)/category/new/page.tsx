'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card, Sheet } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { PageHeading, SignInGate } from '../../_personal';
import { categoryEmojiOptions } from '@finapp/ui/category-emoji';

export default function NewPersonalCategoryPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [emojiQuery, setEmojiQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const filteredEmojis = categoryEmojiOptions.filter(([, terms]) =>
    terms.includes(emojiQuery.trim().toLowerCase()),
  );
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
      <Link className="finance-secondary-action" href="/category">
        <ArrowLeft size={15} /> Back to categories
      </Link>
      <PageHeading
        eyebrow="NEW CATEGORY"
        title="Create a category"
        description="Choose a concise name and optional text or emoji icon. Categories are archived, not deleted."
      />
      <Card className="finance-form-panel">
        <form className="finance-form" onSubmit={create}>
          <FinanceInput
            label="Category name"
            value={name}
            onChangeText={setName}
            placeholder="Home, travel, groceries…"
            maxLength={80}
            required
          />
          <FinanceInput
            label="Icon (optional)"
            value={icon}
            onChangeText={setIcon}
            placeholder="For example, 🏠"
            maxLength={32}
          />
          <Button
            type="button"
            variant="outline"
            aria-expanded={emojiPickerOpen}
            aria-controls="category-emoji-options"
            onPress={() => {
              setEmojiPickerOpen(true);
              setEmojiQuery('');
            }}
          >
            {icon ? `${icon} Change emoji` : 'Choose emoji'}
          </Button>
          <Sheet
            visible={emojiPickerOpen}
            title="Choose a category emoji"
            onClose={() => {
              setEmojiPickerOpen(false);
              setEmojiQuery('');
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="finance-form-field">
                <span>Search emoji</span>
                <input
                  type="search"
                  aria-label="Search emoji"
                  placeholder="Search food, travel, bills…"
                  value={emojiQuery}
                  onChange={(event) => setEmojiQuery(event.currentTarget.value)}
                />
              </label>
              <div
                id="category-emoji-options"
                role="group"
                aria-label="Category emoji options"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                  gap: 7,
                  maxHeight: 216,
                  overflowY: 'auto',
                }}
              >
                {filteredEmojis.map(([emoji, terms]) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`${emoji} ${terms.split(' ')[0]}`}
                    aria-pressed={icon === emoji}
                    title={terms}
                    onClick={() => {
                      setIcon(emoji);
                      setEmojiPickerOpen(false);
                      setEmojiQuery('');
                    }}
                    style={{
                      minHeight: 42,
                      borderRadius: 12,
                      border: '1px solid var(--finance-line)',
                      background: icon === emoji ? 'var(--finance-panel-raise)' : 'transparent',
                      fontSize: 22,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {filteredEmojis.length === 0 && (
                <p className="finance-muted">No emoji match that search.</p>
              )}
              {icon && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setIcon('');
                    setEmojiPickerOpen(false);
                    setEmojiQuery('');
                  }}
                >
                  Use automatic icon
                </Button>
              )}
            </div>
          </Sheet>
          <p className="finance-form-note">
            Icons are stored as category metadata; no image upload is used.
          </p>
          {error && (
            <p className="finance-form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Saving locally…' : 'Create category'} <ArrowRight size={15} />
          </Button>
        </form>
      </Card>
    </div>
  );
}
