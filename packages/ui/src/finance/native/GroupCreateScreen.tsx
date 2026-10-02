import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Label, Typography, useTheme } from '@finapp/ui/native';
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import { PeopleRail } from './PeopleRail';
import { GroupAvatar, GroupHeading, GroupMetadataFields, GroupNote, GroupPanel, GroupTile, type GroupMetadataFieldsProps } from './GroupPrimitives';

export type GroupCreateSuggestion = { id: string; avatarId?: string; username?: string; displayName?: string };
export type GroupCreateScreenProps = GroupMetadataFieldsProps & {
  name: string; onBack: () => void; onNameChange: (value: string) => void;
  currency: string; currencies: readonly string[]; onCurrencyChange: (value: string) => void;
  icon?: string; onIconChange: (value?: string) => void; color?: string; onColorChange: (value?: string) => void;
  contacts: readonly { name: string; phone: string }[]; onChooseContact: () => void;
  phoneVerified: boolean; contactBusy: boolean; onRemoveContact: (index: number) => void;
  usernameInput: string; onUsernameInputChange: (value: string) => void; usernames: readonly string[];
  suggestions?: readonly GroupCreateSuggestion[]; onAddUsername: (username?: string) => void;
  onRemoveUsername: (username: string) => void; error?: string; saving: boolean; onSubmit: () => void;
};

