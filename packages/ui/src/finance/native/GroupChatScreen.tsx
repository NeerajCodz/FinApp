import React, { useEffect, useRef } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Money } from './Money';
import { Button, Card, Input, SectionHeader, Typography, useTheme } from '@finapp/ui/native';

export type GroupChatItem = {
  id: string;
  kind: 'message' | 'expense' | 'settlement';
  date: string;
  accessibleLabel: string;
  sender?: string;
  ownMessage?: boolean;
  text?: string;
  attachmentUrl?: string | null;
  title?: string;
  amount?: string;
  amountMinor?: bigint;
  currency?: string;
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
  onBack?: () => void;
};

export function GroupChatScreen({
  items,
  loading,
  canSend,
  connected,
  draft,
  pending,
  error,
  onDraftChange,
  onSend,
  onChooseBillImage,
  onBack,
}: GroupChatScreenProps) {
  const { tokens } = useTheme();
  const timelineRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (canSend && items.length) timelineRef.current?.scrollToEnd({ animated: true });
  }, [canSend, items.length]);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionHeader title="Group chat" />
        {onBack && (
          <Button size="sm" variant="outline" onPress={onBack}>
            Back to group
          </Button>
        )}
      </View>
      <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
        Messages and bill images are saved to this group when online. They are not queued for
        offline sending.
      </Typography>
      {canSend ? (
        <>
          <ScrollView
            ref={timelineRef}
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
            {loading && (
              <Typography variant="small" accessibilityLiveRegion="polite">
                Loading saved messages…
              </Typography>
            )}
            {items.map((item) =>
              item.kind === 'message' ? (
                <View
                  key={item.id}
                  accessibilityRole="text"
                  accessibilityLabel={item.accessibleLabel}
                  style={{
                    alignSelf: item.ownMessage ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 13,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    borderBottomLeftRadius: item.ownMessage ? 16 : 5,
                    borderBottomRightRadius: item.ownMessage ? 5 : 16,
                    backgroundColor: item.ownMessage ? tokens.secondary : tokens.background,
                  }}
                >
                  <Typography variant="caption">{item.ownMessage ? 'You' : item.sender}</Typography>
                  {item.attachmentUrl ? (
                    <Image
                      source={{ uri: item.attachmentUrl }}
                      accessibilityLabel={`Bill shared by ${item.ownMessage ? 'you' : item.sender}`}
                      resizeMode="contain"
                      style={{ width: 220, height: 160, borderRadius: 10 }}
                    />
                  ) : item.text ? (
                    <Typography variant="body">{item.text}</Typography>
                  ) : (
                    <Typography variant="caption">Bill image is no longer available.</Typography>
                  )}
                  <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                    {item.date}
                  </Typography>
                </View>
              ) : (
                <Card
                  key={item.id}
                  variant="subtle"
                  style={{
                    alignSelf: 'center',
                    width: '100%',
                    gap: 5,
                    padding: 14,
                    borderLeftWidth: 3,
                    borderLeftColor: item.kind === 'expense' ? tokens.primary : tokens.income,
                  }}
                >
                  <Typography variant="caption">
                    {item.kind === 'expense' ? 'Shared expense · Split' : 'Settlement'}
                  </Typography>
                  <Typography variant="bodyLarge">{item.title}</Typography>
                  {item.amountMinor !== undefined ? (
                    <Money
                      amountMinor={item.amountMinor}
                      currency={item.currency ?? ''}
                      size="body"
                    />
                  ) : (
                    <Typography variant="heading">{item.amount}</Typography>
                  )}
                  <Typography variant="caption">{item.date}</Typography>
                </Card>
              ),
            )}
            {!loading && items.length === 0 && (
              <View style={{ alignSelf: 'center', paddingVertical: 18, alignItems: 'center' }}>
                <Typography variant="bodyLarge">Start the conversation</Typography>
                <Typography variant="caption">
                  Share a note or attach a bill for the group.
                </Typography>
              </View>
            )}
          </ScrollView>
          <Card
            variant="subtle"
            style={{
              gap: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <Input
              accessibilityLabel="Group message"
              value={draft}
              onChangeText={onDraftChange}
              multiline
              maxLength={4_000}
              placeholder="Write a message…"
              editable={!pending}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Button variant="outline" disabled={pending} onPress={onChooseBillImage}>
                Attach bill image
              </Button>
              <Button disabled={pending || !draft.trim()} onPress={onSend}>
                {pending ? 'Sending…' : 'Send message'}
              </Button>
            </View>
            <Typography variant="caption" accessibilityLiveRegion="polite">
              {pending ? 'Sending to the group…' : `${draft.length}/4,000 characters`}
            </Typography>
          </Card>
        </>
      ) : (
        <Card
          variant="subtle"
          style={{
            padding: 16,
            gap: 5,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <Typography variant="bodyLarge">
            {connected ? 'Chat is not synced yet' : 'Group chat is offline'}
          </Typography>
          <Typography variant="caption">
            {connected
              ? 'This saved group has no connected cloud ID. Sync the group before using server chat or sharing bill images.'
              : 'Connect to load saved messages or send a message and bill image. Group ledger data remains available offline.'}
          </Typography>
        </Card>
      )}
      {!!error && (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Typography>
      )}
    </View>
  );
}
