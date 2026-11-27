import React, { useEffect, useRef } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, ThinkingOrb, Typography, useTheme } from '@finapp/ui/native';
import { ArrowLeft, ImageSquare, PaperPlaneTilt, Plus } from 'phosphor-react-native';
import { Money } from './Money';
import {
  GroupAvatar,
  GroupMetadataSummary,
  GroupPanel,
  GroupTile,
  type GroupMetadata,
} from './GroupPrimitives';
import { FinanceEmptyState } from './FinanceEmptyState';
import { ChatThread } from '../../chat/native/ChatThread';
import { FinaiSurface } from '../../ai/native/FinaiSurface';
import {
  FINAI_MENTION,
  finaiErrorMessage,
  orbStateFor,
  finaiChatOverrides,
  finaiTypingNames,
  type ServerFinaiChatFields,
} from '../../ai/finai';
import {
  chatHeaderSubtitle,
  type ChatMessage,
  type ChatPerson,
  type ChatPin,
  type ChatReactionEmoji,
} from '../../chat/model';
import type { NativeVoiceClip } from '../../chat/native/voice';
import { VoiceBubble } from '../../chat/native/voice';

export type GroupChatItem = {
  id: string;
  kind: 'message' | 'expense' | 'settlement';
  date: string;
  accessibleLabel: string;
  sender?: string;
  senderAvatarId?: string;
  senderAvatarUrl?: string | null;
  ownMessage?: boolean;
  text?: string;
  attachmentUrl?: string | null;
  title?: string;
  amount?: string;
  amountMinor?: bigint;
  currency?: string;
  icon?: string;
  color?: string;
  readBy?: readonly string[];
  onPress?: () => void;
  /** Thread fields (full chat screen). */
  createdAt?: number;
  senderId?: string;
  status?: 'sent' | 'pending' | 'failed';
  reactions?: readonly { emoji: string; count: number }[];
  myReaction?: string | null;
  pinned?: boolean;
  canPin?: boolean;
  seenByPeople?: readonly ChatPerson[];
  /** FinAI reply state when this message is an @finai answer. */
  ai?: ServerFinaiChatFields;
  /** Voice message: clip URL and length. */
  audioUrl?: string | null;
  durationMs?: number;
};
export type GroupChatScreenProps = {
  items: readonly GroupChatItem[];
  loading: boolean;
  canSend: boolean;
  connected: boolean;
  draft: string;
  pending: boolean;
  error?: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onChooseBillImage: () => void;
  /** Sends a recorded voice clip (an empty composer shows a mic). */
  onSendVoice?: (clip: NativeVoiceClip) => void;
  /** Members currently online (presence), for the header line. */
  onlineCount?: number;
  onBack?: () => void;
  group?: GroupMetadata & { name: string; currency: string; icon?: string; color?: string };
  members?: readonly {
    id: string;
    name: string;
    username?: string;
    avatarId?: string;
    avatarUrl?: string;
  }[];
  typingNames?: readonly string[];
  onTypingChange?: (typing: boolean) => void;
  onOpenGroup?: () => void;
  onAddExpense?: () => void;
  onOpenSettings?: () => void;
  embedded?: boolean;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string;
  pinned?: readonly (ChatPin & { canUnpin?: boolean })[];
  onTogglePin?: (id: string, pinned: boolean) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onSeenLatest?: (createdAt: number) => void;
  /** Confirms or cancels a FinAI card. */
  onFinaiDecide?: (actionId: string, decision: 'confirm' | 'cancel') => Promise<unknown>;
};

