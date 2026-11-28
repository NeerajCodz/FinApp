'use client';

import * as React from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Copy, Download, KeyRound, Smartphone } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import { SettingsField, SettingsItem } from '@finapp/ui/finance';

type Setup = { secret: string; uri: string; qr: { size: number; path: string } };
type Panel =
  | { kind: 'setup'; setup: Setup }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'verify'; action: 'disable' | 'regenerate' }
  | null;

const errorText = (cause: unknown) => {
  const message = cause instanceof Error ? cause.message : '';
  if (message.includes('INVALID_CODE'))
    return 'That code didn’t work. Use a fresh code from your app.';
  if (message.includes('MFA_UNAVAILABLE')) return 'Authenticator apps aren’t available right now.';
  return 'Something went wrong. Try again.';
};

function Qr({ qr }: { qr: Setup['qr'] }) {
  const pad = 4;
  return (
    <svg
      role="img"
      aria-label="QR code for your authenticator app"
      viewBox={`${-pad} ${-pad} ${qr.size + pad * 2} ${qr.size + pad * 2}`}
      width={176}
      height={176}
      shapeRendering="crispEdges"
      style={{ borderRadius: 12, background: '#ffffff' /* theme-exempt: QR needs white */ }}
    >
      <rect x={-pad} y={-pad} width={qr.size + pad * 2} height={qr.size + pad * 2} fill="#ffffff" />
      <path d={qr.path} fill="#000000" /* theme-exempt: QR needs black */ />
    </svg>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const text = `Finapp recovery codes (each works once)\n\n${codes.join('\n')}\n`;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--finapp-foreground-muted)' }}>
        Save these somewhere safe. Each one signs you in once if you lose your phone. They won’t be
        shown again.
      </p>
      <ol
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px 16px',
          margin: 0,
          padding: 12,
          listStyle: 'none',
          borderRadius: 12,
          background: 'var(--finapp-surface-subtle)',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 14,
        }}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          size="sm"
          variant="outline"
          onPress={() =>
            void navigator.clipboard.writeText(text).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          <Copy size={15} aria-hidden /> {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'finapp-recovery-codes.txt';
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={15} aria-hidden /> Download
        </Button>
        <Button size="sm" onPress={onDone}>
          I’ve saved them
        </Button>
      </div>
    </div>
  );
}

/** Authenticator app and recovery-code rows for Settings → Security (web). */
export function MfaSettings({
  live,
  onMessage,
}: {
  live: boolean;
  onMessage: (text: string) => void;
}) {
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
  const codeField = (label: string) => (
    <SettingsField
      label={label}
      inputMode="text"
      autoComplete="one-time-code"
      autoFocus
      maxLength={16}
      value={code}
      onChange={(event) => setCode(event.target.value.trim())}
    />
  );
  const errorLine = error ? (
    <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--finapp-destructive)' }}>
      {error}
    </p>
  ) : null;

  return (
    <>
      <SettingsItem
        icon={<Smartphone size={19} />}
        tone="violet"
        title="Authenticator app"
        description={
          status?.available === false
            ? 'Not available on this server yet'
            : totp
              ? `On since ${new Date(status!.totpSince!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. Sign-in asks for a code from your app.`
              : 'Use Google Authenticator, 1Password, Authy or similar for sign-in codes'
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
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await confirm({ code });
                setCode('');
                onMessage('Authenticator app is on.');
                setPanel(
                  result.recoveryCodes ? { kind: 'codes', codes: result.recoveryCodes } : null,
                );
              });
            }}
          >
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                color: 'var(--finapp-foreground-muted)',
                display: 'grid',
                gap: 4,
              }}
            >
              <li>Scan this QR code with your authenticator app.</li>
              <li>
                Or enter the key by hand:{' '}
                <code style={{ fontSize: 13, color: 'var(--finapp-foreground)' }}>
                  {panel.setup.secret}
                </code>
              </li>
              <li>Enter the six-digit code the app shows.</li>
            </ol>
            <Qr qr={panel.setup.qr} />
            {codeField('Code from your app')}
            {errorLine}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" type="submit" disabled={busy || !/^\d{6}$/.test(code)}>
                {busy ? 'Checking…' : 'Turn on'}
              </Button>
              <Button size="sm" variant="ghost" onPress={close}>
                Cancel
              </Button>
            </div>
          </form>
        ) : panel?.kind === 'verify' && panel.action === 'disable' ? (
          <form
            style={{ display: 'grid', gap: 10, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await disable({ code });
                onMessage('Authenticator app is off.');
                close();
              });
            }}
          >
            {codeField('Code from your app, or a recovery code')}
            {errorLine}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                type="submit"
                variant="destructive"
                disabled={busy || code.length < 6}
              >
                Turn off
              </Button>
              <Button size="sm" variant="ghost" onPress={close}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </SettingsItem>

      <SettingsItem
        icon={<KeyRound size={19} />}
        tone="warning"
        title="Recovery codes"
        description={
          !status || status.recoveryTotal === 0
            ? 'Single-use codes for when you can’t get a code. Made when you set up an authenticator app.'
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
          <RecoveryCodes codes={panel.codes} onDone={close} />
        ) : panel?.kind === 'verify' && panel.action === 'regenerate' ? (
          <form
            style={{ display: 'grid', gap: 10, maxWidth: 320 }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await regenerate({ code });
                setCode('');
                setPanel({ kind: 'codes', codes: result.recoveryCodes });
              });
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: 'var(--finapp-foreground-muted)' }}>
              Your old codes stop working once you make new ones.
            </p>
            {codeField('Code from your app')}
            {errorLine}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" type="submit" disabled={busy || code.length < 6}>
                Make new codes
              </Button>
              <Button size="sm" variant="ghost" onPress={close}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </SettingsItem>
    </>
  );
}
