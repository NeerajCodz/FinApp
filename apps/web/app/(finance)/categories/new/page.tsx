'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CategoryFormScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { SignInGate } from '../../_personal';

export default function NewCategoryPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState<string>();
  const [kind, setKind] = React.useState<'expense' | 'income'>('expense');
  const [color, setColor] = React.useState<string>();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    const trimmedName = name.trim();
    if (!userId || pending || !trimmedName) return;
    setPending(true);
    setError(null);
    try {
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: trimmedName,
        ...(icon ? { icon } : {}),
        kind,
        ...(color ? { color } : {}),
        isSystem: false,
        sortOrder: now,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'category', 'category.create', record, {
        name: trimmedName,
        ...(icon ? { icon } : {}),
        kind,
        ...(color ? { color } : {}),
      });
      router.replace(`/category/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this category.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="NEW CATEGORY" title="Give activity a home.">
        Sign in to add a category to your finance records.
      </SignInGate>
    );
  return (
    <div className="finance-page">
      <CategoryFormScreen
        mode="create"
        name={name}
        icon={icon}
        kind={kind}
        color={color}
        pending={pending}
        error={error}
        onNameChange={setName}
        onIconChange={setIcon}
        onKindChange={setKind}
        onColorChange={setColor}
        onSubmit={() => void create()}
        onBack={() => router.push('/categories')}
      />
    </div>
  );
}
