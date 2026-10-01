'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CategoryFormScreen, deriveFormActivity } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { belongsToUser, idOf, localDependency, matchesId, SignInGate } from '../../../_personal';
type Category = LocalRecord & { name?: string; icon?: string; kind?: 'expense' | 'income'; color?: string; notes?: string; includeInBudgets?: boolean; monthlyLimitMinor?: bigint; limitCurrency?: string; isSystem?: boolean; archivedAt?: number; updatedAt?: number };
export default function EditCategoryPage() {
  const router = useRouter(); const params = useParams<{ id: string }>(); const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useBrowserSync(); const { records, loading, error } = useLocalRecords<Category>('category');
  const { records: profiles } = useLocalRecords<LocalRecord>('profile'); const { records: transactions } = useLocalRecords<LocalRecord>('transaction'); const { records: accounts } = useLocalRecords<LocalRecord>('account');
  const category = records.find(record => userId && belongsToUser(record, userId) && matchesId(record, routeId));
  const profile = profiles.find(record => userId && belongsToUser(record, userId));
  const currency = category?.limitCurrency ?? String(profile?.defaultCurrency ?? 'INR');
  const [name, setName] = React.useState(''); const [icon, setIcon] = React.useState<string>(); const [kind, setKind] = React.useState<'expense' | 'income'>('expense'); const [color, setColor] = React.useState<string>();
  const [notes, setNotes] = React.useState(''); const [includeInBudgets, setIncludeInBudgets] = React.useState(true); const [limitValue, setLimitValue] = React.useState(''); const [defaultDraft, setDefaultDraft] = React.useState<boolean>();
  const [pending, setPending] = React.useState(false); const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => { setName(category?.name ?? ''); setIcon(category?.icon); setKind(category?.kind === 'income' ? 'income' : 'expense'); setColor(category?.color); setNotes(category?.notes ?? ''); setIncludeInBudgets(category?.includeInBudgets !== false); const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; const scale = 10n ** BigInt(digits); const minor = category?.monthlyLimitMinor === undefined ? undefined : BigInt(category.monthlyLimitMinor); setLimitValue(minor === undefined ? '' : `${minor / scale}${digits ? '.' + (minor % scale).toString().padStart(digits, '0') : ''}`); }, [category?.id, category?._id]);
  const activity = deriveFormActivity(transactions, records, accounts, category, 'categoryId', userId);
  const monthStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
  const monthEnd = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1);
  const aliases = [category?.id, category?._id, category?.cloudId];
  const spentMinor = transactions.filter(row => (row.ownerId === undefined || row.ownerId === userId) && aliases.includes(row.categoryId as string) && row.status === 'posted' && row.deletedAt === undefined && row.type === 'expense' && row.currency === currency && Number(row.occurredAt) >= monthStart && Number(row.occurredAt) < monthEnd).reduce((sum, row) => sum + BigInt(String(row.amountMinor ?? 0)), 0n);
  const defaultField = kind === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
  async function save() {
    if (!userId || !category || pending || !name.trim()) return;
    setPending(true); setFormError(null);
    try {
      const amountMinor = limitValue.trim() ? parseMinor(limitValue, currency) : null;
      if (amountMinor !== null && amountMinor <= 0n) throw new Error('Enter a positive monthly limit.');
      const categoryId = String(category._id ?? category.cloudId ?? category.id ?? ''); const dependency = localDependency('category', category);
      const options = { recordId: idOf(category), dependencies: dependency ? [dependency] : [], baseUpdatedAt: category.updatedAt };
      let updated: LocalRecord = { ...category };
      if (name.trim() !== category.name) { updated = { ...updated, name: name.trim() }; await commitLocalWrite(userId, 'category', 'category.rename', updated, { categoryId, name: name.trim() }, options); }
      if ((icon ?? '') !== (category.icon ?? '')) { updated = { ...updated, icon }; await commitLocalWrite(userId, 'category', 'category.setIcon', updated, { categoryId, icon: icon ?? null }, options); }
      updated = { ...updated, kind, color, notes: notes.trim() || undefined, includeInBudgets };
      await commitLocalWrite(userId, 'category', 'category.setPreferences', updated, { categoryId, kind, color: color ?? null, notes: notes.trim() || null, includeInBudgets }, options);
      if (amountMinor !== (category.monthlyLimitMinor === undefined ? null : BigInt(category.monthlyLimitMinor))) { updated = { ...updated, monthlyLimitMinor: amountMinor ?? undefined, limitCurrency: amountMinor === null ? undefined : currency }; await commitLocalWrite(userId, 'category', 'category.setLimit', updated, { categoryId, amountMinor, ...(amountMinor === null ? {} : { currency }) }, options); }
      if (profile && defaultDraft !== undefined) { const nextId = defaultDraft ? categoryId : null; await commitLocalWrite(userId, 'profile', 'user.defaultCategory', { ...profile, [defaultField]: nextId ?? undefined }, { transactionType: kind, categoryId: nextId }, { recordId: idOf(profile), dependencies: nextId && dependency ? [dependency] : [] }); }
      router.replace(`/category/${encodeURIComponent(routeId)}`);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not update this category.'); } finally { setPending(false); }
  }
  if (!userId) return <SignInGate eyebrow="EDIT CATEGORY" title="Update your category.">Sign in to edit a private category.</SignInGate>;
  if (loading) return <div className="finance-page" role="status">Loading category…</div>;
  if (error) return <div className="finance-page" role="alert">Category could not be opened: {error}</div>;
  if (!category || category.archivedAt !== undefined || category.isSystem) return <div className="finance-page"><h1>Category unavailable</h1><p>This category could not be found or cannot be edited.</p><button onClick={() => router.push('/categories')}>Back to categories</button></div>;
  return <CategoryFormScreen mode="edit" name={name} icon={icon} kind={kind} color={color} currency={currency} notes={notes} onNotesChange={setNotes} limitValue={limitValue} onLimitChange={setLimitValue} includeInBudgets={includeInBudgets} onIncludeInBudgetsChange={setIncludeInBudgets} isDefault={defaultDraft ?? aliases.includes(profile?.[defaultField] as string)} onDefaultChange={profile ? setDefaultDraft : undefined} spentMinor={spentMinor} monthlyLimitMinor={category.monthlyLimitMinor === undefined ? undefined : BigInt(category.monthlyLimitMinor)} activity={activity} onOpenTransaction={id => router.push(`/transaction/${encodeURIComponent(id)}`)} onViewTransactions={() => router.push(`/category/${encodeURIComponent(routeId)}`)} onOpenAnalytics={() => router.push('/categories/analytics')} pending={pending} error={formError} onNameChange={setName} onIconChange={setIcon} onKindChange={setKind} onColorChange={setColor} onSubmit={() => void save()} onBack={() => router.push('/categories')} />;
}
