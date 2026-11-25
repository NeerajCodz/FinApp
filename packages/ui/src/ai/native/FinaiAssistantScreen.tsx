/**
 * The FinAI assistant on mobile: header with the Thinking Orb and a history sheet, an inverted
 * thread (user bubbles, streamed FinAI replies with orb progress and A2UI cards) and a composer
 * with suggestions. Data and actions come from the app through props.
 */
import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  ArrowUp,
  ChatsCircle,
  ClockCounterClockwise,
  NotePencil,
  Plus,
  Trash,
} from 'phosphor-react-native';
import { IconButton, ThinkingOrb, Typography, useTheme } from '@finapp/ui/native';
import { Sheet } from '../../native/overlays';
import {
  FINAI_NAME,
  FINAI_SUGGESTIONS,
  finaiErrorMessage,
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
};

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
  const canSend = p.available && !busy && !!p.draft.trim();
  const data = React.useMemo(() => [...p.messages].reverse(), [p.messages]);
  const empty = !p.loading && p.messages.length === 0;
  const activeTitle = p.conversations.find((row) => row.id === p.activeId)?.title;

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
        <IconButton label="Chat history" variant="ghost" onPress={() => setHistoryOpen(true)}>
          <ClockCounterClockwise size={21} color={tokens.foreground} />
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
              <View style={{ alignItems: 'flex-end' }}>
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
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginHorizontal: 12,
          marginTop: 6,
          marginBottom: (p.bottomInset ?? 0) + 10,
          paddingLeft: 14,
          paddingRight: 6,
          paddingVertical: 6,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
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
                    <Typography variant="label" numberOfLines={1}>
                      {conversation.title}
                    </Typography>
                    <Typography variant="caption" numberOfLines={1}>
                      {conversation.preview}
                    </Typography>
                  </View>
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
