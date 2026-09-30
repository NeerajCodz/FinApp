import React from 'react';
import { Image, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import {
  ArrowLeft,
  ChartLineUp,
  Gear,
  Plus,
  ReceiptText,
  UsersThree,
} from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityIcon, formatTransactionDate, Money, TransactionRow } from '@finapp/ui/finance';
import {
  Avatar,
  Button,
  Empty,
  IconButton,
  SectionHeader,
  Separator,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { recordId, recordIds } from '@/lib/ledger';
import { useLocalRecords } from '@/hooks/useLocalRecords';

export default function GroupHomeScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const { isConnected } = useLocalSync();
  const insets = useSafeAreaInsets();
  const { group, members, ledger, error, loading, retry, userId } = useGroupLedger(id);
  const localSettlements = useLocalRecords(userId, 'settlement');
  const chatTimelineRef = React.useRef<ScrollView>(null);
  const groupMembers =
    members?.filter(
      (record) =>
        typeof record.groupId === 'string' && recordIds(group ?? {}).includes(record.groupId),
    ) ?? [];
  const recent = [...(ledger?.expenses ?? [])]
    .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt))
    .slice(0, 5);
  const balance = userId ? (ledger?.balances[userId] ?? 0n) : 0n;
  const groupIdentity = String(
    (group as { cloudId?: string; _id?: string } | undefined)?.cloudId ??
      (group as { _id?: string } | undefined)?._id ??
      '',
  );
  const cloudGroupId = groupIdentity.startsWith('local-') ? '' : groupIdentity;
  const canUseGroupChat = isConnected && Boolean(cloudGroupId);
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const chatMessages = useQuery(
    api.groups.queries.chatMessages,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [chatDraft, setChatDraft] = React.useState('');
  const [chatPending, setChatPending] = React.useState(false);
  const [chatError, setChatError] = React.useState('');
  React.useEffect(() => {
    if (canUseGroupChat && chatMessages?.length)
      chatTimelineRef.current?.scrollToEnd({ animated: true });
  }, [canUseGroupChat, chatMessages?.length]);

  async function submitChatMessage() {
    if (!canUseGroupChat || !chatDraft.trim() || chatPending) return;
    setChatPending(true);
    setChatError('');
    try {
      await sendChatText({
        groupId: cloudGroupId as Id<'groups'>,
        text: chatDraft.trim(),
      });
      setChatDraft('');
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setChatPending(false);
    }
  }

  async function pickBillImage() {
    if (!canUseGroupChat || chatPending) return;
    setChatError('');
    let selection: ImagePicker.ImagePickerResult;
    try {
      selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not open the image picker.');
      return;
    }
    if (selection.canceled) return;
    const asset = selection.assets[0];
    const mimeType = asset?.mimeType?.toLowerCase();
    if (
      !asset ||
      !mimeType ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
      (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024)
    ) {
      setChatError('Choose a JPEG, PNG, or WebP bill image up to 5 MB.');
      return;
    }
    setChatPending(true);
    try {
      const uploadUrl = await createChatUploadUrl({ groupId: cloudGroupId as Id<'groups'> });
      const image = await (await fetch(asset.uri)).blob();
      if (!image.size || image.size > 5 * 1024 * 1024) throw new Error('INVALID_BILL_IMAGE');
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: image,
      });
      if (!response.ok) throw new Error('BILL_UPLOAD_FAILED');
      const result = (await response.json()) as { storageId?: string };
      if (!result.storageId) throw new Error('BILL_UPLOAD_FAILED');
      const messageId = await sendBillAttachment({
        groupId: cloudGroupId as Id<'groups'>,
        storageId: result.storageId as Id<'_storage'>,
      });
      if (!messageId) throw new Error('INVALID_BILL_IMAGE');
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not upload this bill image.');
    } finally {
      setChatPending(false);
    }
  }
  const groupSettlementIds = recordIds(group ?? {});
  const recentSettlements = (localSettlements.data ?? [])
    .filter(
      (record) =>
        typeof record.groupId === 'string' &&
        groupSettlementIds.includes(record.groupId) &&
        typeof record.currency === 'string' &&
        record.currency === ledger?.currency &&
        record.deletedAt === undefined &&
        typeof record.fromUserId === 'string' &&
        typeof record.toUserId === 'string' &&
        typeof record.amountMinor === 'bigint',
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const settlementMemberName = (memberId: string) => {
    if (memberId === userId) return 'You';
    const member = groupMembers.find((record) => (record.userId ?? record.memberId) === memberId);
    return String(
      member?.displayName ?? member?.name ?? member?.username ?? `Member ${memberId.slice(-6)}`,
    );
  };
  const chatTimelineItems = [
    ...recent.map((expense) => ({
      id: `expense:${recordId(expense)}`,
      kind: 'expense' as const,
      createdAt: Number(expense.occurredAt ?? 0),
      expense,
    })),
    ...recentSettlements.map((settlement) => ({
      id: `settlement:${recordId(settlement)}`,
      kind: 'settlement' as const,
      createdAt: Number(settlement.occurredAt ?? 0),
      settlement,
    })),
    ...(chatMessages ?? []).map((message) => ({
      id: `message:${message.id}`,
      kind: 'message' as const,
      createdAt: message.createdAt,
      message,
    })),
  ].sort((left, right) => left.createdAt - right.createdAt);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <EntityIcon
          value={
            remoteGroup
              ? (remoteGroup.icon ?? 'lucide:UsersRound')
              : typeof group?.icon === 'string'
                ? group.icon
                : 'lucide:UsersRound'
          }
          size={23}
          color={tokens.primary}
        />
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {String(group?.name ?? 'Group')}
        </Typography>
        {!!id && (
          <IconButton
            label="Group analytics"
            variant="ghost"
            onPress={() => router.push({ pathname: '/group/[id]/analytics', params: { id } })}
          >
            <ChartLineUp size={20} color={tokens.foreground} />
          </IconButton>
        )}
        {!!id && (
          <IconButton
            label="Group settings"
            variant="ghost"
            onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id } })}
          >
            <Gear size={20} color={tokens.foreground} />
          </IconButton>
        )}
      </View>
      {!id ? (
        <Empty title="Missing group ID" description="Open a group from your groups list." />
      ) : !group && error ? (
        <Empty
          title="Group unavailable"
          description="Saved group data could not be loaded on this device."
          action={
            <Button variant="outline" onPress={retry}>
              Retry
            </Button>
          }
        />
      ) : !group && !loading ? (
        <Empty title="Group unavailable" description="This group is not saved on this device." />
      ) : (
        <>
          <View
            style={{
              padding: 20,
              gap: 9,
              borderRadius: 22,
              backgroundColor: tokens.surfaceSubtle,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <Typography variant="label">Your balance</Typography>
            {error ? (
              <View style={{ gap: 10 }} accessibilityRole="alert">
                <Typography variant="small">
                  Complete group balances are unavailable. No partial value is shown.
                </Typography>
                <Button onPress={retry}>Retry</Button>
              </View>
            ) : loading || !ledger ? (
              <Typography variant="small">Loading all-time balance…</Typography>
            ) : (
              <>
                <Money amountMinor={balance} currency={ledger.currency} size="display" />
                <Typography variant="caption">
                  {balance > 0n ? 'Owed to you' : balance < 0n ? 'You owe' : 'You are settled'}
                </Typography>
                <Button
                  variant="outline"
                  onPress={() =>
                    router.push({ pathname: '/group/[id]/balances', params: { id: id! } })
                  }
                >
                  View member balances
                </Button>
                {balance !== 0n && (
                  <Button
                    variant="outline"
                    onPress={() =>
                      router.push({ pathname: '/settle/new', params: { groupId: id! } })
                    }
                  >
                    Record a settlement
                  </Button>
                )}
              </>
            )}
          </View>
          <Button
            size="lg"
            onPress={() =>
              router.push({ pathname: '/group/[id]/expenses/new', params: { id: id! } })
            }
          >
            <Plus size={18} color={tokens.primaryForeground} />
            <Text
              style={{
                marginLeft: 8,
                color: tokens.primaryForeground,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontSize: 15,
              }}
            >
              Add expense
            </Text>
          </Button>
          <View style={{ gap: 12 }}>
            <SectionHeader title="Group chat" />
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              Messages and bill images are saved to this group when online. They are not queued for
              offline sending.
            </Typography>
            {canUseGroupChat ? (
              <>
                <ScrollView
                  ref={chatTimelineRef}
                  accessibilityRole="list"
                  accessibilityLabel="Group messages"
                  accessibilityLiveRegion="polite"
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  style={{
                    maxHeight: 440,
                    minHeight: 180,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                  contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1 }}
                >
                  {chatMessages === undefined && (
                    <Typography variant="small" accessibilityLiveRegion="polite">
                      Loading saved messages…
                    </Typography>
                  )}
                  {chatTimelineItems.length ? (
                    chatTimelineItems.map((item) => {
                      const createdAt = new Date(item.createdAt);
                      if (item.kind === 'message') {
                        const { message } = item;
                        const ownMessage = message.senderId === userId;
                        return (
                          <View
                            key={item.id}
                            accessibilityRole="text"
                            accessibilityLabel={`${ownMessage ? 'You' : message.senderName}, ${createdAt.toLocaleString()}`}
                            style={{
                              alignSelf: ownMessage ? 'flex-end' : 'flex-start',
                              maxWidth: '90%',
                              gap: 6,
                              paddingVertical: 10,
                              paddingHorizontal: 13,
                              borderWidth: 1,
                              borderColor: tokens.borderSubtle,
                              borderTopLeftRadius: 16,
                              borderTopRightRadius: 16,
                              borderBottomLeftRadius: ownMessage ? 16 : 5,
                              borderBottomRightRadius: ownMessage ? 5 : 16,
                              backgroundColor: ownMessage ? tokens.secondary : tokens.background,
                            }}
                          >
                            <Typography variant="caption">
                              {ownMessage ? 'You' : message.senderName}
                            </Typography>
                            {message.kind === 'bill' ? (
                              message.attachmentUrl ? (
                                <Image
                                  source={{ uri: message.attachmentUrl }}
                                  accessibilityLabel={`Bill image shared by ${ownMessage ? 'you' : message.senderName}`}
                                  resizeMode="contain"
                                  style={{ width: 260, height: 210, borderRadius: 10 }}
                                />
                              ) : (
                                <Typography variant="small">
                                  Bill image is no longer available.
                                </Typography>
                              )
                            ) : (
                              <Text
                                style={{
                                  color: tokens.foreground,
                                  flexShrink: 1,
                                  lineHeight: 22,
                                }}
                              >
                                {message.text}
                              </Text>
                            )}
                            <Typography variant="caption">{createdAt.toLocaleString()}</Typography>
                          </View>
                        );
                      }
                      if (item.kind === 'expense') {
                        const { expense } = item;
                        return (
                          <View
                            key={item.id}
                            accessibilityRole="text"
                            accessibilityLabel={`Shared expense: ${String(expense.title ?? 'Group expense')}, ${String(group?.currency ?? 'INR')}`}
                            style={{
                              alignSelf: 'center',
                              width: '100%',
                              gap: 5,
                              padding: 12,
                              borderWidth: 1,
                              borderLeftWidth: 3,
                              borderColor: tokens.borderSubtle,
                              borderLeftColor: tokens.split,
                              borderRadius: 12,
                              backgroundColor: tokens.surfaceRaised,
                            }}
                          >
                            <Typography variant="caption">Shared expense · Split</Typography>
                            <Typography variant="bodyLarge">
                              {String(expense.title ?? 'Group expense')}
                            </Typography>
                            <Money
                              amountMinor={expense.amountMinor as bigint}
                              currency={String(group?.currency ?? ledger?.currency ?? 'INR')}
                              size="body"
                            />
                            <Typography variant="caption">
                              {formatTransactionDate(
                                Number(expense.occurredAt ?? 0),
                                Boolean(expense.hasTime),
                              )}
                            </Typography>
                          </View>
                        );
                      }
                      const { settlement } = item;
                      return (
                        <View
                          key={item.id}
                          accessibilityRole="text"
                          accessibilityLabel={`Settlement: ${settlementMemberName(String(settlement.fromUserId))} paid ${settlementMemberName(String(settlement.toUserId))}`}
                          style={{
                            alignSelf: 'center',
                            width: '100%',
                            gap: 5,
                            padding: 12,
                            borderWidth: 1,
                            borderLeftWidth: 3,
                            borderColor: tokens.borderSubtle,
                            borderLeftColor: tokens.settlement,
                            borderRadius: 12,
                            backgroundColor: tokens.surfaceRaised,
                          }}
                        >
                          <Typography variant="caption">Settlement</Typography>
                          <Typography variant="bodyLarge">
                            {settlementMemberName(String(settlement.fromUserId))} paid{' '}
                            {settlementMemberName(String(settlement.toUserId))}
                          </Typography>
                          <Money
                            amountMinor={settlement.amountMinor as bigint}
                            currency={String(group?.currency ?? ledger?.currency ?? 'INR')}
                            size="body"
                          />
                          {typeof settlement.occurredAt === 'number' && (
                            <Typography variant="caption">
                              {formatTransactionDate(settlement.occurredAt, true)}
                            </Typography>
                          )}
                        </View>
                      );
                    })
                  ) : chatMessages !== undefined ? (
                    <View
                      style={{
                        flex: 1,
                        minHeight: 150,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: 12,
                      }}
                    >
                      <Typography variant="bodyLarge">Start the conversation</Typography>
                      <Typography variant="small" style={{ textAlign: 'center' }}>
                        Share a note or attach a bill for the group.
                      </Typography>
                    </View>
                  ) : null}
                </ScrollView>
                <TextInput
                  accessibilityLabel="Group message"
                  accessibilityHint="Messages are sent to the group when you are online."
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  editable={!chatPending}
                  maxLength={4_000}
                  multiline
                  placeholder="Write a message…"
                  placeholderTextColor={tokens.foregroundSubtle}
                  style={{
                    minHeight: 84,
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                    color: tokens.foreground,
                    textAlignVertical: 'top',
                  }}
                />
                <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                  {chatPending ? 'Sending to the group…' : `${chatDraft.length}/4,000 characters`}
                </Typography>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button
                    style={{ flex: 1 }}
                    variant="outline"
                    disabled={chatPending}
                    accessibilityLabel="Attach bill image"
                    onPress={() => void pickBillImage()}
                  >
                    Attach bill image
                  </Button>
                  <Button
                    style={{ flex: 1 }}
                    disabled={chatPending || !chatDraft.trim()}
                    onPress={() => void submitChatMessage()}
                  >
                    {chatPending ? 'Sending…' : 'Send message'}
                  </Button>
                </View>
              </>
            ) : (
              <View
                style={{
                  padding: 16,
                  gap: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.borderSubtle,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Typography variant="label">
                  {isConnected ? 'Chat is not synced yet' : 'Group chat is offline'}
                </Typography>
                <Typography variant="small">
                  {isConnected
                    ? 'This saved group has no connected cloud ID. Sync the group before using server chat or sharing bill images.'
                    : 'Connect to the internet to load saved messages or send a message and bill image. Group ledger data remains available offline.'}
                </Typography>
              </View>
            )}
            {!!chatError && (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                {chatError}
              </Typography>
            )}
          </View>
          <View style={{ gap: 12 }}>
            <SectionHeader title="People" />
            {groupMembers.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 16 }}
              >
                {groupMembers.map((member) => {
                  const displayName = String(
                    member.displayName ?? member.name ?? member.username ?? 'Member',
                  );
                  const username =
                    typeof member.username === 'string' ? member.username : undefined;
                  const memberId = String(member.id ?? member.userId ?? member._id ?? displayName);
                  return (
                    <TouchableOpacity
                      key={memberId}
                      accessibilityRole={username ? 'button' : undefined}
                      accessibilityLabel={username ? `Open @${username}` : displayName}
                      activeOpacity={username ? 0.72 : 1}
                      disabled={!username}
                      onPress={() => username && router.push(`/person/${username}` as never)}
                      style={{ alignItems: 'center', gap: 7, width: 96 }}
                    >
                      <Avatar
                        initials={displayName.slice(0, 2)}
                        label={displayName}
                        size={48}
                        imageUrl={typeof member.avatarUrl === 'string' ? member.avatarUrl : null}
                      />
                      <Typography
                        variant="caption"
                        numberOfLines={1}
                        style={{
                          maxWidth: 96,
                          textAlign: 'center',
                          color: username ? tokens.foregroundMuted : tokens.foregroundSubtle,
                        }}
                      >
                        {username ? `@${username}` : displayName}
                      </Typography>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                <UsersThree size={26} color={tokens.foregroundMuted} />
                <Typography variant="bodyLarge">No members saved</Typography>
                <Typography variant="small" style={{ textAlign: 'center' }}>
                  Members invited to this group will appear here.
                </Typography>
              </View>
            )}
          </View>
          <Separator />
          <View style={{ gap: 12 }}>
            <SectionHeader title="Recent" />
            {recent.length > 0 ? (
              recent.map((expense) => {
                const transactionId = recordId(expense);
                return (
                  <TransactionRow
                    key={transactionId}
                    title={String(expense.title ?? 'Group expense')}
                    category="Group expense"
                    account={String(group?.name ?? 'Group')}
                    amountMinor={expense.amountMinor as bigint}
                    currency={ledger!.currency}
                    type="expense"
                    semanticType="split"
                    date={formatTransactionDate(
                      Number(expense.occurredAt),
                      Boolean(expense.hasTime),
                    )}
                    onPress={
                      transactionId
                        ? () =>
                            router.push({
                              pathname: '/transaction/[id]',
                              params: { id: transactionId },
                            })
                        : undefined
                    }
                  />
                );
              })
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
                <ReceiptText size={28} color={tokens.foregroundMuted} />
                <Typography variant="bodyLarge">No shared expenses</Typography>
                <Typography variant="small" style={{ textAlign: 'center' }}>
                  Add an expense to start your group history.
                </Typography>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() =>
                    router.push({ pathname: '/group/[id]/expenses/new', params: { id: id! } })
                  }
                >
                  Add expense
                </Button>
              </View>
            )}
          </View>
          <View style={{ gap: 12 }}>
            <SectionHeader title="Recent settlements" />
            {localSettlements.loading ? (
              <Typography variant="small">Loading saved settlements…</Typography>
            ) : localSettlements.error ? (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                Saved settlements could not be loaded.
              </Typography>
            ) : recentSettlements.length ? (
              recentSettlements.map((settlement) => (
                <View
                  key={recordId(settlement)}
                  style={{
                    padding: 16,
                    gap: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <Typography variant="label">
                    {settlementMemberName(String(settlement.fromUserId))} paid{' '}
                    {settlementMemberName(String(settlement.toUserId))}
                  </Typography>
                  <Money
                    amountMinor={settlement.amountMinor as bigint}
                    currency={ledger!.currency}
                    size="body"
                  />
                  {typeof settlement.occurredAt === 'number' &&
                    Number.isFinite(settlement.occurredAt) && (
                      <Typography variant="caption">
                        {formatTransactionDate(settlement.occurredAt, true)}
                      </Typography>
                    )}
                </View>
              ))
            ) : (
              <Typography variant="small">No settlements recorded for this group yet.</Typography>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
