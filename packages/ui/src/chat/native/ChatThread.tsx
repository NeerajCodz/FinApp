import React from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image,
  Modal,
  Pressable,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  ArrowClockwise,
  ArrowDown,
  ImageSquare,
  PaperPlaneTilt,
  PushPin,
  PushPinSlash,
  X,
} from 'phosphor-react-native';
import { Avatar } from '../../native/feedback';
import { IconButton } from '../../native/button';
import { Typography } from '../../native/typography';
import { useTheme } from '../../native/ThemeProvider';
import { Sheet } from '../../native/overlays';
import { AvatarStack, ListSkeleton } from '../../native/visual';
import { useReducedMotion } from '../../native/motion';
import { ThinkingOrb } from '../../native/ThinkingOrb';
import { FinaiLogo } from '../../ai/native/FinaiLogo';
import { FinaiMarkdown } from '../../ai/native/FinaiMarkdown';
import { FinaiSteps } from '../../ai/native/FinaiSteps';
import {
  activeMention,
  applyMention,
  finaiErrorMessage,
  isFinaiBusy,
  mentionMatches,
  orbStateFor,
  type MentionOption,
} from '../../ai/finai';
import { Illustration } from '../../illustrations/native';
import { withAlpha } from '../../tokens';
import {
  buildChatRows,
  CHAT_NEAR_BOTTOM_PX,
  CHAT_REACTIONS,
  CHAT_TEXT_LIMIT,
  messageAccessibleLabel,
  pinPreview,
  receiptLabel,
  timeLabel,
  typingLabel,
  type ChatMessage,
  type ChatPin,
  type ChatReactionEmoji,
  type ChatRow,
} from '../model';

export type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onBlur?: () => void;
  onAttach?: () => void;
  attachLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** An upload is in flight; attach is disabled, text sending stays available. */
  uploading?: boolean;
  /** Handles offered when the user types `@` (e.g. FinAI). */
  mentions?: readonly MentionOption[];
};

export type ChatThreadProps = {
  mode: 'direct' | 'group';
  /** Oldest first, including optimistic messages. */
  messages: readonly ChatMessage[];
  loading: boolean;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string;
  typingNames?: readonly string[];
  pinned?: readonly (ChatPin & { canUnpin?: boolean })[];
  onTogglePin?: (id: string, pinned: boolean) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
  /** Called with the newest visible incoming message time while the viewer is at the bottom. */
  onSeenLatest?: (createdAt: number) => void;
  renderEvent?: (message: ChatMessage) => React.ReactNode;
  /** Rich content under a FinAI reply (A2UI cards). */
  renderAiContent?: (message: ChatMessage) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  composer?: ChatComposerProps;
  /** Shown instead of the composer (for example an offline notice). */
  footer?: React.ReactNode;
  error?: string;
};

type Highlight = { id: string; until: number };

