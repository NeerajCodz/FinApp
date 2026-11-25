import React from 'react';
import { Alert, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { AI_PROVIDER_IDS, AI_PROVIDERS, type AiProviderId } from '@convex/shared/aiProviders';
import { CheckCircle2, CircleAlert, KeyRound, Sparkles } from 'lucide-react-native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { Text, useTheme } from '@finapp/ui/native';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const back = () => (router.canGoBack() ? router.back() : router.navigate('/settings/ai' as never));
const errorCopy: Record<string, string> = {
  AI_KEY_INVALID: 'The provider rejected this key.',
  INVALID_KEY: 'Paste the whole key, without spaces.',
  INVALID_MODEL: 'Enter a model id.',
  INVALID_BASE_URL: 'Enter an HTTPS base URL.',
  TOO_MANY_KEYS: 'You can save up to 10 keys.',
  AI_KEYS_NOT_CONFIGURED: 'Key storage isn’t set up on this server yet.',
};
const messageFor = (cause: unknown) => {
  const raw = cause instanceof Error ? cause.message : '';
  const code = Object.keys(errorCopy).find((key) => raw.includes(key));
  return code ? errorCopy[code]! : 'Couldn’t save the key. Try again.';
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: tokens.foregroundMuted, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.foregroundSubtle}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        style={{
          height: 46,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceSubtle,
          color: tokens.foreground,
          fontSize: 15,
        }}
      />
    </View>
  );
}

export default function ApiKeysScreen() {
  const { userId, isConnected } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const { tokens } = useTheme();
  const tone = useSettingsToneColor();
  const data = useQuery(api.ai.keys.list, live ? {} : 'skip');
  const addKey = useAction(api.ai.keys.add);
  const testKey = useAction(api.ai.keys.test);
  const setActive = useMutation(api.ai.keys.setActive);
  const removeKey = useMutation(api.ai.keys.remove);
  const [provider, setProvider] = React.useState<AiProviderId>('openai');
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState(AI_PROVIDERS.openai.models[0] ?? '');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const info = AI_PROVIDERS[provider];
  const keys = data?.keys ?? [];
  const activeKey = keys.find((key) => key.active);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await addKey({
        provider,
        apiKey,
        model,
        ...(baseUrl.trim() ? { baseUrl } : {}),
        makeActive: true,
      });
      setApiKey('');
      toast.success(
        result.status === 'ok' ? 'Key saved. FinAI now uses it.' : 'Key saved (not checked).',
      );
    } catch (cause) {
      toast.error(messageFor(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen
      title="API keys"
      subtitle="Run FinAI on your own provider account"
      onBack={back}
    >
      <SettingsHero
        icon={<Sparkles size={22} color={tokens.primary} />}
        title={activeKey ? `Using ${activeKey.label}` : 'Using Finapp’s built-in model'}
        description="Keys are encrypted on the server and never shown again. Your provider bills usage."
        action={
          activeKey ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void setActive({ keyId: null })}
              style={{
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: tokens.foreground, fontWeight: '600', fontSize: 13 }}>
                Use built-in
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <SettingsGroup title="Your keys">
        {data === undefined ? (
          <SettingsLink title={live ? 'Loading…' : 'Connect to manage keys'} />
        ) : keys.length ? (
          keys.map((key) => (
            <SettingsLink
              key={key.id}
              icon={
                key.status === 'ok' ? (
                  <CheckCircle2 size={19} color={tone('positive')} />
                ) : key.status === 'invalid' ? (
                  <CircleAlert size={19} color={tone('danger')} />
                ) : (
                  <KeyRound size={19} color={tone('warning')} />
                )
              }
              tone={
                key.status === 'ok' ? 'positive' : key.status === 'invalid' ? 'danger' : 'warning'
              }
              title={key.label}
              description={`${AI_PROVIDERS[key.provider]?.label ?? key.provider} · ${key.keyHint}${key.status === 'invalid' ? ' · Rejected' : ''}`}
              value={key.active ? 'Active' : undefined}
              onPress={() =>
                Alert.alert(key.label, `${key.model} · ${key.keyHint}`, [
                  ...(!key.active
                    ? [{ text: 'Use this key', onPress: () => void setActive({ keyId: key.id }) }]
                    : []),
                  {
                    text: 'Check key',
                    onPress: async () => {
                      const status = await testKey({ keyId: key.id as Id<'aiProviderKeys'> });
                      toast.success(
                        status === 'ok'
                          ? 'Key works'
                          : status === 'invalid'
                            ? 'Key was rejected'
                            : 'Couldn’t reach the provider',
                      );
                    },
                  },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => void removeKey({ keyId: key.id }),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            />
          ))
        ) : (
          <SettingsLink title="No keys yet" description="Add one below." />
        )}
      </SettingsGroup>

      <SettingsGroup title="Add a key">
        <View style={{ padding: 12, gap: 14 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {AI_PROVIDER_IDS.map((id) => {
              const active = provider === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    setProvider(id);
                    setModel(AI_PROVIDERS[id].models[0] ?? '');
                    setBaseUrl('');
                  }}
                  style={{
                    height: 34,
                    paddingHorizontal: 12,
                    borderRadius: 17,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: active ? tokens.primary : tokens.borderSubtle,
                    backgroundColor: active ? `${tokens.primary}22` : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: active ? tokens.foreground : tokens.foregroundMuted,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {AI_PROVIDERS[id].label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Field
            label="API key"
            value={apiKey}
            onChange={setApiKey}
            secure
            placeholder={info.keyPrefix ? `${info.keyPrefix}…` : 'Paste your key'}
          />
          <Field label="Model" value={model} onChange={setModel} placeholder="Model id" />
          {info.models.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {info.models.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setModel(option)}
                  style={{
                    height: 30,
                    paddingHorizontal: 10,
                    borderRadius: 15,
                    justifyContent: 'center',
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {provider === 'custom' || provider === 'openrouter' ? (
            <Field
              label={provider === 'custom' ? 'Base URL' : 'Base URL (optional)'}
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder={info.baseUrl || 'https://api.example.com/v1'}
            />
          ) : null}
          {info.keyUrl ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(info.keyUrl)}>
              <Text style={{ color: tokens.primary, fontSize: 13 }}>
                Get a key at {new URL(info.keyUrl).hostname}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !live || !apiKey.trim() || !model.trim() || data?.vault === false}
            onPress={() => void submit()}
            style={{
              height: 46,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.primary,
              opacity: busy || !apiKey.trim() || !model.trim() ? 0.55 : 1,
            }}
          >
            <Text style={{ color: tokens.primaryForeground, fontWeight: '700' }}>
              {busy ? 'Checking key…' : 'Save and use'}
            </Text>
          </Pressable>
          {data?.vault === false ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
              Key storage isn’t configured on this server yet.
            </Text>
          ) : null}
        </View>
      </SettingsGroup>
    </SettingsScreen>
  );
}
