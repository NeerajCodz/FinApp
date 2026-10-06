import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  SocialPersonRow,
  type IncomingInvitation,
  type SocialProfileSummary,
} from '@finapp/ui/finance';
import { Button, Sheet, Text, Typography, useTheme } from '@finapp/ui/native';

type RequestRow = { requestId: string; user: SocialProfileSummary; createdAt: number };
type Requests = { incoming: readonly RequestRow[]; outgoing: readonly RequestRow[] };

type RequestsSheetProps = {
  visible: boolean;
  onClose: () => void;
  requests?: Requests;
  invitations?: readonly IncomingInvitation[];
  requestsLoading: boolean;
  invitationsLoading: boolean;
  requestsError?: string;
  invitationsError?: string;
  onRespondToRequest: (id: string, response: 'accept' | 'decline') => Promise<void>;
  onCancelRequest: (id: string) => Promise<void>;
  onRespondToInvitation: (id: string, response: 'accept' | 'decline') => Promise<void>;
};

export function RequestsSheet({
  visible,
  onClose,
  requests,
  invitations,
  requestsLoading,
  invitationsLoading,
  requestsError,
  invitationsError,
  onRespondToRequest,
  onCancelRequest,
  onRespondToInvitation,
}: RequestsSheetProps) {
  const { tokens } = useTheme();
  const [tab, setTab] = useState<'requests' | 'invitations'>('requests');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That action could not be completed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Requests & invitations">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          size="sm"
          variant={tab === 'requests' ? 'primary' : 'outline'}
          accessibilityState={{ selected: tab === 'requests' }}
          onPress={() => setTab('requests')}
        >
          Requests
          {requests?.incoming.length ? ` ${requests.incoming.length}` : ''}
        </Button>
        <Button
          size="sm"
          variant={tab === 'invitations' ? 'primary' : 'outline'}
          accessibilityState={{ selected: tab === 'invitations' }}
          onPress={() => setTab('invitations')}
        >
          Invitations
          {invitations?.length ? ` ${invitations.length}` : ''}
        </Button>
      </View>
      <ScrollView
        style={{ maxHeight: 470 }}
        contentContainerStyle={{ gap: 14, paddingBottom: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {error}
          </Text>
        ) : null}
        {tab === 'requests' ? (
          <>
            <Typography variant="label">Friend requests</Typography>
            {requestsLoading ? (
              <Text accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted }}>
                Loading requests…
              </Text>
            ) : requestsError ? (
              <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
                {requestsError}
              </Text>
            ) : requests?.incoming.length ? (
              requests.incoming.map((request) => (
                <SocialPersonRow
                  key={request.requestId}
                  profile={request.user}
                  detail={`Requested ${new Date(request.createdAt).toLocaleDateString()}`}
                  compact
                  action={
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onPress={() =>
                          void run(`${request.requestId}:accept`, () =>
                            onRespondToRequest(request.requestId, 'accept'),
                          )
                        }
                      >
                        {busy === `${request.requestId}:accept` ? 'Accepting…' : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onPress={() =>
                          void run(`${request.requestId}:decline`, () =>
                            onRespondToRequest(request.requestId, 'decline'),
                          )
                        }
                      >
                        Decline
                      </Button>
                    </View>
                  }
                />
              ))
            ) : (
              <Text style={{ color: tokens.foregroundMuted }}>No pending friend requests.</Text>
            )}
            <Typography variant="label" style={{ marginTop: 4 }}>
              Sent requests
            </Typography>
            {requestsLoading ? (
              <Text accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted }}>
                Loading sent requests…
              </Text>
            ) : requestsError ? null : requests?.outgoing.length ? (
              requests.outgoing.map((request) => (
                <SocialPersonRow
                  key={request.requestId}
                  profile={request.user}
                  detail={`Sent ${new Date(request.createdAt).toLocaleDateString()}`}
                  compact
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onPress={() =>
                        void run(`${request.requestId}:cancel`, () =>
                          onCancelRequest(request.requestId),
                        )
                      }
                    >
                      {busy === `${request.requestId}:cancel` ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  }
                />
              ))
            ) : (
              <Text style={{ color: tokens.foregroundMuted }}>No sent requests.</Text>
            )}
          </>
        ) : invitationsLoading ? (
          <Text accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted }}>
            Loading group invitations…
          </Text>
        ) : invitationsError ? (
          <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {invitationsError}
          </Text>
        ) : invitations?.length ? (
          invitations.map((invitation) => (
            <View
              key={invitation.id}
              style={{
                gap: 9,
                borderWidth: 1,
                borderColor: tokens.borderSubtle,
                borderRadius: 14,
                padding: 13,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              <Typography variant="label">{invitation.groupName}</Typography>
              <Text style={{ color: tokens.foregroundMuted }}>
                Invited by {invitation.inviter.displayName}
                {invitation.inviter.username
                  ? ` (@${invitation.inviter.username.replace(/^@+/, '')})`
                  : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onPress={() =>
                    void run(`${invitation.id}:accept`, () =>
                      onRespondToInvitation(invitation.id, 'accept'),
                    )
                  }
                >
                  {busy === `${invitation.id}:accept` ? 'Accepting…' : 'Accept'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onPress={() =>
                    void run(`${invitation.id}:decline`, () =>
                      onRespondToInvitation(invitation.id, 'decline'),
                    )
                  }
                >
                  Decline
                </Button>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: tokens.foregroundMuted }}>No pending group invitations.</Text>
        )}
      </ScrollView>
    </Sheet>
  );
}
