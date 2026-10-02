'use client';
import React from 'react';
import { Button, Typography } from '@finapp/ui/web';
import { useTheme } from '@finapp/ui/web';

export type IncomingInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  currency: string;
  inviter: { displayName: string; username?: string };
  createdAt: number;
};
export type InvitationResponse = (id: string, response: 'accept' | 'decline') => Promise<void>;
export function InvitationInbox({
  invitations,
  loading,
  error,
  onRespond,
  open,
  onClose,
}: {
  invitations?: readonly IncomingInvitation[];
  loading: boolean;
  error?: string;
  onRespond: InvitationResponse;
  open: boolean;
  onClose: () => void;
}) {
  const { tokens } = useTheme();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  if (!open) return null;
  const respond = async (invite: IncomingInvitation, response: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(invite.id);
    setActionError('');
    try {
      await onRespond(invite.id, response);
      setResult(
        `${invite.groupName}: invitation ${response === 'accept' ? 'accepted' : 'declined'}.`,
      );
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Could not respond to this invitation.',
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,.45)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="invitations-title"
        style={{
          width: 'min(100%, 480px)',
          maxHeight: '80vh',
          overflow: 'auto',
          borderRadius: 18,
          padding: 22,
          background: tokens.surfaceRaised,
          color: tokens.foreground,
          display: 'grid',
          gap: 14,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography id="invitations-title" variant="title">
            Group invitations
          </Typography>
          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
        </header>
        {result && (
          <p role="status" aria-live="polite">
            {result}
          </p>
        )}
        {actionError && <p role="alert">{actionError}</p>}
        {loading ? (
          <p role="status">Loading invitations…</p>
        ) : error ? (
          <p role="alert">Invitations unavailable: {error}</p>
        ) : !invitations?.length ? (
          <p>No pending group invitations.</p>
        ) : (
          invitations.map((invite) => (
            <article
              key={invite.id}
              style={{
                border: `1px solid ${tokens.borderSubtle}`,
                borderRadius: 12,
                padding: 14,
                display: 'grid',
                gap: 8,
              }}
            >
              <strong>
                {invite.groupName} · {invite.currency}
              </strong>
              <span>
                Invited by {invite.inviter.displayName}
                {invite.inviter.username ? ` (@${invite.inviter.username})` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button disabled={busy !== null} onPress={() => void respond(invite, 'accept')}>
                  {busy === invite.id ? 'Working…' : 'Accept'}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onPress={() => void respond(invite, 'decline')}
                >
                  Decline
                </Button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
export function InvitationNotificationActions({
  invitation,
  onRespond,
}: {
  invitation?: IncomingInvitation;
  onRespond: InvitationResponse;
}) {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState('');
  const [error, setError] = React.useState('');
  if (!invitation)
    return result ? (
      <p role="status" aria-live="polite">
        {result}
      </p>
    ) : null;
  const respond = async (response: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRespond(invitation.id, response);
      setResult(response === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not respond to invitation.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      aria-label={`Invitation actions for ${invitation.groupName}`}
      style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 12 }}
    >
      <Button disabled={busy} onPress={() => void respond('accept')}>
        {busy ? 'Working…' : 'Accept invitation'}
      </Button>
      <Button variant="outline" disabled={busy} onPress={() => void respond('decline')}>
        Decline
      </Button>
      {result && (
        <span role="status" aria-live="polite">
          {result}
        </span>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