export function GroupCreateScreen(p: GroupCreateScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const templates = [
    { name: 'Trip with friends', icon: 'phosphor:TreePalm', color: tokens.income, text: 'Travel, meals, and shared activities.' },
    { name: 'Flatmates', icon: 'phosphor:House', color: tokens.split, text: 'Rent, utilities, and household expenses.' },
    { name: 'Office group', icon: 'phosphor:Briefcase', color: tokens.warning, text: 'Team lunches and work-related expenses.' },
    { name: 'Event', icon: 'phosphor:CalendarBlank', color: tokens.expense, text: 'Parties, weddings, and special occasions.' },
    { name: 'Custom group', icon: 'phosphor:GearSix', color: tokens.primary, text: 'Start with your own name and appearance.' },
  ];
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: tokens.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, gap: 16 }}>
    <GroupHeading title="New group" subtitle="Create a shared group for expenses, chats, and settlements." onBack={p.onBack} />
    <GroupPanel><Typography variant="heading">Group details</Typography><Typography variant="caption">Set up the basics for your group.</Typography><View style={{ alignSelf: 'center', paddingVertical: 8 }}><GroupTile icon={p.icon} color={p.color} size={112} /></View>
      <Label>Group name *</Label><Input accessibilityLabel="Group name" value={p.name} onChangeText={p.onNameChange} placeholder="e.g. Goa Trip, Flatmates, Office Lunch" maxLength={80} />
      <GroupMetadataFields {...p} disabled={p.saving} />
      <Label>Currency *</Label><Input accessibilityLabel="Group currency" value={p.currency} onChangeText={p.onCurrencyChange} autoCapitalize="characters" maxLength={3} placeholder="Currency code" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{p.currencies.map(currency => <Button key={currency} size="sm" variant={p.currency === currency ? 'secondary' : 'outline'} onPress={() => p.onCurrencyChange(currency)}>{currency}</Button>)}</View>
      <EntityIconPicker mode="phosphor" value={p.icon} onChange={p.onIconChange} label="Choose group icon" compact /><EntityColorPicker value={p.color} onChange={p.onColorChange} label="Group color" />
    </GroupPanel>
    <GroupPanel><Typography variant="heading">Invite members</Typography><Typography variant="caption">Add friends, family, or colleagues to your group.</Typography>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Input accessibilityLabel="Add member username" style={{ flex: 1 }} autoCapitalize="none" autoCorrect={false} placeholder="Search or add @username" value={p.usernameInput} onChangeText={p.onUsernameInputChange} onSubmitEditing={() => p.onAddUsername()} /><Button size="sm" variant="outline" onPress={() => p.onAddUsername()}>Add</Button></View>
      <PeopleRail title="Add from contacts" phoneVerified={p.phoneVerified} loading={p.contactBusy} onChoose={p.onChooseContact} />
      <Typography variant="label">Added members ({p.usernames.length + p.contacts.length})</Typography>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{p.usernames.map(username => <Pressable key={username} accessibilityRole="button" accessibilityLabel={`Remove ${username}`} onPress={() => p.onRemoveUsername(username)} style={{ padding: 8, gap: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: tokens.surfaceRaised }}><GroupAvatar name={username} size={26} /><Typography variant="small">@{username} ×</Typography></Pressable>)}{p.contacts.map((contact, index) => <Pressable key={`${contact.phone}-${index}`} accessibilityRole="button" accessibilityLabel={`Remove ${contact.name}`} onPress={() => p.onRemoveContact(index)} style={{ padding: 8, gap: 6, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: tokens.surfaceRaised }}><GroupAvatar name={contact.name} size={26} /><Typography variant="small">{contact.name} ×</Typography></Pressable>)}</View>
      {!p.usernames.length && !p.contacts.length && <Typography variant="caption">No invitations added. You can invite people later.</Typography>}
      {p.suggestions?.map(person => <Pressable key={person.id} accessibilityRole="button" disabled={!person.username} onPress={() => p.onAddUsername(person.username)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}><GroupAvatar name={person.displayName ?? person.username ?? 'Finapp user'} avatarId={person.avatarId} /><View style={{ flex: 1 }}><Typography variant="label">{person.displayName ?? 'Finapp user'}</Typography><Typography variant="caption">{person.username ? `@${person.username}` : 'Username unavailable'}</Typography></View><Typography variant="small">Add +</Typography></Pressable>)}
    </GroupPanel>
    <GroupPanel><Typography variant="heading">Admin & permissions</Typography><GroupNote title="Expense access" text="Members can add shared expenses. Splits are chosen for each expense." icon="phosphor:UsersThree" color={tokens.income} /><GroupNote title="Membership & settings" text="Owners and admins manage members, roles, and group appearance." icon="phosphor:ShieldCheck" color={tokens.split} /><GroupNote title="Chat & settlements" text="Chat and receipt sharing need a connected group. Settlements are recorded manually; no approval or scheduling settings are available." icon="phosphor:ChatCircle" color={tokens.warning} /></GroupPanel>
    <GroupPanel><Typography variant="heading">Tips for a great group</Typography><GroupNote title="Keep it clear and specific" text="Use a name and icon that everyone can recognize." icon="phosphor:PencilSimple" color={tokens.income} /><GroupNote title="Invite the right people" text="Invite only the people sharing these expenses. Contact invitations require a verified phone number." icon="phosphor:UsersThree" color={tokens.split} /><GroupNote title="Use flexible splits" text="Choose equal, exact amounts, percentages, or shares when adding an expense." icon="phosphor:ChartPie" color={tokens.warning} /></GroupPanel>
    <GroupPanel><Typography variant="heading">Quick start with a template</Typography><Typography variant="caption">Apply a name, description, icon, and color. No hidden settings change.</Typography>{templates.map(template => <Pressable key={template.name} accessibilityRole="button" disabled={p.saving} onPress={() => { p.onNameChange(template.name); p.onDescriptionChange?.(template.text); p.onIconChange(template.icon); p.onColorChange(template.color); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: 8, flexDirection: 'row', gap: 12, alignItems: 'center' })}><GroupTile icon={template.icon} color={template.color} size={42} /><View style={{ flex: 1, gap: 3 }}><Typography variant="label">{template.name}</Typography><Typography variant="caption">{template.text}</Typography></View><Typography>›</Typography></Pressable>)}</GroupPanel>
    {!!p.error && <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>{p.error}</Typography>}
    <Button disabled={p.saving || !p.name.trim() || !p.currency || !p.icon || !p.color} onPress={p.onSubmit}>{p.saving ? 'Saving locally…' : 'Create group'}</Button><Button variant="outline" disabled={p.saving} onPress={p.onBack}>Cancel</Button>
  </ScrollView></KeyboardAvoidingView>;
}
