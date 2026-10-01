import React, { useEffect, useRef } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Typography, useTheme } from '@finapp/ui/native';
import { ImageSquare, PaperPlaneTilt } from 'phosphor-react-native';
import { Money } from './Money';
import { GroupAvatar, GroupHeading, GroupMetadataSummary, GroupPanel, GroupTile, type GroupMetadata } from './GroupPrimitives';

export type GroupChatItem = {
  id: string; kind: 'message' | 'expense' | 'settlement'; date: string; accessibleLabel: string;
  sender?: string; senderAvatarUrl?: string | null; ownMessage?: boolean; text?: string;
  attachmentUrl?: string | null; title?: string; amount?: string; amountMinor?: bigint; currency?: string;
  icon?: string; color?: string; onPress?: () => void;
};
export type GroupChatScreenProps = {
  items: readonly GroupChatItem[]; loading: boolean; canSend: boolean; connected: boolean;
  draft: string; pending: boolean; error?: string; onDraftChange: (value: string) => void;
  onSend: () => void; onChooseBillImage: () => void; onBack?: () => void;
  group?: GroupMetadata & { name: string; currency: string; icon?: string; color?: string };
  members?: readonly { id: string; name: string; username?: string; avatarUrl?: string }[];
  onOpenGroup?: () => void; onAddExpense?: () => void; onOpenSettings?: () => void; embedded?: boolean;
};

