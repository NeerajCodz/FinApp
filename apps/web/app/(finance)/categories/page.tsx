'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Tags } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  sortOrder?: number;
  archivedAt?: number;
  cloudId?: string;
  isSystem?: boolean;
};
const recordId = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function CategoriesPage() {
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Category>('category');
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const sorted = [...records].sort(
    (a, b) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
  const active = sorted.filter((category) => category.archivedAt === undefined);
  const archived = sorted.filter((category) => category.archivedAt !== undefined);

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const now = Date.now();
      await commitLocalWrite(
        userId,
        'category',
        'category.create',
        {
          ownerId: userId,
          name: name.trim(),
          ...(icon.trim() ? { icon: icon.trim() } : {}),
          isSystem: false,
          sortOrder: now,
          createdAt: now,
          updatedAt: now,
        },
        { name: name.trim(), ...(icon.trim() ? { icon: icon.trim() } : {}) },
      );
      setName('');
      setIcon('');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save this category.');
    } finally {
      setSaving(false);
    }
  }

  async function updateCategory(category: Category, action: 'rename' | 'archive') {
    if (!userId || saving) return;
    const id = recordId(category);
    const cloudId =
      category.cloudId ?? (typeof category._id === 'string' ? category._id : undefined);
    if (!cloudId) {
      setFormError(
        'This category is saved locally. Rename or archive becomes available after it syncs.',
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (action === 'rename') {
        const trimmed = editName.trim();
        if (!trimmed) throw new Error('Enter a category name.');
        await commitLocalWrite(
          userId,
          'category',
          'category.rename',
          {
            ...category,
            name: trimmed,
          },
          { categoryId: cloudId, name: trimmed },
          { recordId: id },
        );
        setEditingId(null);
        setEditName('');
      } else {
        await commitLocalWrite(
          userId,
          'category',
          'category.archive',
          {
            ...category,
            archivedAt: Date.now(),
          },
          { categoryId: cloudId },
          { recordId: id },
        );
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this category.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">ORGANIZE YOUR MONEY</p>
        <h1>Categories</h1>
        <p>Sign in to manage categories saved in this browser.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">GIVE EVERY MOVE A PLACE</p>
          <h1>Categories</h1>
          <p className="finance-muted">
            Keep spending and income organized. Changes save to this browser first.
          </p>
        </div>
        <Badge variant="neutral">{active.length} active</Badge>
      </header>
      {(error || formError) && (
        <p className="finance-form-error" role="alert">
          {formError ?? `Local categories could not be loaded: ${error}`}
        </p>
      )}
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader title="Your categories" action={<span>{active.length} active</span>} />
          {loading ? (
            <p className="finance-muted" role="status">
              Opening your local categories…
            </p>
          ) : error ? (
            <p className="finance-muted">Reload this page to try local storage again.</p>
          ) : active.length === 0 ? (
            <Empty
              title="Start with one useful category"
              description="Add categories such as groceries, transport, or salary to make activity easier to understand."
              icon={<Tags size={20} />}
            />
          ) : (
            <ul
              className="finance-record-list"
              style={{ margin: 0, padding: 0, listStyle: 'none' }}
            >
              {active.map((category) => {
                const id = recordId(category);
                return (
                  <li className="finance-plan-card" key={id}>
                    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'grid',
                          width: 42,
                          height: 42,
                          flex: '0 0 auto',
                          placeItems: 'center',
                          border: '1px solid var(--finance-line)',
                          borderRadius: 12,
                          color: 'var(--finance-lime)',
                          fontSize: '1.1rem',
                        }}
                      >
                        {category.icon || (category.name ?? 'C').slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong>{category.name ?? 'Category'}</strong>
                        <small>
                          {category.isSystem
                            ? 'Built-in category'
                            : category.cloudId || category._id
                              ? 'Synced record'
                              : 'Saved locally · waiting to sync'}
                        </small>
                      </span>
                    </div>
                    {editingId === id ? (
                      <form
                        className="finance-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void updateCategory(category, 'rename');
                        }}
                      >
                        <FinanceInput
                          label={`Name for ${category.name ?? 'category'}`}
                          value={editName}
                          onChangeText={(value) => setEditName(value)}
                          maxLength={64}
                          required
                        />
                        <div className="finance-form-actions">
                          <Button type="submit" disabled={saving || !editName.trim()}>
                            {saving ? 'Saving…' : 'Save name'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onPress={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            saving || category.isSystem || !(category.cloudId || category._id)
                          }
                          aria-label={`Rename ${category.name ?? 'category'}`}
                          onPress={() => {
                            setEditingId(id);
                            setEditName(category.name ?? '');
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={saving || !(category.cloudId || category._id)}
                          aria-label={`Archive ${category.name ?? 'category'}`}
                          onPress={() => {
                            if (window.confirm(`Archive ${category.name ?? 'this category'}?`))
                              void updateCategory(category, 'archive');
                          }}
                        >
                          Archive
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {archived.length > 0 && (
            <div
              style={{
                display: 'grid',
                gap: 8,
                marginTop: 18,
                paddingTop: 14,
                borderTop: '1px solid var(--finance-line)',
              }}
            >
              <Button
                type="button"
                variant="ghost"
                aria-expanded={showArchived}
                onPress={() => setShowArchived((value) => !value)}
              >
                {showArchived ? 'Hide' : 'Show'} {archived.length} archived
              </Button>
              {showArchived && (
                <ul
                  className="finance-record-list"
                  style={{ margin: 0, padding: 0, listStyle: 'none' }}
                >
                  {archived.map((category) => (
                    <li className="finance-record-item" key={recordId(category)}>
                      <span>
                        {category.icon ? `${category.icon} ` : ''}
                        {category.name ?? 'Category'}
                      </span>
                      <span className="finance-muted">Archived</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
        <Card className="finance-record-panel">
          <SectionHeader title="Add a category" action={<Plus size={18} aria-hidden="true" />} />
          <form className="finance-form" onSubmit={createCategory}>
            <FinanceInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Groceries"
              maxLength={64}
              required
            />
            <FinanceInput
              label="Icon or emoji (optional)"
              value={icon}
              onChangeText={setIcon}
              placeholder="e.g. Food"
              maxLength={32}
            />
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Create category'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
