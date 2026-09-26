'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Tags } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, idOf, PageHeading, SignInGate } from '../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  sortOrder?: number;
  archivedAt?: number;
  isSystem?: boolean;
};

export default function PersonalCategoriesPage() {
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Category>('category');
  const [showArchived, setShowArchived] = React.useState(false);
  const categories = records
    .filter((record) => userId && belongsToUser(record, userId))
    .sort(
      (left, right) =>
        Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) ||
        (left.name ?? '').localeCompare(right.name ?? ''),
    );
  const shown = categories.filter((record) => showArchived === (record.archivedAt !== undefined));
  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORIES" title="Make every expense clearer.">
        Sign in to view and manage your private category list.
      </SignInGate>
    );
  return (
    <div className="finance-page">
      <PageHeading
        eyebrow="ORGANIZE YOUR ACTIVITY"
        title="Categories"
        description="Keep category names and icons consistent across your local and synced transaction history."
      />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge variant="neutral">
          {categories.filter((item) => item.archivedAt === undefined).length} active
        </Badge>
        <Button
          type="button"
          variant={showArchived ? 'secondary' : 'outline'}
          onPress={() => setShowArchived((value) => !value)}
        >
          {showArchived ? 'Show active' : 'Show archived'}
        </Button>
        <Link className="finance-primary-link" href="/category/new">
          New category <Plus size={16} />
        </Link>
      </div>
      <Card className="finance-record-panel">
        <SectionHeader
          title={showArchived ? 'Archived categories' : 'Your categories'}
          action={
            <Link href="/category/new" aria-label="Add category">
              <Plus size={17} />
            </Link>
          }
        />
        {loading ? (
          <p className="finance-muted" role="status">
            Opening your local categories…
          </p>
        ) : error ? (
          <p className="finance-form-error" role="alert">
            Category data could not be opened: {error}
          </p>
        ) : shown.length === 0 ? (
          <Empty
            title={showArchived ? 'No archived categories' : 'No categories yet'}
            description={
              showArchived
                ? 'Archived categories stay available for old records.'
                : 'Add a category to organize transactions and set an optional monthly limit.'
            }
            icon={<Tags size={20} />}
            action={
              !showArchived ? (
                <Link className="finance-inline-link" href="/category/new">
                  Create a category
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="finance-record-list">
            {shown.map((category) => (
              <li key={idOf(category)}>
                <span className="finance-record-symbol" aria-hidden="true">
                  {category.icon ?? <Tags size={17} />}
                </span>
                <span className="finance-record-copy">
                  <strong>
                    <Link href={`/category/${encodeURIComponent(idOf(category))}`}>
                      {category.name ?? 'Category'}
                    </Link>
                  </strong>
                  <small>
                    {category.isSystem ? 'System category' : 'Personal category'}
                    {category.archivedAt !== undefined ? ' · archived' : ''}
                  </small>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Link className="finance-secondary-action" href="/categories">
        Open categories overview <ArrowRight size={15} />
      </Link>
    </div>
  );
}
