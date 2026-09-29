import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@finapp/ui/icons/native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';
import type { DeviceContact } from '@/lib/contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleRail } from '@/components/finance/PeopleRail';
import {
  Button,
  IconButton,
  Input,
  Label,
  Separator,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { EntityIconPicker } from '@finapp/ui/finance';

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').trim().toLowerCase();
}

export default function NewGroupScreen() {
  const [icon, setIcon] = useState<string>();
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [contactPhones, setContactPhones] = useState<string[]>([]);
  const [contactNames, setContactNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const suggestions = useQuery(
    api.users.queries.search,
    normalizeHandle(memberInput).length >= 2 ? { query: normalizeHandle(memberInput) } : 'skip',
  );

  function addMember(value = memberInput) {
    const handle = normalizeHandle(value);
    if (!/^[a-z0-9_]{3,32}$/.test(handle) || members.includes(handle)) return;
    setMembers((current) => [...current, handle]);
    setMemberInput('');
  }

  function addContact(contact: DeviceContact) {
    if (contactPhones.includes(contact.phone)) return;
    setContactPhones((current) => [...current, contact.phone]);
    setContactNames((current) => [...current, contact.name]);
  }

  async function save() {
    if (!userId || saving) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Enter a group name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const groupId = await commitLocalWrite(
        userId,
        'group',
        'group.create',
        {
          ...(icon ? { icon } : {}),
          name: cleanName,
          currency: 'INR',
          participantUsernames: members,
          contactPhones,
          contactNames,
        },
        {
          name: cleanName,
          currency: 'INR',
          memberUsernames: members,
          ...(icon ? { icon } : {}),
          memberPhones: contactPhones,
        },
      );
      router.replace(`/group/${groupId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <View style={{ gap: 2 }}>
            <Typography variant="caption" style={{ color: tokens.primary }}>
              SHARED FINANCES
            </Typography>
            <Typography variant="heading">New group</Typography>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Typography variant="title">A place for shared plans.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 310, lineHeight: 21 }}>
            Add a name and icon. Invite people now or add them later from group settings. Changes
            save on this device first.
          </Text>
        </View>

        <View
          style={{
            padding: 16,
            gap: 12,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <View>
            <Label>Group name</Label>
            <Input
              accessibilityLabel="Group name"
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Goa Trip"
              maxLength={80}
              returnKeyType="done"
            />
          </View>
          <EntityIconPicker
            mode="either"
            value={icon}
            onChange={setIcon}
            label="Group icon"
            compact
            allowClear
          />
        </View>

        <PeopleRail title="From your contacts" onSelect={addContact} />

        <View style={{ gap: 10 }}>
          <Label>People · optional</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Input
              accessibilityLabel="Add member username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@username"
              value={memberInput}
              onChangeText={setMemberInput}
              onSubmitEditing={() => addMember()}
              style={{ flex: 1 }}
            />
            <Button size="icon" variant="outline" onPress={() => addMember()}>
              <Check size={18} color={tokens.foreground} />
            </Button>
          </View>
          {(members.length > 0 || contactNames.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {members.map((member) => (
                <Pressable
                  key={member}
                  onPress={() => setMembers((current) => current.filter((item) => item !== member))}
                >
                  <Typography variant="small" style={{ color: tokens.primary }}>
                    @{member} ×
                  </Typography>
                </Pressable>
              ))}
              {contactNames.map((contact, index) => (
                <Pressable
                  key={`${contact}-${index}`}
                  onPress={() => {
                    setContactNames((current) => current.filter((_, item) => item !== index));
                    setContactPhones((current) => current.filter((_, item) => item !== index));
                  }}
                >
                  <Typography variant="small" style={{ color: tokens.foreground }}>
                    ⌕ {contact} ×
                  </Typography>
                </Pressable>
              ))}
            </View>
          )}
          {suggestions && suggestions.length > 0 && (
            <View style={{ gap: 4, marginTop: 4 }}>
              <Typography variant="caption">People you can add</Typography>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  onPress={() => addMember(suggestion.username ?? '')}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Typography variant="small">
                    {suggestion.displayName} · @{suggestion.username}
                  </Typography>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        {!!error && (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {error}
          </Typography>
        )}
        <Separator />
        <Button size="lg" disabled={saving || !name.trim()} onPress={save}>
          {saving ? 'Saving locally…' : 'Create group'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
