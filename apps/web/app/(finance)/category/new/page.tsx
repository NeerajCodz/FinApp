'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { PageHeading, SignInGate } from '../../_personal';

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
    if (!trimmedName) { setError('Enter a category name.'); return; }
    if (trimmedIcon.length > 32) { setError('Choose an icon no longer than 32 characters.'); return; }
    setSaving(true); setError(null);
    try {
      const now = Date.now();
      const record: LocalRecord = { ownerId: userId, name: trimmedName, ...(trimmedIcon ? { icon: trimmedIcon } : {}), isSystem: false, sortOrder: now, createdAt: now, updatedAt: now };
      const id = await commitLocalWrite(userId, 'category', 'category.create', record, { name: trimmedName, ...(trimmedIcon ? { icon: trimmedIcon } : {}) });
      router.push(`/category/${encodeURIComponent(id)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this category.'); }
    finally { setSaving(false); }
  }
  if (!userId) return <SignInGate eyebrow="NEW CATEGORY" title="Give activity a home.">Sign in to add a category to your local-first finance records.</SignInGate>;
  return <div className="finance-page"><Link className="finance-secondary-action" href="/category"><ArrowLeft size={15} /> Back to categories</Link><PageHeading eyebrow="NEW CATEGORY" title="Create a category" description="Choose a concise name and optional text or emoji icon. Categories are archived, not deleted." /><Card className="finance-form-panel"><form className="finance-form" onSubmit={create}><FinanceInput label="Category name" value={name} onChangeText={setName} placeholder="Home, travel, groceries…" maxLength={80} required /><FinanceInput label="Icon (optional)" value={icon} onChangeText={setIcon} placeholder="For example, 🏠" maxLength={32} /><p className="finance-form-note">Icons are stored as category metadata; no image upload is used.</p>{error && <p className="finance-form-error" role="alert">{error}</p>}<Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving locally…' : 'Create category'} <ArrowRight size={15} /></Button></form></Card></div>;
}
