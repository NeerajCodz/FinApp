/**
 * The FinAI assistant on mobile: header with the Thinking Orb and a history sheet, an inverted
 * thread (user bubbles, streamed FinAI replies with orb progress and A2UI cards) and a composer
 * with suggestions. Data and actions come from the app through props.
 */
import React from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowUp,
  ChatsCircle,
  Camera,
  ClockCounterClockwise,
  File as FileIcon,
  FilePdf,
  FileText,
  Images,
  ImageSquare,
  NotePencil,
  Paperclip,
  Plus,
  Table,
  Trash,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { IconButton, ThinkingOrb, Typography, useTheme } from '@finapp/ui/native';
import { Sheet } from '../../native/overlays';
import {
  FINAI_NAME,
  FINAI_SUGGESTIONS,
  finaiErrorMessage,
  formatFileSize,
  type FinaiAttachmentKind,
  type FinaiAttachmentView,
  type FinaiComposerAttachment,
  isFinaiBusy,
  orbStateFor,
  type FinaiAssistantMessage,
} from '../finai';
import { FinaiSurface, type FinaiDecision } from './FinaiSurface';
import { FinaiLogo } from './FinaiLogo';
import { FinaiMarkdown } from './FinaiMarkdown';
import { FinaiSteps } from './FinaiSteps';

export type FinaiConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  /** A reply finished that hasn't been seen yet. */
  unread?: boolean;
  /** A reply is being written (it keeps going after the chat is closed). */
  working?: boolean;
};

export type FinaiAssistantScreenProps = {
  available: boolean;
  /** Show the tool steps under replies (FinAI setting; default on). */
  showSteps?: boolean;
  conversations: readonly FinaiConversationSummary[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (id: string) => void;
  /** Oldest first. */
  messages: readonly FinaiAssistantMessage[];
  loading: boolean;
  canLoadOlder?: boolean;
  onLoadOlder?: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text?: string) => void;
  sending: boolean;
  error?: string | null;
  onDecide: (actionId: string, decision: FinaiDecision) => Promise<unknown>;
  onBack?: () => void;
  topInset?: number;
  bottomInset?: number;
  /** Files waiting in the composer (attachments on when `onAttach` is set). */
  attachments?: readonly FinaiComposerAttachment[];
  /** Opens the app's picker for photos, the camera or files. */
  onAttach?: (source: 'library' | 'camera' | 'files') => void;
  onRemoveAttachment?: (key: string) => void;
};

function KindIcon({
  kind,
  color,
  size = 16,
}: {
  kind: FinaiAttachmentKind;
  color: string;
  size?: number;
}) {
  if (kind === 'image') return <ImageSquare size={size} color={color} />;
  if (kind === 'pdf') return <FilePdf size={size} color={color} />;
  if (kind === 'spreadsheet') return <Table size={size} color={color} />;
  if (kind === 'text') return <FileText size={size} color={color} />;
  return <FileIcon size={size} color={color} />;
}