export function ChatThread(p: ChatThreadProps) {
  const { tokens } = useTheme();
  const listRef = React.useRef<FlatList<ChatRow>>(null);
  const rows = React.useMemo(
    () => buildChatRows(p.messages, { firstUnreadId: p.firstUnreadId }),
    [p.messages, p.firstUnreadId],
  );
  const data = React.useMemo(() => [...rows].reverse(), [rows]);
  const nearBottom = React.useRef(true);
  const [newCount, setNewCount] = React.useState(0);
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState<Highlight | null>(null);
  const [jumpTarget, setJumpTarget] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const [pinIndex, setPinIndex] = React.useState(0);
  const newest = p.messages[p.messages.length - 1];
  const newestIncoming = React.useMemo(
    () =>
      [...p.messages].reverse().find((message) => !message.mine && message.status !== 'pending'),
    [p.messages],
  );
  const onSeenLatest = p.onSeenLatest;
  const reportSeen = React.useCallback(() => {
    if (newestIncoming) onSeenLatest?.(newestIncoming.createdAt);
  }, [newestIncoming, onSeenLatest]);

  // Own sends always return to the bottom; incoming messages count toward the chip unless the
  // list is already at the bottom (maintainVisibleContentPosition keeps it pinned there).
  const lastNewest = React.useRef<ChatMessage | undefined>(undefined);
  React.useEffect(() => {
    const previous = lastNewest.current;
    lastNewest.current = newest;
    if (!newest || !previous || previous.id === newest.id) return;
    if (newest.createdAt < previous.createdAt) return;
    if (newest.mine) {
      nearBottom.current = true;
      setNewCount(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    if (nearBottom.current) reportSeen();
    else {
      const fresh = p.messages.filter(
        (message) => !message.mine && message.createdAt > previous.createdAt,
      ).length;
      setNewCount((count) => count + Math.max(1, fresh));
    }
  }, [newest, p.messages, reportSeen]);

  // On first load, open at the first unread message rather than the very bottom.
  const openedAtUnread = React.useRef(false);
  React.useEffect(() => {
    if (openedAtUnread.current || p.loading || !data.length) return;
    openedAtUnread.current = true;
    const index = data.findIndex((row) => row.type === 'unread');
    if (index > 2) {
      nearBottom.current = false;
      requestAnimationFrame(() =>
        listRef.current?.scrollToIndex({ index, viewPosition: 0.85, animated: false }),
      );
    } else reportSeen();
  }, [data, p.loading, reportSeen]);

  // Jump to a pinned message, paging older history in until it is loaded.
  React.useEffect(() => {
    if (!jumpTarget) return;
    const index = data.findIndex((row) => row.type === 'message' && row.key === jumpTarget);
    if (index >= 0) {
      setJumpTarget(null);
      nearBottom.current = index < 3;
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlight({ id: jumpTarget, until: Date.now() + 1_800 });
      return;
    }
    if (p.canLoadOlder) {
      if (!p.loadingOlder) p.onLoadOlder?.();
      return;
    }
    setJumpTarget(null);
    setNotice('That pinned message is no longer in the chat history.');
  }, [data, jumpTarget, p]);
  React.useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), highlight.until - Date.now());
    return () => clearTimeout(timer);
  }, [highlight]);
  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3_500);
    return () => clearTimeout(timer);
  }, [notice]);

  const composerBlur = p.composer?.onBlur;
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') composerBlur?.();
    });
    return () => subscription.remove();
  }, [composerBlur]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const atBottom = event.nativeEvent.contentOffset.y < CHAT_NEAR_BOTTOM_PX;
    if (atBottom && !nearBottom.current) {
      setNewCount(0);
      reportSeen();
    }
    nearBottom.current = atBottom;
  }
  function scrollToBottom() {
    nearBottom.current = true;
    setNewCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    reportSeen();
  }

  const pins = p.pinned ?? [];
  const activePin = pins[Math.min(pinIndex, pins.length - 1)];
  const actionMessage = actionId ? p.messages.find((message) => message.id === actionId) : null;

  const renderRow = ({ item }: { item: ChatRow }) => {
    if (item.type === 'day')
      return (
        <View style={{ alignItems: 'center', paddingVertical: 10 }} accessibilityRole="header">
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <Typography variant="caption">{item.label}</Typography>
          </View>
        </View>
      );
    if (item.type === 'unread')
      return (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
          accessibilityLabel={`${item.count} unread messages`}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: tokens.primary }} />
          <Typography variant="caption" style={{ color: tokens.primary }}>
            Unread
          </Typography>
          <View style={{ flex: 1, height: 1, backgroundColor: tokens.primary }} />
        </View>
      );
    return (
      <MessageRow
        row={item}
        mode={p.mode}
        highlighted={highlight?.id === item.message.id}
        renderEvent={p.renderEvent}
        renderAiContent={p.renderAiContent}
        onLongPress={() => setActionId(item.message.id)}
        onOpenImage={setPreview}
        onReact={p.onReact}
        onRetry={p.onRetry}
        onDiscard={p.onDiscard}
      />
    );
  };

  const empty = !p.loading && !p.messages.length;
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {!!activePin && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <PushPin size={18} color={tokens.primary} weight="fill" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pinned message from ${activePin.senderName}: ${activePin.text}. Jump to message`}
            style={{ flex: 1 }}
            onPress={() => {
              setJumpTarget(activePin.id);
              if (pins.length > 1) setPinIndex((index) => (index + 1) % pins.length);
            }}
          >
            <Typography variant="caption">
              Pinned
              {pins.length > 1
                ? ` · ${Math.min(pinIndex, pins.length - 1) + 1}/${pins.length}`
                : ''}{' '}
              · {activePin.senderName}
            </Typography>
            <Typography variant="small" numberOfLines={1}>
              {pinPreview(activePin.text)}
            </Typography>
          </Pressable>
          {!!activePin.canUnpin && !!p.onTogglePin && (
            <IconButton
              label="Unpin message"
              variant="ghost"
              onPress={() => p.onTogglePin?.(activePin.id, false)}
            >
              <X size={16} color={tokens.foregroundMuted} />
            </IconButton>
          )}
        </View>
      )}
      <View style={{ flex: 1 }}>
        {p.loading && !p.messages.length ? (
          <ListSkeleton rows={5} />
        ) : empty ? (
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}
          >
            <Illustration scene="message" size={150} />
            <Typography variant="heading" style={{ textAlign: 'center' }}>
              {p.emptyTitle ?? 'Start the conversation'}
            </Typography>
            <Typography variant="caption" style={{ textAlign: 'center' }}>
              {p.emptyDescription ?? 'Say hello — messages appear here instantly.'}
            </Typography>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={data}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            onScroll={onScroll}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={p.mode === 'group' ? 'Group messages' : 'Messages'}
            contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 8 }}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: CHAT_NEAR_BOTTOM_PX,
            }}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (p.canLoadOlder && !p.loadingOlder) p.onLoadOlder?.();
            }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({
                offset: index * averageItemLength,
                animated: false,
              });
              setTimeout(
                () => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }),
                120,
              );
            }}
            initialNumToRender={20}
            windowSize={11}
            ListHeaderComponent={<TypingIndicator names={p.typingNames ?? []} />}
            ListFooterComponent={
              p.loadingOlder ? (
                <ActivityIndicator style={{ padding: 12 }} color={tokens.primary} />
              ) : !p.canLoadOlder && p.messages.length > 20 ? (
                <Typography variant="caption" style={{ textAlign: 'center', padding: 12 }}>
                  Beginning of the conversation
                </Typography>
              ) : null
            }
          />
        )}
        {newCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${newCount} new ${newCount === 1 ? 'message' : 'messages'}, scroll to latest`}
            onPress={scrollToBottom}
            style={{
              position: 'absolute',
              bottom: 12,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tokens.primary,
            }}
          >
            <Typography variant="label" style={{ color: tokens.primaryForeground }}>
              {newCount} new {newCount === 1 ? 'message' : 'messages'}
            </Typography>
            <ArrowDown size={16} color={tokens.primaryForeground} weight="bold" />
          </Pressable>
        )}
      </View>
      {!!notice && (
        <Typography
          variant="caption"
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center' }}
        >
          {notice}
        </Typography>
      )}
      {!!p.error && (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {p.error}
        </Typography>
      )}
      {p.composer ? <Composer {...p.composer} /> : p.footer}
      <Sheet visible={!!actionMessage} onClose={() => setActionId(null)} title="Message">
        {actionMessage && (
          <View style={{ gap: 14 }}>
            {!!p.onReact &&
              actionMessage.status !== 'pending' &&
              actionMessage.status !== 'failed' && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  {CHAT_REACTIONS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`React with ${emoji}`}
                      accessibilityState={{ selected: actionMessage.myReaction === emoji }}
                      onPress={() => {
                        p.onReact?.(actionMessage.id, emoji);
                        setActionId(null);
                      }}
                      style={{
                        padding: 10,
                        borderRadius: 999,
                        backgroundColor:
                          actionMessage.myReaction === emoji
                            ? tokens.secondary
                            : tokens.surfaceSubtle,
                      }}
                    >
                      <Typography style={{ fontSize: 24 }}>{emoji}</Typography>
                    </Pressable>
                  ))}
                </View>
              )}
            {!!p.onTogglePin && !!actionMessage.canPin && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  p.onTogglePin?.(actionMessage.id, !actionMessage.pinned);
                  setActionId(null);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
              >
                {actionMessage.pinned ? (
                  <PushPinSlash size={20} color={tokens.foreground} />
                ) : (
                  <PushPin size={20} color={tokens.foreground} />
                )}
                <Typography variant="label">
                  {actionMessage.pinned ? 'Unpin message' : 'Pin message'}
                </Typography>
              </Pressable>
            )}
            {actionMessage.status === 'failed' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  p.onRetry?.(actionMessage.id);
                  setActionId(null);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
              >
                <ArrowClockwise size={20} color={tokens.foreground} />
                <Typography variant="label">Retry sending</Typography>
              </Pressable>
            )}
          </View>
        )}
      </Sheet>
      <Modal
        visible={!!preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
          onPress={() => setPreview(null)}
          style={{
            flex: 1,
            backgroundColor: tokens.overlay,
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {!!preview && (
            <Image
              source={{ uri: preview }}
              resizeMode="contain"
              accessibilityLabel="Image attachment"
              style={{ width: '100%', height: '80%' }}
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function MessageRow({
  row,
  mode,
  highlighted,
  renderEvent,
  renderAiContent,
  onLongPress,
  onOpenImage,
  onReact,
  onRetry,
  onDiscard,
}: {
  row: Extract<ChatRow, { type: 'message' }>;
  mode: 'direct' | 'group';
  highlighted: boolean;
  renderEvent?: (message: ChatMessage) => React.ReactNode;
  renderAiContent?: (message: ChatMessage) => React.ReactNode;
  onLongPress: () => void;
  onOpenImage: (url: string) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
}) {
  const { tokens } = useTheme();
  const { message, firstInGroup, lastInGroup } = row;
  const label = messageAccessibleLabel(message, mode);
  if (message.kind === 'event' || message.kind === 'system')
    return (
      <View
        accessibilityLabel={label}
        style={{ paddingVertical: 6, alignItems: message.kind === 'system' ? 'center' : 'stretch' }}
      >
        {message.kind === 'event' && renderEvent ? (
          renderEvent(message)
        ) : (
          <Typography variant="caption" style={{ textAlign: 'center' }}>
            {message.text ?? message.event?.title}
          </Typography>
        )}
      </View>
    );
  const mine = message.mine;
  const showAvatar = mode === 'group' && !mine;
  const radius = 18;
  const tight = 6;
  const bubbleColor =
    message.kind === 'ai' ? tokens.surfaceSubtle : mine ? tokens.primary : tokens.surfaceRaised;
  const textColor = mine && message.kind !== 'ai' ? tokens.primaryForeground : tokens.foreground;
  return (
    <View
      accessibilityLabel={label}
      style={{
        flexDirection: mine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: firstInGroup ? 10 : 2,
        paddingHorizontal: 4,
        paddingVertical: highlighted ? 4 : 0,
        borderRadius: 12,
        backgroundColor: highlighted ? withAlpha(tokens.primary, 0.14) : 'transparent',
      }}
    >
      {showAvatar && (
        <View style={{ width: 30 }}>
          {lastInGroup && message.kind === 'ai' ? (
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(tokens.primary, 0.14),
              }}
            >
              {isFinaiBusy(message.ai) ? (
                <ThinkingOrb state={orbStateFor(message.ai!)} size={18} />
              ) : (
                <FinaiLogo size={20} />
              )}
            </View>
          ) : (
            lastInGroup && (
              <Avatar
                label={message.senderName ?? 'Member'}
                initials={(message.senderName ?? '?').slice(0, 2).toUpperCase()}
                imageUrl={message.senderAvatarUrl}
                avatarId={message.senderAvatarId}
                size={30}
              />
            )
          )}
        </View>
      )}
      <View
        style={{
          maxWidth: message.kind === 'ai' ? '88%' : '78%',
          alignItems: mine ? 'flex-end' : 'flex-start',
          gap: 3,
        }}
      >
        {firstInGroup && !mine && (mode === 'group' || message.kind === 'ai') && (
          <Typography variant="caption" style={{ marginLeft: 4 }}>
            {message.senderName ?? 'Member'}
            {message.kind === 'ai' ? ' · Assistant' : ''}
          </Typography>
        )}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={280}
          accessibilityHint="Long press for reactions and pinning"
          style={{
            opacity: message.status === 'pending' ? 0.65 : 1,
            paddingHorizontal: message.kind === 'image' ? 4 : 13,
            paddingVertical: message.kind === 'image' ? 4 : 9,
            backgroundColor: bubbleColor,
            borderWidth: message.status === 'failed' ? 1 : mine ? 0 : 1,
            borderColor: message.status === 'failed' ? tokens.destructive : tokens.borderSubtle,
            borderTopLeftRadius: !mine && !firstInGroup ? tight : radius,
            borderBottomLeftRadius: !mine && !lastInGroup ? tight : radius,
            borderTopRightRadius: mine && !firstInGroup ? tight : radius,
            borderBottomRightRadius: mine && !lastInGroup ? tight : radius,
          }}
        >
          {message.pinned && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <PushPin size={12} color={textColor} weight="fill" />
              <Typography variant="caption" style={{ color: textColor }}>
                Pinned
              </Typography>
            </View>
          )}
          {message.kind === 'image' ? (
            message.imageUrl ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Open image"
                onPress={() => onOpenImage(message.imageUrl!)}
                onLongPress={onLongPress}
              >
                <Image
                  source={{ uri: message.imageUrl }}
                  resizeMode="cover"
                  style={{ width: 220, height: 220, borderRadius: 14 }}
                />
              </Pressable>
            ) : (
              <Typography variant="caption" style={{ padding: 8 }}>
                Image is no longer available.
              </Typography>
            )
          ) : message.kind === 'ai' && message.ai?.status === 'error' ? (
            <Typography variant="body" style={{ color: tokens.foregroundMuted }}>
              {finaiErrorMessage(message.ai.errorCode)}
            </Typography>
          ) : message.kind === 'ai' && message.ai ? (
            <View style={{ gap: 6 }}>
              {message.ai.steps?.length ? (
                <FinaiSteps steps={message.ai.steps} busy={isFinaiBusy(message.ai)} />
              ) : null}
              {!message.text && isFinaiBusy(message.ai) ? (
                message.ai.steps?.some((step) => step.status === 'running') ? null : (
                  <View
                    accessibilityLiveRegion="polite"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }}
                  >
                    <ThinkingOrb
                      state={orbStateFor(message.ai)}
                      size={20}
                      label="FinAI is thinking"
                    />
                    <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
                      {message.ai.stageLabel ?? 'Thinking…'}
                    </Typography>
                  </View>
                )
              ) : (
                <FinaiMarkdown
                  text={message.text ?? ''}
                  streaming={message.ai.status === 'streaming'}
                />
              )}
            </View>
          ) : (
            <Typography variant="body" style={{ color: textColor }} selectable>
              {message.text}
              {message.kind === 'ai' && isFinaiBusy(message.ai) ? (
                <Typography style={{ color: tokens.primary }}> ▍</Typography>
              ) : null}
            </Typography>
          )}
        </Pressable>
        {message.kind === 'ai' && message.ai?.status === 'done' && renderAiContent?.(message)}
        {!!message.reactions?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {message.reactions.map(({ emoji, count }) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`${emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}`}
                accessibilityState={{ selected: message.myReaction === emoji }}
                disabled={!onReact}
                onPress={() => onReact?.(message.id, emoji as ChatReactionEmoji)}
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: message.myReaction === emoji ? tokens.primary : tokens.borderSubtle,
                  backgroundColor: tokens.surfaceRaised,
                }}
              >
                <Typography variant="caption" style={{ color: tokens.foreground }}>
                  {emoji} {count}
                </Typography>
              </Pressable>
            ))}
          </View>
        )}
        {message.status === 'failed' ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Typography variant="caption" style={{ color: tokens.destructive }}>
              Not sent
            </Typography>
            {!!onRetry && (
              <Pressable accessibilityRole="button" onPress={() => onRetry(message.id)}>
                <Typography variant="caption" style={{ color: tokens.primary }}>
                  Retry
                </Typography>
              </Pressable>
            )}
            {!!onDiscard && (
              <Pressable accessibilityRole="button" onPress={() => onDiscard(message.id)}>
                <Typography variant="caption">Discard</Typography>
              </Pressable>
            )}
          </View>
        ) : (
          lastInGroup && (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 4 }}
            >
              <Typography variant="caption">{timeLabel(message.createdAt)}</Typography>
              {mine && <Typography variant="caption">· {receiptLabel(message, mode)}</Typography>}
              {mine && mode === 'group' && !!message.seenBy?.length && (
                <AvatarStack
                  size={16}
                  max={3}
                  people={message.seenBy.map((person) => ({
                    id: person.id,
                    name: person.name,
                    imageUrl: person.avatarUrl,
                    avatarId: person.avatarId,
                  }))}
                />
              )}
            </View>
          )
        )}
      </View>
    </View>
  );
}

