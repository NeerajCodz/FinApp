'use client';
import React from 'react';
import { Button } from '@finapp/ui/web';
import { GroupPage, s } from './GroupUI';
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
  return (
    <GroupPage>
      <main className={s.stack} style={{ maxWidth: 560, margin: '8vh auto' }}>
        <section className={s.panel}>
          <p className={s.muted}>GROUP INVITATION</p>
          <h1>Join a group</h1>
          {p.loading ? (
            <p role="status" className={s.muted}>
              Checking invitation…
            </p>
          ) : p.preview ? (
            <>
              <h2>{p.preview.groupName}</h2>
              <p className={s.muted}>Shared group · {p.preview.currency}</p>
              <p>Join this group to access its shared ledger and conversations.</p>
              {p.authRequired ? (
                <>
                  <p>Sign in or create an account to accept this invitation.</p>
                  <Button onPress={p.onSignIn}>Sign in to continue</Button>
                </>
              ) : (
                <Button disabled={p.joining} onPress={p.onJoin}>
                  {p.joining ? 'Joining…' : 'Join group'}
                </Button>
              )}
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
