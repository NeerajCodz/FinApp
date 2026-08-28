import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, Check, UsersThree } from '@/lib/icons';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { normalizeContactPhone, type DeviceContact } from '@/lib/contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleRail } from '@/components/finance/PeopleRail';
import { Button, IconButton, Input, Label, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').trim().toLowerCase();
}

export default function NewGroupScreen() {
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [contactPhones, setContactPhones] = useState<string[]>([]);
  const [contactNames, setContactNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const createGroup = useMutation(api.groups.mutations.create);
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
    if (!contact.phone) return;
    const phone = normalizeContactPhone(contact.phone);
    if (contactPhones.includes(phone)) return;
    setContactPhones((current) => [...current, phone]);
    setContactNames((current) => [...current, contact.name]);
  }

  async function save() {
    setError('');
    try {
      const groupId = await createGroup({
        name,
        currency: 'INR',
        memberUsernames: members,
        memberPhones: contactPhones,
      });
      router.replace(`/group/${groupId}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create group');
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
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading">New group</Typography>
        </View>

        <View style={{ gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UsersThree size={21} color={tokens.foreground} />
          </View>
          <Typography variant="title">Name the group.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
            Add people by @username or from your phone contacts. Unknown people receive a pending
            invite.
          </Text>
        </View>

        <View>
          <Label>Group name</Label>
          <Input
            accessibilityLabel="Group name"
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Goa Trip"
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

        {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        <Separator />
        <Button size="lg" disabled={!name.trim()} onPress={save}>
          Create group
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