/** Maps timeline items onto the shared chat thread model; ledger items become event cards. */
export function groupChatMessages(items: readonly GroupChatItem[]): ChatMessage[] {
  return items.map((item) => {
    const base = {
      id: item.id,
      createdAt: item.createdAt ?? 0,
      mine: !!item.ownMessage,
      senderId: item.senderId,
      senderName: item.ownMessage ? 'You' : item.sender,
      senderAvatarUrl: item.senderAvatarUrl,
      senderAvatarId: item.senderAvatarId,
    };
    if (item.kind !== 'message')
      return {
        ...base,
        kind: 'event' as const,
        event: {
          label: item.kind === 'expense' ? 'Expense added' : 'Settlement recorded',
          title: item.title ?? '',
          amount: item.amount,
          amountMinor: item.amountMinor,
          currency: item.currency,
          icon: item.icon,
          color: item.color,
          onPress: item.onPress,
        },
      };
    return {
      ...base,
      kind:
        item.audioUrl !== undefined
          ? ('audio' as const)
          : item.text === undefined && item.attachmentUrl !== undefined
            ? ('image' as const)
            : ('text' as const),
      text: item.text,
      imageUrl: item.audioUrl !== undefined ? undefined : item.attachmentUrl,
      audioUrl: item.audioUrl,
      durationMs: item.durationMs,
      status: item.status,
      reactions: item.reactions,
      myReaction: item.myReaction,
      pinned: item.pinned,
      canPin: item.canPin,
      seenBy: item.seenByPeople,
      ...finaiChatOverrides(item.ai),
    };
  });
}