export function GroupChatScreen(p: GroupChatScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const timelineRef = useRef<ScrollView>(null);
  useEffect(() => { if (p.canSend && p.items.length) timelineRef.current?.scrollToEnd({ animated: true }); }, [p.canSend, p.items.length]);
  const media = p.items.filter(item => item.attachmentUrl);
  const content = <>
    {p.embedded ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="heading">Recent messages</Typography>{p.onBack && <Button size="sm" variant="outline" onPress={p.onBack}>Open chat</Button>}</View> : <GroupHeading title={p.group?.name ?? 'Group chat'} subtitle="Chat and share receipts with your group." onBack={p.onBack} />}
    {!p.embedded && p.group && <GroupPanel>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><GroupTile icon={p.group.icon} color={p.group.color} size={68} /><View style={{ flex: 1, gap: 4 }}><Typography variant="heading">{p.group.name}</Typography><Typography variant="caption">{p.group.currency} · Shared expenses</Typography><View style={{ flexDirection: 'row' }}>{p.members?.slice(0, 5).map((member, index) => <View key={member.id} style={{ marginLeft: index ? -6 : 0 }}><GroupAvatar name={member.name} avatarUrl={member.avatarUrl} size={26} /></View>)}</View></View></View>
      <GroupMetadataSummary group={p.group} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{p.onOpenGroup && <Button size="sm" variant="outline" onPress={p.onOpenGroup}>View group</Button>}{p.onAddExpense && <Button size="sm" onPress={p.onAddExpense}>+ Add expense</Button>}</View>
    </GroupPanel>}
    <GroupPanel style={{ padding: 10, gap: 10 }}>
      <ScrollView ref={timelineRef} nestedScrollEnabled keyboardShouldPersistTaps="handled" accessibilityRole="list" accessibilityLabel="Group messages" accessibilityLiveRegion="polite" style={{ minHeight: p.embedded ? 160 : 300, maxHeight: p.embedded ? 340 : 520 }} contentContainerStyle={{ padding: 4, gap: 16, flexGrow: 1 }}>
        {p.loading && <Typography variant="small">Loading saved messages…</Typography>}
        {p.items.map(item => <View key={item.id} accessibilityLabel={item.accessibleLabel} style={{ flexDirection: item.ownMessage ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
          <GroupAvatar name={item.ownMessage ? 'You' : item.sender ?? (item.kind === 'message' ? 'Member' : 'Group')} avatarUrl={item.senderAvatarUrl} size={32} />
          <View style={{ flex: 1, gap: 5, alignItems: item.ownMessage ? 'flex-end' : 'flex-start' }}><Typography variant="caption">{item.ownMessage ? 'You' : item.sender ?? 'Group'} · {item.date}</Typography>
            {item.kind === 'message' ? <View style={{ maxWidth: '100%', gap: 7, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: item.ownMessage ? tokens.primary : tokens.borderSubtle, backgroundColor: item.ownMessage ? tokens.secondary : tokens.surfaceRaised }}>
              {!!item.text && <Typography variant="body">{item.text}</Typography>}
              {item.attachmentUrl && <Image source={{ uri: item.attachmentUrl }} accessibilityLabel={`Bill shared by ${item.ownMessage ? 'you' : item.sender ?? 'a member'}`} resizeMode="contain" style={{ width: 210, maxWidth: '100%', height: 170, borderRadius: 6 }} />}
              {!item.text && !item.attachmentUrl && <Typography variant="caption">Bill image is no longer available.</Typography>}
            </View> : <Pressable accessibilityRole={item.onPress ? 'button' : undefined} disabled={!item.onPress} onPress={item.onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, width: '100%', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceRaised, flexDirection: 'row', alignItems: 'center' })}><GroupTile icon={item.icon ?? (item.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight')} color={item.color ?? (item.kind === 'expense' ? tokens.warning : tokens.income)} size={42} /><View style={{ flex: 1, gap: 3 }}><Typography variant="caption">{item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'}</Typography><Typography variant="label">{item.title}</Typography>{item.amountMinor !== undefined ? <Money amountMinor={item.amountMinor} currency={item.currency ?? p.group?.currency ?? ''} size="body" /> : <Typography variant="heading">{item.amount ?? 'Amount unavailable'}</Typography>}</View>{item.onPress && <Typography>›</Typography>}</Pressable>}
          </View>
        </View>)}
        {!p.loading && !p.items.length && <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 24, gap: 8 }}><GroupTile icon="phosphor:ChatCircle" size={42} /><Typography variant="heading">Start the conversation</Typography><Typography variant="caption">Share a note or a bill with the group.</Typography></View>}
      </ScrollView>
      {p.canSend ? <><View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 10 }}><IconButton label="Attach bill image" variant="ghost" disabled={p.pending} onPress={p.onChooseBillImage}><ImageSquare size={23} color={tokens.foreground} weight="fill" /></IconButton><Input accessibilityLabel="Group message" style={{ flex: 1 }} value={p.draft} onChangeText={p.onDraftChange} multiline maxLength={4000} placeholder={p.group ? `Message ${p.group.name}…` : 'Write a message…'} editable={!p.pending} /><IconButton variant="primary" label={p.pending ? 'Sending message' : 'Send message'} disabled={p.pending || !p.draft.trim()} onPress={p.onSend}><PaperPlaneTilt size={22} color={tokens.primaryForeground} weight="fill" /></IconButton></View><Typography variant="caption" accessibilityLiveRegion="polite">{p.pending ? 'Sending to the group…' : `${p.draft.length}/4,000 · Online sending only`}</Typography></> : <View style={{ gap: 5, borderTopWidth: 1, borderColor: tokens.borderSubtle, paddingTop: 12 }}><Typography variant="label">{p.connected ? 'Chat is not synced yet' : 'Group chat is offline'}</Typography><Typography variant="caption">{p.connected ? 'Sync the saved group to connect chat and bill sharing.' : 'Connect to load messages or send notes and bill images. Your ledger remains available offline.'}</Typography></View>}
      {!!p.error && <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{p.error}</Typography>}
    </GroupPanel>
    {!p.embedded && <>
      <GroupPanel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="heading">Group info</Typography>{p.onOpenSettings && <Button size="sm" variant="outline" onPress={p.onOpenSettings}>Edit</Button>}</View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><GroupTile icon={p.group?.icon} color={p.group?.color} size={56} /><View style={{ flex: 1, gap: 4 }}><Typography variant="heading">{p.group?.name ?? 'Group details unavailable'}</Typography><Typography variant="caption">{p.group?.currency ?? 'Currency unavailable'}</Typography></View></View>
        {p.group && <GroupMetadataSummary group={p.group} />}
        <Typography variant="caption">Messages and bill images save online. They are not queued for offline sending.</Typography>
      </GroupPanel>
      <GroupPanel><Typography variant="heading">Members ({p.members?.length ?? 0})</Typography>{p.members?.length ? p.members.map(member => <View key={member.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 }}><GroupAvatar name={member.name} avatarUrl={member.avatarUrl} /><View style={{ flex: 1 }}><Typography variant="label">{member.name}</Typography>{member.username && <Typography variant="caption">@{member.username.replace(/^@+/, '')}</Typography>}</View></View>) : <Typography variant="caption">Member details are not available yet.</Typography>}</GroupPanel>
      <GroupPanel><Typography variant="heading">Group balances</Typography><Typography variant="small">Open the group to view complete member balances and record a settlement. Chat does not provide live balance totals.</Typography>{p.onOpenGroup && <Button variant="outline" onPress={p.onOpenGroup}>View group balances</Button>}</GroupPanel>
      <GroupPanel><Typography variant="heading">Shared media & receipts</Typography>{media.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{media.map(item => <Image key={item.id} source={{ uri: item.attachmentUrl! }} accessibilityLabel={`Receipt shared by ${item.sender ?? 'a member'}`} resizeMode="cover" style={{ width: 72, height: 88, borderRadius: 6 }} />)}</View> : <Typography variant="small">No shared images in the loaded conversation.</Typography>}</GroupPanel>
    </>}
  </>;
  if (p.embedded) return <View style={{ gap: 12 }}>{content}</View>;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: tokens.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20, gap: 16 }}>{content}</ScrollView></KeyboardAvoidingView>;
}
