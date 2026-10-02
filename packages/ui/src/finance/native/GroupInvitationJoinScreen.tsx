import React from 'react';
import { View } from 'react-native';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { GroupPanel } from './GroupPrimitives';
export type GroupInvitationPreview = { groupId: string; groupName: string; currency: string };
export type GroupInvitationJoinScreenProps = {
  preview?: GroupInvitationPreview | null;
  loading: boolean;
  authRequired: boolean;
  joining: boolean;
  error?: string;
  onJoin: () => void;
  onSignIn: () => void;
};
export function GroupInvitationJoinScreen(p: GroupInvitationJoinScreenProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: tokens.background }}
    >
      <GroupPanel>
        <Typography variant="caption">GROUP INVITATION</Typography>
        <Typography variant="heading">Join a group</Typography>
        {p.loading ? (
          <Typography accessibilityLiveRegion="polite">Checking invitation…</Typography>
        ) : p.preview ? (
          <>
            <Typography variant="heading">{p.preview.groupName}</Typography>
            <Typography variant="caption">Shared group · {p.preview.currency}</Typography>
            <Typography>Join this group to access its shared ledger and conversations.</Typography>
            {p.authRequired ? (
              <>
                <Typography variant="caption">
                  Sign in or create an account to accept this invitation.
                </Typography>
                <Button onPress={p.onSignIn}>Sign in to continue</Button>
              </>
            ) : (
              <Button disabled={p.joining} onPress={p.onJoin}>
                {p.joining ? 'Joining…' : 'Join group'}
              </Button>
            )}
          </>
        ) : (
          <Typography variant="caption">
            This invitation is invalid, expired, or has been revoked.
          </Typography>
        )}
        {p.error ? (
          <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {p.error}
          </Typography>
        ) : null}
      </GroupPanel>
    </View>
  );
}