export function GroupChatScreen(p: GroupChatScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const timelineRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (p.embedded && p.canSend && p.items.length)
      timelineRef.current?.scrollToEnd({ animated: true });
  }, [p.embedded, p.canSend, p.items.length]);
  const threadMessages = React.useMemo(() => groupChatMessages(p.items), [p.items]);
  const content = (
    <>
      {!p.embedded && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 4,
          }}
        >
          {!!p.onBack && (
            <Button size="sm" variant="outline" onPress={p.onBack}>
              ‹ Back
            </Button>
          )}
          <View style={{ flex: 1 }}>
            <Typography variant="heading">{p.group?.name ?? 'Group chat'}</Typography>
            <Typography variant="caption">
              {p.group?.currency ? `${p.group.currency} · ` : ''}Group chat
            </Typography>
          </View>
          {!!p.onOpenGroup && (
            <Button size="sm" variant="outline" onPress={p.onOpenGroup}>
              Group
            </Button>
          )}
          {!!p.onAddExpense && (
            <Button size="sm" onPress={p.onAddExpense}>
              + Expense
            </Button>
          )}
          {!!p.onOpenSettings && (
            <Button size="sm" variant="outline" onPress={p.onOpenSettings}>
              Edit
            </Button>
          )}
        </View>
      )}
      {!!p.embedded && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="heading">Recent messages</Typography>
          {!!p.onBack && (
            <Button size="sm" variant="outline" onPress={p.onBack}>
              Open chat
            </Button>
          )}
        </View>
      )}
      {p.embedded && p.group && (
        <GroupPanel>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <GroupTile icon={p.group.icon} color={p.group.color} size={68} />
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="heading">{p.group.name}</Typography>
              <Typography variant="caption">{p.group.currency} · Shared expenses</Typography>
            </View>
          </View>
          <GroupMetadataSummary group={p.group} />
          {!!p.onBack && (
            <Button size="sm" variant="outline" onPress={p.onBack}>
              Open chat
            </Button>
          )}
        </GroupPanel>
      )}
      <GroupPanel style={{ padding: 10, gap: 10, flex: p.embedded ? undefined : 1 }}>
        <ScrollView
          ref={timelineRef}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          accessibilityRole="list"
          accessibilityLabel="Group messages"
          accessibilityLiveRegion="polite"
          style={{
            flex: 1,
            minHeight: p.embedded ? 160 : 0,
            maxHeight: p.embedded ? 340 : undefined,
          }}
          contentContainerStyle={{ padding: 4, gap: 16, flexGrow: 1 }}
        >
          {!!p.loading && <Typography variant="small">Loading saved messages…</Typography>}
          {p.items.map((item) =>
            item.ai ? (
              <View
                key={item.id}
                accessibilityLabel="FinAI reply"
                style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
              >
                <ThinkingOrb
                  state={
                    item.ai.status === 'done' || item.ai.status === 'error'
                      ? 'idle'
                      : orbStateFor(item.ai)
                  }
                  size={32}
                  paused={item.ai.status === 'done' || item.ai.status === 'error'}
                />
                <View style={{ flex: 1, gap: 5 }}>
                  <Typography variant="caption">FinAI · {item.date}</Typography>
                  <View
                    style={{
                      gap: 8,
                      borderRadius: 9,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: tokens.borderSubtle,
                      backgroundColor: tokens.surfaceRaised,
                    }}
                  >
                    {item.ai.status === 'error' ? (
                      <Typography variant="body">{finaiErrorMessage(item.ai.errorCode)}</Typography>
                    ) : item.text ? (
                      <Typography variant="body">{item.text}</Typography>
                    ) : (
                      <ThinkingOrb
                        state={orbStateFor(item.ai)}
                        size={18}
                        caption={item.ai.stageLabel ?? 'Thinking…'}
                        label="FinAI is working"
                      />
                    )}
                    <FinaiSurface
                      a2ui={item.ai.a2ui}
                      actions={item.ai.actions}
                      onDecide={p.onFinaiDecide}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View
                key={item.id}
                accessibilityLabel={item.accessibleLabel}
                style={{
                  flexDirection: item.ownMessage ? 'row-reverse' : 'row',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <GroupAvatar
                  name={
                    item.ownMessage
                      ? 'You'
                      : (item.sender ?? (item.kind === 'message' ? 'Member' : 'Group'))
                  }
                  avatarUrl={item.senderAvatarUrl}
                  avatarId={item.senderAvatarId}
                  size={32}
                />
                <View
                  style={{
                    flex: 1,
                    gap: 5,
                    alignItems: item.ownMessage ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Typography variant="caption">
                    {item.ownMessage ? 'You' : (item.sender ?? 'Group')} · {item.date}
                  </Typography>
                  {item.kind === 'message' ? (
                    <View
                      style={{
                        maxWidth: '100%',
                        gap: 7,
                        borderRadius: 9,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: item.ownMessage ? tokens.primary : tokens.borderSubtle,
                        backgroundColor: item.ownMessage ? tokens.secondary : tokens.surfaceRaised,
                      }}
                    >
                      {!!item.text && (
                        <Typography
                          variant="body"
                          style={{
                            color: item.ownMessage ? tokens.secondaryForeground : tokens.foreground,
                          }}
                        >
                          {item.text}
                        </Typography>
                      )}
                      {item.audioUrl !== undefined && (
                        <VoiceBubble
                          src={item.audioUrl}
                          durationMs={item.durationMs}
                          mine={item.ownMessage}
                        />
                      )}
                      {!!item.attachmentUrl && (
                        <Image
                          source={{ uri: item.attachmentUrl }}
                          accessibilityLabel={`Bill shared by ${item.ownMessage ? 'you' : (item.sender ?? 'a member')}`}
                          resizeMode="contain"
                          style={{ width: 210, maxWidth: '100%', height: 170, borderRadius: 6 }}
                        />
                      )}
                      {!item.text &&
                        !item.attachmentUrl &&
                        item.audioUrl === undefined && (
                          <Typography variant="caption">
                            Bill image is no longer available.
                          </Typography>
                        )}
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole={item.onPress ? 'button' : undefined}
                      disabled={!item.onPress}
                      onPress={item.onPress}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.75 : 1,
                        width: '100%',
                        gap: 8,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: tokens.borderSubtle,
                        backgroundColor: tokens.surfaceRaised,
                        flexDirection: 'row',
                        alignItems: 'center',
                      })}
                    >
                      <GroupTile
                        icon={
                          item.icon ??
                          (item.kind === 'expense'
                            ? 'phosphor:Receipt'
                            : 'phosphor:ArrowsLeftRight')
                        }
                        color={
                          item.color ?? (item.kind === 'expense' ? tokens.warning : tokens.income)
                        }
                        size={42}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Typography variant="caption">
                          {item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'}
                        </Typography>
                        <Typography variant="label">{item.title}</Typography>
                        {item.amountMinor !== undefined ? (
                          <Money
                            amountMinor={item.amountMinor}
                            currency={item.currency ?? p.group?.currency ?? ''}
                            size="body"
                          />
                        ) : (
                          <Typography variant="heading">
                            {item.amount ?? 'Amount unavailable'}
                          </Typography>
                        )}
                      </View>
                      {!!item.onPress && <Typography>›</Typography>}
                    </Pressable>
                  )}
                </View>
                {item.ownMessage && !!item.readBy?.length && (
                  <Typography
                    variant="caption"
                    accessibilityLabel={`Seen by ${item.readBy.join(', ')}`}
                  >
                    Seen by {item.readBy.join(', ')}
                  </Typography>
                )}
              </View>
            ),
          )}
          {!!p.typingNames?.length && (
            <Typography variant="caption" accessibilityLiveRegion="polite">
              {p.typingNames.join(', ')} {p.typingNames.length === 1 ? 'is' : 'are'} typing…
            </Typography>
          )}
          {!p.loading && !p.error && !p.items.length && (
            <FinanceEmptyState
              kind="group"
              title="Start the conversation"
              description="Share a note or a bill with the group."
              compact
            />
          )}
        </ScrollView>
        {p.canSend ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                alignItems: 'center',
                borderTopWidth: 1,
                borderColor: tokens.borderSubtle,
                paddingTop: 10,
              }}
            >
              <IconButton
                label="Attach bill image"
                variant="ghost"
                disabled={p.pending}
                onPress={p.onChooseBillImage}
              >
                <ImageSquare size={23} color={tokens.foreground} weight="fill" />
              </IconButton>
              <Input
                accessibilityLabel="Group message"
                style={{ flex: 1 }}
                value={p.draft}
                onChangeText={(value) => {
                  p.onDraftChange(value);
                  p.onTypingChange?.(Boolean(value.trim()));
                }}
                onBlur={() => p.onTypingChange?.(false)}
                multiline
                maxLength={4000}
                placeholder={p.group ? `Message ${p.group.name}…` : 'Write a message…'}
                editable={!p.pending}
              />
              <IconButton
                variant="primary"
                label={p.pending ? 'Sending message' : 'Send message'}
                disabled={p.pending || !p.draft.trim()}
                onPress={p.onSend}
              >
                <PaperPlaneTilt size={22} color={tokens.primaryForeground} weight="fill" />
              </IconButton>
            </View>
            <Typography variant="caption" accessibilityLiveRegion="polite">
              {p.pending
                ? 'Sending to the group…'
                : `${p.draft.length}/4,000 · Online sending only`}
            </Typography>
          </>
        ) : (
          <View
            style={{ gap: 5, borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 12 }}
          >
            <Typography variant="label">
              {p.connected ? 'Chat is not synced yet' : 'Group chat is offline'}
            </Typography>
            <Typography variant="caption">
              {p.connected
                ? 'Sync the saved group to connect chat and bill sharing.'
                : 'Connect to load messages or send notes and bill images. Your ledger remains available offline.'}
            </Typography>
          </View>
        )}
        {!!p.error && (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {p.error}
          </Typography>
        )}
      </GroupPanel>
    </>
  );
  if (p.embedded) return <View style={{ gap: 12 }}>{content}</View>;
  const offline = (
    <View style={{ gap: 5, borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 12 }}>
      <Typography variant="label">
        {p.connected ? 'Chat is not synced yet' : 'Group chat is offline'}
      </Typography>
      <Typography variant="caption">
        {p.connected
          ? 'Sync the saved group to connect chat and bill sharing.'
          : 'Connect to load messages or send notes and bill images. Your ledger remains available offline.'}
      </Typography>
    </View>
  );
  const typing = [...(p.typingNames ?? []), ...finaiTypingNames(p.items)];
  const subtitle = chatHeaderSubtitle({
    mode: 'group',
    typingNames: typing,
    memberCount: p.members?.length,
    onlineCount: p.onlineCount,
  });
  const openDetails = p.onOpenSettings ?? p.onOpenGroup;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + 8,
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginHorizontal: -8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: tokens.borderSubtle,
          }}
        >
          {!!p.onBack && (
            <IconButton label="Back" variant="ghost" onPress={p.onBack}>
              <ArrowLeft size={21} color={tokens.foreground} />
            </IconButton>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${p.group?.name ?? 'Group'}, open group settings`}
            disabled={!openDetails}
            onPress={openDetails}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 4,
              paddingHorizontal: 6,
              borderRadius: 12,
              backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
            })}
          >
            {p.group ? <GroupTile icon={p.group.icon} color={p.group.color} size={40} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="label"
                numberOfLines={1}
                style={{ color: tokens.foreground, fontSize: 16 }}
              >
                {p.group?.name ?? 'Group chat'}
              </Typography>
              {subtitle ? (
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  accessibilityLiveRegion="polite"
                  style={{ color: typing.length ? tokens.primary : tokens.foregroundMuted }}
                >
                  {subtitle}
                </Typography>
              ) : null}
            </View>
          </Pressable>
          {!!p.onAddExpense && (
            <IconButton label="Add expense" variant="ghost" onPress={p.onAddExpense}>
              <Plus size={21} color={tokens.foreground} />
            </IconButton>
          )}
        </View>
        <ChatThread
          mode="group"
          messages={threadMessages}
          loading={p.loading}
          canLoadOlder={p.canLoadOlder}
          loadingOlder={p.loadingOlder}
          onLoadOlder={p.onLoadOlder}
          firstUnreadId={p.firstUnreadId}
          typingNames={typing}
          renderAiContent={(message) => (
            <FinaiSurface
              a2ui={message.ai?.a2ui}
              actions={message.ai?.actions}
              onDecide={p.onFinaiDecide}
            />
          )}
          pinned={p.pinned}
          onTogglePin={p.onTogglePin}
          onReact={p.onReact}
          onRetry={p.onRetry}
          onDiscard={p.onDiscard}
          onSeenLatest={p.onSeenLatest}
          error={p.error}
          renderEvent={(message) => {
            const item = p.items.find((entry) => entry.id === message.id);
            return item ? <EventCard item={item} currency={p.group?.currency ?? ''} /> : null;
          }}
          emptyTitle="Start the conversation"
          emptyDescription="Share a note or a bill with the group."
          composer={
            p.canSend
              ? {
                  draft: p.draft,
                  onDraftChange: (value) => {
                    p.onDraftChange(value);
                    p.onTypingChange?.(Boolean(value.trim()));
                  },
                  onSend: p.onSend,
                  onBlur: () => p.onTypingChange?.(false),
                  onAttach: p.onChooseBillImage,
                  onSendVoice: p.onSendVoice,
                  attachLabel: 'Attach bill image',
                  uploading: p.pending,
                  placeholder: p.group ? `Message ${p.group.name}…` : 'Write a message…',
                  mentions: [FINAI_MENTION],
                }
              : undefined
          }
          footer={offline}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function EventCard({ item, currency }: { item: GroupChatItem; currency: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole={item.onPress ? 'button' : undefined}
      accessibilityLabel={item.accessibleLabel}
      disabled={!item.onPress}
      onPress={item.onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.75 : 1,
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceRaised,
        flexDirection: 'row',
        alignItems: 'center',
      })}
    >
      <GroupTile
        icon={
          item.icon ?? (item.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight')
        }
        color={item.color ?? (item.kind === 'expense' ? tokens.warning : tokens.income)}
        size={40}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="caption">
          {item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'} · {item.date}
        </Typography>
        <Typography variant="label">{item.title}</Typography>
        {item.amountMinor !== undefined ? (
          <Money amountMinor={item.amountMinor} currency={item.currency ?? currency} size="body" />
        ) : (
          <Typography variant="label">{item.amount ?? 'Amount unavailable'}</Typography>
        )}
      </View>
      {!!item.onPress && <Typography>›</Typography>}
    </Pressable>
  );
}
