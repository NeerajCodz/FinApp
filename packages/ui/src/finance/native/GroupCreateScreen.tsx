import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, Check } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { EntityColorPicker } from './EntityColorPicker';
import { EntityIconPicker } from './EntityIconPicker';
import { PeopleRail } from './PeopleRail';

export type GroupCreateSuggestion = { id: string; username?: string; displayName?: string };
export type GroupCreateScreenProps = {
  name: string;
  onBack: () => void;
  onNameChange: (value: string) => void;
  currency: string;
  currencies: readonly string[];
  onCurrencyChange: (value: string) => void;
  icon?: string;
  onIconChange: (value?: string) => void;
  color?: string;
  onColorChange: (value?: string) => void;
  contacts: readonly { name: string; phone: string }[];
  onChooseContact: () => void;
  phoneVerified: boolean;
  contactBusy: boolean;
  onRemoveContact: (index: number) => void;
  usernameInput: string;
  onUsernameInputChange: (value: string) => void;
  usernames: readonly string[];
  suggestions?: readonly GroupCreateSuggestion[];
  onAddUsername: (username?: string) => void;
  onRemoveUsername: (username: string) => void;
  error?: string;
  saving: boolean;
  onSubmit: () => void;
};

export function GroupCreateScreen({
  onBack,
  name,
  onNameChange,
  currency,
  currencies,
  onCurrencyChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  contacts,
  onChooseContact,
  phoneVerified,
  contactBusy,
  onRemoveContact,
  usernameInput,
  onUsernameInputChange,
  usernames,
  suggestions,
  onAddUsername,
  onRemoveUsername,
  error,
  saving,
  onSubmit,
}: GroupCreateScreenProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
          paddingBottom: insets.bottom + 32,
          gap: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back to groups" variant="ghost" onPress={onBack}>
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
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 340, lineHeight: 21 }}>
            Choose a name, solid icon, and color. Invite people now or add them later from settings.
            Changes save on this device first.
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
              onChangeText={onNameChange}
              placeholder="Name your group"
              maxLength={80}
              returnKeyType="done"
            />
          </View>
          <View>
            <Label>Currency</Label>
            <Input
              accessibilityLabel="Group currency"
              value={currency}
              onChangeText={onCurrencyChange}
              placeholder="Choose a currency code"
              autoCapitalize="characters"
              maxLength={3}
              returnKeyType="done"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {currencies.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={currency === item ? 'secondary' : 'outline'}
                  onPress={() => onCurrencyChange(item)}
                >
                  {item}
                </Button>
              ))}
            </View>
          </View>
          <EntityIconPicker
            mode="phosphor"
            value={icon}
            onChange={onIconChange}
            label="Group icon"
            compact
          />
          <EntityColorPicker value={color} onChange={onColorChange} label="Group color" />
        </View>
        <PeopleRail
          title="From your contacts"
          phoneVerified={phoneVerified}
          loading={contactBusy}
          onChoose={onChooseContact}
        />
        <View style={{ gap: 10 }}>
          <Label>People · optional</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Input
              accessibilityLabel="Add member username"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@username"
              value={usernameInput}
              onChangeText={onUsernameInputChange}
              onSubmitEditing={() => onAddUsername()}
              style={{ flex: 1 }}
            />
            <Button size="icon" variant="outline" onPress={() => onAddUsername()}>
              <Check size={18} color={tokens.foreground} />
            </Button>
          </View>
          {(usernames.length > 0 || contacts.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {usernames.map((username) => (
                <Pressable key={username} onPress={() => onRemoveUsername(username)}>
                  <Typography variant="small" style={{ color: tokens.primary }}>
                    @{username} ×
                  </Typography>
                </Pressable>
              ))}
              {contacts.map((contact, index) => (
                <Pressable key={`${contact.phone}-${index}`} onPress={() => onRemoveContact(index)}>
                  <Typography variant="small" style={{ color: tokens.foreground }}>
                    {contact.name} ×
                  </Typography>
                </Pressable>
              ))}
            </View>
          )}
          {!!suggestions?.length && (
            <View style={{ gap: 4, marginTop: 4 }}>
              <Typography variant="caption">People you can add</Typography>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  onPress={() => onAddUsername(suggestion.username ?? '')}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Typography variant="small">
                    {suggestion.displayName ?? 'Finapp user'} · @{suggestion.username}
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
        <Button
          size="lg"
          disabled={saving || !name.trim() || !currency || !icon || !color}
          onPress={onSubmit}
        >
          {saving ? 'Saving locally…' : 'Create group'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
