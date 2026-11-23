import React from 'react';
import { View } from 'react-native';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { GroupPanel } from './GroupPrimitives';
import { groupInvitationState } from '../groupInvitationState';
export type GroupInvitationPreview = { groupId: string; groupName: string; currency: string };
export type GroupInvitationJoinScreenProps = {
  preview?: GroupInvitationPreview | null;
  validToken: boolean;
  authLoading: boolean;
  authenticated: boolean;
  offline: boolean;
  connected: boolean;
  joining: boolean;
  error?: string;
  onJoin: () => void;
  onSignIn: () => void;
};
export function GroupInvitationJoinScreen(p: GroupInvitationJoinScreenProps) {
  const { tokens } = useTheme();
  const state = groupInvitationState({ ...p, preview: p.preview });
  return (
    <View
      style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: tokens.background }}
    >
      <GroupPanel>
        <Typography variant="caption">GROUP INVITATION</Typography>
        <Typography variant="heading">Join a group</Typography>
        {state === 'auth-loading' || state === 'preview-loading' ? (
          <Typography accessibilityLiveRegion="polite">
            {state === 'auth-loading' ? 'Checking your account…' : 'Checking invitation…'}
          </Typography>
        ) : state === 'signed-out' ? (
          <>
            <Typography>Sign in or create an account to view and accept this invitation.</Typography>
            <Button onPress={p.onSignIn}>Sign in to continue</Button>
          </>
        ) : state === 'offline' || state === 'connecting' ? (
          <Typography accessibilityLiveRegion="polite">
            {state === 'offline'
              ? 'You are offline. Reconnect to check this invitation.'
              : 'Connecting to FinApp to check this invitation…'}
          </Typography>
        ) : state === 'valid' && p.preview ? (
          <>
            <Typography variant="heading">{p.preview.groupName}</Typography>
            <Typography variant="caption">Shared group · {p.preview.currency}</Typography>
            <Typography>Join this group to access its shared ledger and conversations.</Typography>
            <Button disabled={p.joining} onPress={p.onJoin}>
              {p.joining ? 'Joining…' : 'Join group'}
            </Button>
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
