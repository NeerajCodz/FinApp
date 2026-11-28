import React from 'react';
import { Linking, Share, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAction, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { KeyRound, Smartphone } from 'lucide-react-native';
import { Button, useTheme } from '@finapp/ui/native';
import { SettingsItem, useSettingsToneColor } from '@finapp/ui/finance';
import { toast } from '@/lib/toast';

type Setup = { secret: string; uri: string; qr: { size: number; path: string } };
type Panel =
  | { kind: 'setup'; setup: Setup }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'verify'; action: 'disable' | 'regenerate' }
  | null;

const errorText = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('INVALID_CODE')) return 'That code didn’t work. Use a fresh code.';
  if (message.includes('MFA_UNAVAILABLE')) return 'Authenticator apps aren’t available right now.';
  return 'Something went wrong. Try again.';
};

function Qr({ qr }: { qr: Setup['qr'] }) {
  const pad = 4;
  const box = qr.size + pad * 2;
  // theme-exempt: QR codes must be black on white to scan.
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 12, overflow: 'hidden' }}>
      <Svg width={168} height={168} viewBox={`${-pad} ${-pad} ${box} ${box}`}>
        <Rect x={-pad} y={-pad} width={box} height={box} fill="#ffffff" />
        <Path d={qr.path} fill="#000000" />
      </Svg>
    </View>
  );
}

/** Authenticator app and recovery-code rows for Settings → Security (mobile). */
export function MfaSettings({ live }: { live: boolean }) {
  const { tokens } = useTheme();
  const tone = useSettingsToneColor();
  const status = useQuery(api.mfa.status, live ? {} : 'skip');
  const start = useAction(api.mfa.startTotp);
  const confirm = useAction(api.mfa.confirmTotp);
  const disable = useAction(api.mfa.disableTotp);
  const regenerate = useAction(api.mfa.regenerateRecoveryCodes);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setPanel(null);
    setCode('');
    setError('');
  };
  const totp = status?.totp ?? false;
  const disabled = !live || !status || busy;
  const muted = { color: tokens.foregroundMuted, fontSize: 12, lineHeight: 17 } as const;

  const input = (placeholder: string) => (
    <TextInput
      value={code}
      onChangeText={(value) => setCode(value.trim())}
      placeholder={placeholder}
      placeholderTextColor={tokens.foregroundSubtle}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus
      maxLength={16}
      style={{
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
        color: tokens.foreground,
        fontSize: 17,
        letterSpacing: 2,
      }}
    />
  );
  const errorLine = error ? (
    <Text style={{ color: tokens.destructive, fontSize: 13 }}>{error}</Text>
  ) : null;
  const actions = (primary: React.ReactNode) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {primary}
      <Button size="sm" variant="ghost" onPress={close}>
        Cancel
      </Button>
    </View>
  );

  return (
    <>
      <SettingsItem
        icon={<Smartphone size={19} color={tone('violet')} />}
        tone="violet"
        title="Authenticator app"
        description={
          status?.available === false
            ? 'Not available yet'
            : totp
              ? 'On. Sign-in asks for a code from your app.'
              : 'Codes from Google Authenticator, 1Password, Authy…'
        }
        trailing={
          panel ? null : totp ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onPress={() => setPanel({ kind: 'verify', action: 'disable' })}
            >
              Turn off
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={disabled || status?.available === false}
              onPress={() =>
                void run(async () => {
                  setPanel({ kind: 'setup', setup: await start({}) });
                })
              }
            >
              Set up
            </Button>
          )
        }
      >
        {panel?.kind === 'setup' ? (
          <View style={{ gap: 10 }}>
            <Text style={muted}>
              Open the setup link in your authenticator app, or scan the code from another device.
              Then enter the six-digit code it shows.
            </Text>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void Linking.openURL(panel.setup.uri)}
            >
              Open in authenticator app
            </Button>
            <Qr qr={panel.setup.qr} />
            <Text
              selectable
              style={{ color: tokens.foreground, fontSize: 13, fontFamily: 'monospace' }}
            >
              {panel.setup.secret}
            </Text>
            {input('123456')}
            {errorLine}
            {actions(
              <Button
                size="sm"
                disabled={busy || !/^\d{6}$/.test(code)}
                onPress={() =>
                  void run(async () => {
                    const result = await confirm({ code });
                    setCode('');
                    toast.success('Authenticator app is on');
                    setPanel(
                      result.recoveryCodes ? { kind: 'codes', codes: result.recoveryCodes } : null,
                    );
                  })
                }
              >
                Turn on
              </Button>,
            )}
          </View>
        ) : panel?.kind === 'verify' && panel.action === 'disable' ? (
          <View style={{ gap: 10 }}>
            {input('App code or recovery code')}
            {errorLine}
            {actions(
              <Button
                size="sm"
                variant="destructive"
                disabled={busy || code.length < 6}
                onPress={() =>
                  void run(async () => {
                    await disable({ code });
                    toast.success('Authenticator app is off');
                    close();
                  })
                }
              >
                Turn off
              </Button>,
            )}
          </View>
        ) : null}
      </SettingsItem>

      <SettingsItem
        icon={<KeyRound size={19} color={tone('warning')} />}
        tone="warning"
        title="Recovery codes"
        description={
          !status || status.recoveryTotal === 0
            ? 'Single-use codes for when you can’t get a code'
            : `${status.recoveryRemaining} of ${status.recoveryTotal} left`
        }
        trailing={
          panel || !status || (status.recoveryTotal === 0 && !totp) ? null : (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onPress={() =>
                totp
                  ? setPanel({ kind: 'verify', action: 'regenerate' })
                  : void run(async () => {
                      const result = await regenerate({});
                      setPanel({ kind: 'codes', codes: result.recoveryCodes });
                    })
              }
            >
              New codes
            </Button>
          )
        }
      >
        {panel?.kind === 'codes' ? (
          <View style={{ gap: 10 }}>
            <Text style={muted}>
              Save these somewhere safe. Each signs you in once if you lose your phone. They won’t
              be shown again.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                padding: 12,
                borderRadius: 12,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              {panel.codes.map((value) => (
                <Text
                  key={value}
                  selectable
                  style={{
                    width: '46%',
                    color: tokens.foreground,
                    fontFamily: 'monospace',
                    fontSize: 14,
                  }}
                >
                  {value}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                size="sm"
                variant="outline"
                onPress={() =>
                  void Share.share({
                    message: `Finapp recovery codes (each works once)\n\n${panel.codes.join('\n')}`,
                  })
                }
              >
                Share or save
              </Button>
              <Button size="sm" onPress={close}>
                I’ve saved them
              </Button>
            </View>
          </View>
        ) : panel?.kind === 'verify' && panel.action === 'regenerate' ? (
          <View style={{ gap: 10 }}>
            <Text style={muted}>Your old codes stop working once you make new ones.</Text>
            {input('Code from your app')}
            {errorLine}
            {actions(
              <Button
                size="sm"
                disabled={busy || code.length < 6}
                onPress={() =>
                  void run(async () => {
                    const result = await regenerate({ code });
                    setCode('');
                    setPanel({ kind: 'codes', codes: result.recoveryCodes });
                  })
                }
              >
                Make new codes
              </Button>,
            )}
          </View>
        ) : null}
      </SettingsItem>
    </>
  );
}