/** A file chip (composer or sent message). */
function FileChip({
  name,
  kind,
  detail,
  tone = 'normal',
  leading,
  onRemove,
}: {
  name: string;
  kind: FinaiAttachmentKind;
  detail: string;
  tone?: 'normal' | 'error' | 'gone';
  leading?: React.ReactNode;
  onRemove?: () => void;
}) {
  const { tokens } = useTheme();
  const color = tone === 'error' ? tokens.destructive : tokens.foreground;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: 240,
        paddingVertical: 5,
        paddingLeft: 8,
        paddingRight: onRemove ? 4 : 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tone === 'error' ? tokens.destructive : tokens.borderSubtle,
        backgroundColor: tokens.card,
        opacity: tone === 'gone' ? 0.6 : 1,
      }}
    >
      {leading ?? <KindIcon kind={kind} color={color} />}
      <Typography
        variant="caption"
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color,
          textDecorationLine: tone === 'gone' ? 'line-through' : 'none',
        }}
      >
        {name}
      </Typography>
      <Typography
        variant="caption"
        numberOfLines={1}
        style={{
          color: tone === 'error' ? tokens.destructive : tokens.foregroundSubtle,
          fontSize: 11,
        }}
      >
        {detail}
      </Typography>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          hitSlop={8}
          onPress={onRemove}
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <X size={11} weight="bold" color={tokens.foregroundMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SentAttachments({ files }: { files: readonly FinaiAttachmentView[] }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
      {files.map((file) =>
        file.kind === 'image' && file.available && file.url ? (
          <Pressable
            key={file.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={file.name}
            onPress={() => void Linking.openURL(file.url!)}
            style={{
              width: 132,
              height: 132,
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <Image source={{ uri: file.url }} style={{ width: '100%', height: '100%' }} />
          </Pressable>
        ) : (
          <FileChip
            key={file.id}
            name={file.name}
            kind={file.kind}
            detail={file.available ? formatFileSize(file.size) : 'Deleted'}
            tone={file.available ? 'normal' : 'gone'}
          />
        ),
      )}
    </View>
  );
}

function Reply({
  message,
  onDecide,
  showSteps = true,
}: {
  message: FinaiAssistantMessage;
  onDecide: FinaiAssistantScreenProps['onDecide'];
  showSteps?: boolean;
}) {
  const { tokens } = useTheme();
  const busy = isFinaiBusy(message);
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        {busy ? <ThinkingOrb state={orbStateFor(message)} size={18} /> : <FinaiLogo size={20} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {showSteps && message.steps?.length ? (
          <FinaiSteps steps={message.steps} busy={busy} />
        ) : null}
        {message.status === 'error' ? (
          <View style={{ padding: 10, borderRadius: 14, backgroundColor: tokens.surfaceSubtle }}>
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              {finaiErrorMessage(message.errorCode)}
            </Typography>
          </View>
        ) : !message.text && busy ? (
          message.steps?.some((step) => step.status === 'running') ? null : (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 }}
              accessibilityLiveRegion="polite"
            >
              <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
                {message.stageLabel ?? 'Thinking…'}
              </Typography>
            </View>
          )
        ) : (
          <View style={{ paddingTop: 4 }}>
            <FinaiMarkdown text={message.text} streaming={message.status === 'streaming'} />
          </View>
        )}
        {message.status === 'done' && message.a2ui ? (
          <FinaiSurface a2ui={message.a2ui} actions={message.actions} onDecide={onDecide} />
        ) : null}
      </View>
    </View>
  );
}

export function FinaiAssistantScreen(p: FinaiAssistantScreenProps) {
  const { tokens } = useTheme();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const busy = p.sending || p.messages.some((message) => isFinaiBusy(message));
  const files = p.attachments ?? [];
  const uploading = files.some((file) => file.status === 'uploading');
  const readyFiles = files.filter((file) => file.status === 'ready').length;
  const canSend = p.available && !busy && !uploading && (!!p.draft.trim() || readyFiles > 0);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const pick = (source: 'library' | 'camera' | 'files') => {
    setAttachOpen(false);
    p.onAttach?.(source);
  };
  const data = React.useMemo(() => [...p.messages].reverse(), [p.messages]);
  const empty = !p.loading && p.messages.length === 0;
  const activeTitle = p.conversations.find((row) => row.id === p.activeId)?.title;
  const otherUnread = p.conversations.filter((row) => row.unread && row.id !== p.activeId).length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          paddingTop: (p.topInset ?? 0) + 6,
          paddingHorizontal: 12,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: tokens.borderSubtle,
        }}
      >
        {p.onBack ? (
          <IconButton label="Go back" variant="ghost" onPress={p.onBack}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
        ) : null}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          {busy ? <ThinkingOrb state="working" size={20} /> : <FinaiLogo size={22} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="label" numberOfLines={1}>
            {activeTitle ?? FINAI_NAME}
          </Typography>
          <Typography variant="caption">
            {busy ? 'Working on it…' : 'Asks before changing anything'}
          </Typography>
        </View>
        <IconButton
          label={otherUnread ? `Chat history, ${otherUnread} unread` : 'Chat history'}
          variant="ghost"
          onPress={() => setHistoryOpen(true)}
        >
          <ClockCounterClockwise size={21} color={tokens.foreground} />
          {otherUnread ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: tokens.primary,
                borderWidth: 2,
                borderColor: tokens.background,
              }}
            />
          ) : null}
        </IconButton>
        <IconButton label="New chat" variant="ghost" onPress={() => p.onSelect(null)}>
          <NotePencil size={21} color={tokens.foreground} />
        </IconButton>
      </View>

      {p.loading && p.messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ThinkingOrb state="searching" size={48} label="Loading your chat" />
        </View>
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 18, gap: 8 }}>
          <FinaiLogo size={44} />
          <Typography variant="title" style={{ marginTop: 8 }}>
            What do you want to know?
          </Typography>
          <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
            Ask about spending, budgets, groups or friends, or tell me what to add.
          </Typography>
          {!p.available ? (
            <Typography variant="caption" style={{ color: tokens.warning }}>
              {finaiErrorMessage('AI_NOT_CONFIGURED')}
            </Typography>
          ) : null}
          <View style={{ gap: 6, marginTop: 10 }}>
            {FINAI_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                disabled={!p.available || busy}
                onPress={() => p.onSend(suggestion)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: pressed ? tokens.primary : tokens.borderSubtle,
                  backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
                  opacity: !p.available || busy ? 0.5 : 1,
                })}
              >
                <Typography variant="small">{suggestion}</Typography>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => p.canLoadOlder && p.onLoadOlder?.()}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {item.attachments?.length ? <SentAttachments files={item.attachments} /> : null}
                {item.text ? (
                  <View
                    style={{
                      maxWidth: '82%',
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                      borderRadius: 16,
                      borderBottomRightRadius: 4,
                      backgroundColor: tokens.surfaceSubtle,
                    }}
                  >
                    <Typography selectable>{item.text}</Typography>
                  </View>
                ) : null}
              </View>
            ) : (
              <Reply message={item} onDecide={p.onDecide} showSteps={p.showSteps !== false} />
            )
          }
        />
      )}

      {p.error ? (
        <Typography
          variant="caption"
          accessibilityRole="alert"
          style={{ color: tokens.destructive, paddingHorizontal: 16, paddingBottom: 6 }}
        >
          {p.error}
        </Typography>
      ) : null}

      <View
        style={{
          gap: 6,
          marginHorizontal: 12,
          marginTop: 6,
          marginBottom: (p.bottomInset ?? 0) + 10,
          padding: 6,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        {files.length ? (
          <View
            accessibilityLabel="Attached files"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 2 }}
          >
            {files.map((file) => (
              <FileChip
                key={file.key}
                name={file.name}
                kind={file.kind}
                detail={
                  file.status === 'error' ? (file.error ?? 'Failed') : formatFileSize(file.size)
                }
                tone={file.status === 'error' ? 'error' : 'normal'}
                leading={
                  file.status === 'uploading' ? (
                    <ThinkingOrb state="working" size={14} label={`Uploading ${file.name}`} />
                  ) : file.status === 'error' ? (
                    <WarningCircle size={16} color={tokens.destructive} />
                  ) : file.kind === 'image' && file.previewUrl ? (
                    <Image
                      source={{ uri: file.previewUrl }}
                      style={{ width: 20, height: 20, borderRadius: 5 }}
                    />
                  ) : undefined
                }
                {...(p.onRemoveAttachment
                  ? { onRemove: () => p.onRemoveAttachment?.(file.key) }
                  : {})}
              />
            ))}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 6,
            paddingLeft: p.onAttach ? 0 : 8,
          }}
        >
          {p.onAttach ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach files"
              disabled={!p.available}
              onPress={() => setAttachOpen(true)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? tokens.card : 'transparent',
              })}
            >
              <Paperclip size={20} color={tokens.foregroundMuted} />
            </Pressable>
          ) : null}
          <TextInput
            accessibilityLabel={`Message ${FINAI_NAME}`}
            value={p.draft}
            onChangeText={p.onDraftChange}
            editable={p.available}
            multiline
            maxLength={4000}
            placeholder={p.available ? `Message ${FINAI_NAME}` : 'FinAI is unavailable'}
            placeholderTextColor={tokens.foregroundSubtle}
            style={{
              flex: 1,
              minHeight: 34,
              maxHeight: 140,
              paddingTop: 8,
              paddingBottom: 8,
              color: tokens.foreground,
              fontFamily: 'SpaceGrotesk_400Regular',
              fontSize: 15,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!canSend}
            onPress={() => p.onSend()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? tokens.primary : tokens.controlDisabledBackground,
            }}
          >
            {busy ? (
              <ThinkingOrb state="working" size={20} />
            ) : (
              <ArrowUp
                size={18}
                weight="bold"
                color={canSend ? tokens.primaryForeground : tokens.controlDisabledForeground}
              />
            )}
          </Pressable>
        </View>
      </View>

      <Sheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach">
        <View style={{ gap: 4 }}>
          {(
            [
              {
                source: 'library',
                label: 'Photos',
                hint: 'Receipts, bills, screenshots',
                Icon: Images,
              },
              { source: 'camera', label: 'Camera', hint: 'Take a photo', Icon: Camera },
              {
                source: 'files',
                label: 'Files',
                hint: 'PDF, Excel (.xlsx), CSV, text',
                Icon: FileIcon,
              },
            ] as const
          ).map(({ source, label, hint, Icon }) => (
            <Pressable
              key={source}
              accessibilityRole="button"
              onPress={() => pick(source)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: pressed ? tokens.surfaceSubtle : 'transparent',
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Icon size={20} color={tokens.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label">{label}</Typography>
                <Typography variant="caption">{hint}</Typography>
              </View>
            </Pressable>
          ))}
          <Typography variant="caption" style={{ paddingHorizontal: 10, paddingTop: 4 }}>
            Up to 5 files, 10 MB each. Files are deleted after the time set in FinAI settings.
          </Typography>
        </View>
      </Sheet>

      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Your chats">
        <View style={{ gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setHistoryOpen(false);
              p.onSelect(null);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}
          >
            <Plus size={18} color={tokens.primary} />
            <Typography variant="label" style={{ color: tokens.primary }}>
              New chat
            </Typography>
          </Pressable>
          {p.conversations.length === 0 ? (
            <Typography variant="caption">Your chats with {FINAI_NAME} appear here.</Typography>
          ) : (
            p.conversations.map((conversation) => (
              <View
                key={conversation.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 14,
                  backgroundColor:
                    conversation.id === p.activeId ? tokens.surfaceSubtle : 'transparent',
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => {
                    setHistoryOpen(false);
                    p.onSelect(conversation.id);
                  }}
                >
                  <ChatsCircle
                    size={20}
                    color={
                      conversation.id === p.activeId ? tokens.primary : tokens.foregroundSubtle
                    }
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="label"
                      numberOfLines={1}
                      style={conversation.unread ? { fontWeight: '700' } : undefined}
                    >
                      {conversation.title}
                    </Typography>
                    <Typography variant="caption" numberOfLines={1}>
                      {conversation.working ? 'Writing a reply…' : conversation.preview}
                    </Typography>
                  </View>
                  {conversation.working ? (
                    <ThinkingOrb state="working" size={16} label="Writing a reply" />
                  ) : conversation.unread ? (
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                        borderRadius: 999,
                        backgroundColor: tokens.primary,
                      }}
                    >
                      <Typography
                        variant="caption"
                        style={{ color: tokens.primaryForeground, fontSize: 10, fontWeight: '700' }}
                      >
                        New
                      </Typography>
                    </View>
                  ) : null}
                </Pressable>
                {p.onDelete ? (
                  <IconButton
                    label={`Delete ${conversation.title}`}
                    variant="ghost"
                    onPress={() => p.onDelete?.(conversation.id)}
                  >
                    <Trash size={18} color={tokens.foregroundMuted} />
                  </IconButton>
                ) : null}
              </View>
            ))
          )}
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
