import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';

export type IncomingInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  currency: string;
  inviter: { displayName: string; username?: string };
  createdAt: number;
};
export type InvitationResponse = (id: string, response: 'accept' | 'decline') => Promise<void>;

type InvitationInboxProps = {
  invitations?: readonly IncomingInvitation[];
  loading: boolean;
  error?: string;
  onRespond: InvitationResponse;
  open: boolean;
  onClose: () => void;
};

export function InvitationInbox({
  invitations,
  loading,
  error,
  onRespond,
  open,
  onClose,
}: InvitationInboxProps) {
  const { tokens } = useTheme();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [result, setResult] = React.useState('');
  const [actionError, setActionError] = React.useState('');

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
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0008' }}
      >
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="none"
          accessibilityLabel="Group invitations"
          onPress={(event) => event.stopPropagation()}
          style={{
            maxHeight: '82%',
            borderRadius: 18,
            padding: 20,
            gap: 14,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="title">Group invitations</Typography>
            <Button variant="ghost" onPress={onClose}>
              Close
            </Button>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            {result ? <Typography accessibilityLiveRegion="polite">{result}</Typography> : null}
            {actionError ? (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                {actionError}
              </Typography>
            ) : null}
            {loading ? (
              <Typography accessibilityLiveRegion="polite">Loading invitations…</Typography>
            ) : error ? (
              <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
                Invitations unavailable: {error}
              </Typography>
            ) : !invitations?.length ? (
              <FinanceEmptyState
                kind="invitation"
                title="No pending invitations."
                description="New group invitations will appear here when someone invites you."
                compact
              />
            ) : (
              invitations.map((invite) => (
                <View
                  key={invite.id}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    borderRadius: 12,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <Typography variant="label">
                    {invite.groupName} · {invite.currency}
                  </Typography>
                  <Typography variant="small">
                    Invited by {invite.inviter.displayName}
                    {invite.inviter.username ? ` (@${invite.inviter.username})` : ''}
                  </Typography>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
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
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
    return result ? <Typography accessibilityLiveRegion="polite">{result}</Typography> : null;

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
    <View
      accessibilityLabel={`Invitation actions for ${invitation.groupName}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 12,
      }}
    >
      <Button disabled={busy} onPress={() => void respond('accept')}>
        {busy ? 'Working…' : 'Accept invitation'}
      </Button>
      <Button variant="outline" disabled={busy} onPress={() => void respond('decline')}>
        Decline
      </Button>
      {result ? <Typography accessibilityLiveRegion="polite">{result}</Typography> : null}
      {error ? (
        <Typography accessibilityRole="alert" style={{ color: '#d44' }}>
          {error}
        </Typography>
      ) : null}
    </View>
  );
}