function TypingIndicator({ names }: { names: readonly string[] }) {
  const { tokens } = useTheme();
  const reduced = useReducedMotion();
  const dots = React.useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  const visible = names.length > 0;
  React.useEffect(() => {
    if (!visible || reduced) return;
    const loop = Animated.loop(
      Animated.stagger(
        160,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots, reduced, visible]);
  if (!visible) return null;
  const label = typingLabel(names);
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: tokens.foregroundMuted,
              opacity: dot,
            }}
          />
        ))}
      </View>
      <Typography variant="caption">{label}…</Typography>
    </View>
  );
}

function Composer(c: ChatComposerProps) {
  const { tokens } = useTheme();
  const canSend = !c.disabled && !!c.draft.trim();
  const [selection, setSelection] = React.useState<{ start: number; end: number } | undefined>();
  const caret = selection?.start ?? c.draft.length;
  const active = c.mentions?.length ? activeMention(c.draft, caret) : null;
  const options = active ? mentionMatches(c.mentions!, active.query) : [];
  return (
    <View>
      {options.length > 0 && (
        <View
          accessibilityRole="menu"
          style={{
            marginBottom: 6,
            padding: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.popover,
          }}
        >
          {options.map((option) => (
            <Pressable
              key={option.handle}
              accessibilityRole="menuitem"
              accessibilityLabel={`Mention ${option.label}`}
              onPress={() => {
                const next = applyMention(c.draft, option, caret);
                c.onDraftChange(next.draft);
                setSelection({ start: next.caret, end: next.caret });
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 8,
                borderRadius: 12,
                backgroundColor: pressed ? withAlpha(tokens.primary, 0.14) : 'transparent',
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(tokens.primary, 0.14),
                }}
              >
                <FinaiLogo size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label">
                  @{option.handle} · {option.label}
                </Typography>
                <Typography variant="caption">{option.description}</Typography>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
          borderTopWidth: 1,
          borderColor: tokens.borderSubtle,
          paddingTop: 8,
        }}
      >
        {!!c.onAttach && (
          <IconButton
            label={c.attachLabel ?? 'Attach image'}
            variant="ghost"
            disabled={c.disabled || c.uploading}
            onPress={c.onAttach}
          >
            {c.uploading ? (
              <ActivityIndicator color={tokens.primary} />
            ) : (
              <ImageSquare size={23} color={tokens.foreground} weight="fill" />
            )}
          </IconButton>
        )}
        <TextInput
          accessibilityLabel="Message"
          value={c.draft}
          onChangeText={(value) => {
            c.onDraftChange(value);
            setSelection(undefined);
          }}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          selection={selection}
          onBlur={c.onBlur}
          placeholder={c.placeholder ?? 'Message'}
          placeholderTextColor={tokens.foregroundSubtle}
          multiline
          maxLength={CHAT_TEXT_LIMIT}
          editable={!c.disabled}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 42,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: tokens.foreground,
            backgroundColor: tokens.surfaceSubtle,
          }}
        />
        <IconButton variant="primary" label="Send message" disabled={!canSend} onPress={c.onSend}>
          <PaperPlaneTilt size={21} color={tokens.primaryForeground} weight="fill" />
        </IconButton>
      </View>
    </View>
  );
}
