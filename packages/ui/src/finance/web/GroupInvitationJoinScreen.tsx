'use client';
import React from 'react';
import { Button } from '@finapp/ui/web';
import { GroupPage, s } from './GroupUI';
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
  const state = groupInvitationState({ ...p, preview: p.preview });
  return (
    <GroupPage>
      <main className={s.stack} style={{ maxWidth: 560, margin: '8vh auto' }}>
        <section className={s.panel}>
          <p className={s.muted}>GROUP INVITATION</p>
          <h1>Join a group</h1>
          {state === 'auth-loading' || state === 'preview-loading' ? (
            <p role="status" className={s.muted}>
              {state === 'auth-loading' ? 'Checking your account…' : 'Checking invitation…'}
            </p>
          ) : state === 'signed-out' ? (
            <>
              <p>Sign in or create an account to view and accept this invitation.</p>
              <Button onPress={p.onSignIn}>Sign in to continue</Button>
            </>
          ) : state === 'offline' || state === 'connecting' ? (
            <p role="status" className={s.muted}>
              {state === 'offline'
                ? 'You are offline. Reconnect to check this invitation.'
                : 'Connecting to FinApp to check this invitation…'}
            </p>
          ) : state === 'valid' && p.preview ? (
            <>
              <h2>{p.preview.groupName}</h2>
              <p className={s.muted}>Shared group · {p.preview.currency}</p>
              <p>Join this group to access its shared ledger and conversations.</p>
              <Button disabled={p.joining} onPress={p.onJoin}>
                {p.joining ? 'Joining…' : 'Join group'}
              </Button>
            </>
          ) : (
            <p className={s.muted}>This invitation is invalid, expired, or has been revoked.</p>
          )}
          {p.error && (
            <p role="alert" className={s.error}>
              {p.error}
            </p>
          )}
        </section>
      </main>
    </GroupPage>
  );
}
