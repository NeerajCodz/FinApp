import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetProgress, CategoryIcon, Money, TransactionRow } from '@/components/finance';
import { parseMinor } from '@/lib/money';
import { CategoryEmojiPicker } from '@/components/finance/CategoryEmojiPicker';
import {
  Button,
  Empty,
  IconButton,
  Input,
  Label,
  Separator,
  Sheet,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const detail = useQuery(
    api.categories.queries.detail,
    id ? { categoryId: id as Id<'categories'> } : 'skip',
  );
  const profile = useQuery(api.users.queries.current);
  const setLimit = useMutation(api.categories.mutations.setLimit);
  const setIcon = useMutation(api.categories.mutations.setIcon);
  const setDefaultCategory = useMutation(api.users.mutations.setDefaultCategory);
  const renameCategory = useMutation(api.categories.mutations.rename);
  const archiveCategory = useMutation(api.categories.mutations.archive);
  const [limitInput, setLimitInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const category = detail?.category;
  const categoryId = category?._id;
  const currency = category?.limitCurrency ?? profile?.defaultCurrency ?? 'INR';
  async function saveIcon(icon?: string) {
    if (!categoryId) return;
    setPending(true);
    setError('');
    try {
      await setIcon({ categoryId, icon: icon ?? null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the category emoji.');
    } finally {
      setPending(false);
    }
  }

  async function saveLimit() {
    if (!categoryId) return;
    setError('');
    let amountMinor: bigint;
    try {
      amountMinor = parseMinor(limitInput, currency);
      if (amountMinor <= 0n) throw new Error('Enter a limit greater than zero.');
    } catch {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    setPending(true);
    try {
      await setLimit({ categoryId, amountMinor, currency });
      setLimitInput('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the limit.');
    } finally {
      setPending(false);
    }
  }

  async function clearLimit() {
    if (!categoryId) return;
    setPending(true);
    setError('');
    try {
      await setLimit({ categoryId, amountMinor: null });
      setLimitInput('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear the limit.');
    } finally {
      setPending(false);
    }
  }

  async function toggleDefault(transactionType: 'expense' | 'income') {
    if (!category) return;
    const isDefault =
      (transactionType === 'expense'
        ? profile?.defaultExpenseCategoryId
        : profile?.defaultIncomeCategoryId) === category._id;
    setPending(true);
    setError('');
    try {
      await setDefaultCategory({
        transactionType,
        categoryId: isDefault ? null : category._id,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the default category.');
    } finally {
      setPending(false);
    }
  }

  async function saveName() {
    if (!categoryId || !nameInput.trim()) return;
    setPending(true);
    setError('');
    try {
      await renameCategory({ categoryId, name: nameInput });
      setEditingName(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename category.');
    } finally {
      setPending(false);
    }
  }

  async function archive() {
    if (!categoryId) return;
    setPending(true);
    setError('');
    try {
      await archiveCategory({ categoryId });
      setConfirmingArchive(false);
      router.replace('/category' as never);
    } catch (cause) {
      setConfirmingArchive(false);
      setError(cause instanceof Error ? cause.message : 'Could not archive category.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          gap: 32,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          {category && <CategoryIcon label={category.name} icon={category.icon} />}
          {category && (
            <CategoryEmojiPicker
              compact
              value={category.icon}
              onChange={(icon) => void saveIcon(icon)}
            />
          )}
          <Typography variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {category?.name ?? 'Category'}
          </Typography>
          {category && !category.isSystem && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setNameInput(category.name);
                setEditingName(true);
              }}
            >
              Edit
            </Button>
          )}
        </View>

        {editingName && (
          <View style={{ gap: 10 }}>
            <Label>Category name</Label>
            <Input
              accessibilityLabel="Category name"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button size="sm" disabled={pending || !nameInput.trim()} onPress={saveName}>
                Save name
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setEditingName(false)}>
                Cancel
              </Button>
            </View>
          </View>
        )}
        {!id ? (
          <Empty title="Category unavailable." description="Open a category from your list." />
        ) : detail === undefined ? (
          <Typography variant="small">Loading category…</Typography>
        ) : detail === null ? (
          <Empty
            title="Category unavailable."
            description="This category could not be found or is no longer available."
          />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              <View style={{ gap: 8 }}>
                <Typography variant="label">Spent this month</Typography>
                <Money amountMinor={detail.monthSpentMinor} currency={currency} size="display" />
              </View>
              <View style={{ gap: 8 }}>
                <Typography variant="label">Received this month</Typography>
                <Money amountMinor={detail.monthReceivedMinor} currency={currency} size="display" />
              </View>
            </View>

            <View style={{ gap: 18 }}>
              <View style={{ gap: 8 }}>
                <Typography variant="heading">Monthly limit</Typography>
                {detail.category.monthlyLimitMinor !== undefined ? (
                  <BudgetProgress
                    spentMinor={detail.monthSpentMinor}
                    limitMinor={detail.category.monthlyLimitMinor}
                    currency={currency}
                    title="This month"
                  />
                ) : (
                  <Typography variant="small">No monthly limit set.</Typography>
                )}
              </View>
              <View>
                <Label>
                  {detail.category.monthlyLimitMinor === undefined
                    ? 'Set a monthly limit'
                    : 'Change monthly limit'}{' '}
                  · {currency}
                </Label>
                <Input
                  accessibilityLabel={`Monthly limit in ${currency}`}
                  keyboardType="decimal-pad"
                  value={limitInput}
                  onChangeText={setLimitInput}
                  placeholder="Amount"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button size="sm" disabled={pending || !limitInput.trim()} onPress={saveLimit}>
                  Save limit
                </Button>
                {detail.category.monthlyLimitMinor !== undefined && (
                  <Button size="sm" variant="outline" disabled={pending} onPress={clearLimit}>
                    Clear limit
                  </Button>
                )}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Separator />
              <Typography variant="heading">Default category</Typography>
              {profile === undefined ? (
                <Typography variant="small">Loading preferences…</Typography>
              ) : profile === null ? (
                <Typography variant="small">Sign in to change your default category.</Typography>
              ) : (
                <>
                  <Typography variant="small">
                    Choose separate defaults for expenses and income.
                  </Typography>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['expense', 'income'] as const).map((transactionType) => {
                      const isDefault =
                        (transactionType === 'expense'
                          ? profile.defaultExpenseCategoryId
                          : profile.defaultIncomeCategoryId) === detail.category._id;
                      return (
                        <Button
                          key={transactionType}
                          size="sm"
                          variant={isDefault ? 'outline' : 'primary'}
                          disabled={pending}
                          onPress={() => toggleDefault(transactionType)}
                          style={{ flex: 1 }}
                        >
                          {isDefault ? `Default ${transactionType}` : `Use for ${transactionType}`}
                        </Button>
                      );
                    })}
                  </View>
                </>
              )}
            </View>

            {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}

            <View style={{ gap: 12 }}>
              <Typography variant="heading">Transactions</Typography>
              {detail.transactions.length === 0 ? (
                <Empty
                  title="No transactions."
                  description="Posted transactions in this category will appear here."
                />
              ) : (
                <View>
                  {detail.transactions.map((transaction, index) => (
                    <React.Fragment key={transaction._id}>
                      <TransactionRow
                        title={transaction.title}
                        category={category?.name}
                        amountMinor={transaction.amountMinor}
                        currency={transaction.currency}
                        type={transaction.type}
                        date={new Date(transaction.occurredAt).toLocaleDateString()}
                        onPress={() => router.push(`/transaction/${transaction._id}` as never)}
                      />
                      {index < detail.transactions.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
            {!category?.isSystem && (
              <Button
                variant="destructive"
                onPress={() => setConfirmingArchive(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                Archive category
              </Button>
            )}
          </>
        )}
      </ScrollView>
      <Sheet
        visible={confirmingArchive}
        title="Archive category?"
        onClose={() => setConfirmingArchive(false)}
      >
        <Typography variant="small">
          Past transactions remain in your history. This category will no longer appear in new
          transactions.
        </Typography>
        <Button variant="destructive" disabled={pending} onPress={archive}>
          Archive {category?.name}
        </Button>
        <Button variant="outline" onPress={() => setConfirmingArchive(false)}>
          Cancel
        </Button>
      </Sheet>
    </>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        gap: 24,
      }}
    >
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Empty
        title="Could not load category."
        description={error.message}
        action={
          <Button size="sm" variant="outline" onPress={retry}>
            Try again
          </Button>
        }
      />
    </View>
  );
}
