'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CategoryFormScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, idOf, localDependency, matchesId, SignInGate } from '../../../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  kind?: 'expense' | 'income';
  color?: string;
  isSystem?: boolean;
  archivedAt?: number;
  updatedAt?: number;
};

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Category>('category');
  const category = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState<string>();
  const [kind, setKind] = React.useState<'expense' | 'income'>('expense');
  const [color, setColor] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setName(category?.name ?? '');
    setIcon(category?.icon);
    setKind(category?.kind === 'income' ? 'income' : 'expense');
    setColor(category?.color);
  }, [
    category?.id,
    category?._id,
    category?.name,
    category?.icon,
    category?.kind,
    category?.color,
  ]);

  async function save() {
    const trimmedName = name.trim();
    if (!userId || !category || pending || !trimmedName) return;
    const categoryId = String(category._id ?? category.cloudId ?? category.id ?? '');
    if (!categoryId) {
      setFormError('This category cannot be updated until it has synchronized.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const dependency = localDependency('category', category);
      const options = {
        recordId: idOf(category),
        dependencies: dependency ? [dependency] : [],
        baseUpdatedAt: typeof category.updatedAt === 'number' ? category.updatedAt : undefined,
      };
      if (trimmedName !== (category.name ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.rename',
          { ...category, name: trimmedName },
          { categoryId, name: trimmedName },
          options,
        );
      }
      if ((icon ?? '') !== (category.icon ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.setIcon',
          { ...category, icon },
          { categoryId, icon: icon ?? null },
          options,
        );
      }
      if (kind !== (category.kind ?? 'expense') || (color ?? '') !== (category.color ?? '')) {
        await commitLocalWrite(
          userId,
          'category',
          'category.setPreferences',
          { ...category, kind, color },
          { categoryId, kind, color: color ?? null },
          options,
        );
      }
      router.replace(`/category/${encodeURIComponent(routeId)}`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this category.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="EDIT CATEGORY" title="Update your category.">
        Sign in to edit a private category.
      </SignInGate>
    );
  if (loading)
    return (
      <div className="finance-page" role="status">
        Loading category…
      </div>
    );
  if (error)
    return (
      <div className="finance-page" role="alert">
        Category could not be opened: {error}
      </div>
    );
  if (!category || category.archivedAt !== undefined)
    return (
      <div className="finance-page" style={{ gap: 16 }}>
        <h1>Category unavailable</h1>
        <p>This category could not be found or is archived.</p>
        <button type="button" onClick={() => router.push('/categories')}>
          Back to categories
        </button>
      </div>
    );
  if (category.isSystem)
    return (
      <div className="finance-page" style={{ gap: 16 }}>
        <h1>Category cannot be edited</h1>
        <p>System categories are read-only.</p>
        <button
          type="button"
          onClick={() => router.push(`/category/${encodeURIComponent(routeId)}`)}
        >
          Back to category
        </button>
      </div>
    );
  return (
    <div className="finance-page">
      <CategoryFormScreen
        mode="edit"
        name={name}
        icon={icon}
        kind={kind}
        color={color}
        pending={pending}
        error={formError}
        onNameChange={setName}
        onIconChange={setIcon}
        onKindChange={setKind}
        onColorChange={setColor}
        onSubmit={() => void save()}
        onBack={() => router.push(`/category/${encodeURIComponent(routeId)}`)}
      />
    </div>
  );
}
