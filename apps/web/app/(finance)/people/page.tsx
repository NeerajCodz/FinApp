'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Avatar, Card, Empty } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type Profile = {
  id: Id<'users'>;
  username?: string;
  displayName: string;
  avatarId?: string;
  avatarUrl?: string | null;
  image?: string;
};
type RequestRow = { requestId: Id<'friendRequests'>; createdAt: number; user: Profile };
type Conversation = Profile & {
  userId: Id<'users'>;
  id: Id<'directConversations'>;
  updatedAt: number;
};
type Requests = { incoming: RequestRow[]; outgoing: RequestRow[] };

export default function PeoplePage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const [query, setQuery] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const friends = useQuery(api.social.queries.friends, userId && isConnected ? {} : 'skip') as
    Profile[] | undefined;
  const requests = useQuery(api.social.queries.requests, userId && isConnected ? {} : 'skip') as
    Requests | undefined;
  const conversations = useQuery(
    api.directMessages.queries.listConversations,
    userId && isConnected ? {} : 'skip',
  ) as Conversation[] | undefined;
  const results = useQuery(
    api.users.queries.search,
    userId && isConnected && query.trim().length >= 2 ? { query: query.trim() } : 'skip',
  ) as Profile[] | undefined;
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const cancelRequest = useMutation(api.social.mutations.cancelRequest);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const friendIds = new Set((friends ?? []).map((person) => person.id));

  async function perform(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await action();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'That action could not be completed.',
      );
    } finally {
      setBusyId(null);
    }
  }
  async function openConversation(user: Profile | { userId: Id<'users'> }) {
    const id = 'id' in user ? user.id : user.userId;
    await perform(id, async () => {
      const conversationId = await startConversation({ userId: id });
      router.push(`/messages/${encodeURIComponent(String(conversationId))}`);
    });
  }

  if (!userId)
    return (
      <div className="finance-page">
        <h1>People</h1>
        <p className="finance-muted">Sign in to find friends and send messages.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in
        </Link>
      </div>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">YOUR NETWORK</p>
          <h1>People</h1>
        </div>
      </header>
      {!isConnected && (
        <p className="finance-form-note" role="status">
          You’re offline. People and messages need a connection.
        </p>
      )}
      {actionError && (
        <p className="finance-form-error" role="alert">
          {actionError}
        </p>
      )}
      <Card className="finance-record-panel">
        <h2>Find people</h2>
        <label htmlFor="people-search">Search by username</label>
        <input
          id="people-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Start with a username"
          disabled={!isConnected}
        />
        {query.trim().length > 0 && query.trim().length < 2 && (
          <p className="finance-muted">Enter at least two characters.</p>
        )}
        {query.trim().length >= 2 && results === undefined && isConnected && (
          <p role="status" className="finance-muted">
            Searching…
          </p>
        )}
        {results?.length ? (
          <ul className="finance-record-list">
            {results
              .filter((item) => item.id !== userId)
              .map((person) => {
                const incoming = requests?.incoming.find((item) => item.user.id === person.id);
                const outgoing = requests?.outgoing.find((item) => item.user.id === person.id);
                const busy =
                  busyId === person.id || friends === undefined || requests === undefined;
                return (
                  <li
                    key={person.id}
                    className="finance-record-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <Link
                      href={`/@${encodeURIComponent(person.username ?? '')}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <Avatar
                        label={person.displayName}
                        initials={person.displayName.slice(0, 2).toUpperCase()}
                        size={40}
                        avatarId={person.avatarId}
                        imageUrl={person.avatarUrl ?? person.image}
                      />
                      <span>
                        <strong>{person.displayName}</strong>
                        <br />
                        <small>@{person.username}</small>
                      </span>
                    </Link>
                    {friendIds.has(person.id) ? (
                      <button
                        type="button"
                        className="finance-secondary-action"
                        disabled={busy}
                        onClick={() => void openConversation(person)}
                      >
                        Message
                      </button>
                    ) : incoming ? (
                      <button
                        type="button"
                        className="finance-primary-link"
                        disabled={busy}
                        onClick={() =>
                          void perform(incoming.requestId, () =>
                            respondToRequest({
                              requestId: incoming.requestId as never,
                              response: 'accept',
                            }),
                          )
                        }
                      >
                        Accept request
                      </button>
                    ) : outgoing ? (
                      <button
                        type="button"
                        className="finance-secondary-action"
                        disabled={busy}
                        onClick={() =>
                          void perform(outgoing.requestId, () =>
                            cancelRequest({ requestId: outgoing.requestId as never }),
                          )
                        }
                      >
                        Request sent
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="finance-secondary-action"
                        disabled={busy}
                        onClick={() =>
                          void perform(person.id, () =>
                            sendRequest({ recipientId: person.id as never }),
                          )
                        }
                      >
                        Add friend
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        ) : results && query.trim().length >= 2 ? (
          <Empty title="No people found" description="Try another username." />
        ) : null}
      </Card>
      <section style={{ display: 'grid', gap: 12 }}>
        <h2>Friends</h2>
        {friends === undefined ? (
          <p role="status" className="finance-muted">
            Loading friends…
          </p>
        ) : friends.length ? (
          <ul className="finance-record-list">
            {friends.map((person) => (
              <li
                key={person.id}
                className="finance-record-panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Link
                  href={`/@${encodeURIComponent(person.username ?? '')}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <Avatar
                    label={person.displayName}
                    initials={person.displayName.slice(0, 2).toUpperCase()}
                    size={40}
                    avatarId={person.avatarId}
                  />
                  <span>
                    <strong>{person.displayName}</strong>
                    <br />
                    <small>@{person.username}</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="finance-primary-link"
                  disabled={busyId === person.id}
                  onClick={() => void openConversation(person)}
                >
                  Message
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No friends yet" description="Search for someone by username to connect." />
        )}
      </section>
      <div className="finance-page-actions">
        <section style={{ flex: 1 }}>
          <h2>Incoming requests</h2>
          {requests === undefined ? (
            <p role="status">Loading requests…</p>
          ) : requests.incoming.length ? (
            <ul className="finance-record-list">
              {requests.incoming.map((item) => (
                <li key={item.requestId} className="finance-record-panel">
                  <Link href={`/@${encodeURIComponent(item.user.username ?? '')}`}>
                    {item.user.displayName} <small>@{item.user.username}</small>
                  </Link>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="finance-primary-link"
                      disabled={busyId === item.requestId}
                      onClick={() =>
                        void perform(item.requestId, () =>
                          respondToRequest({
                            requestId: item.requestId as never,
                            response: 'accept',
                          }),
                        )
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="finance-secondary-action"
                      disabled={busyId === item.requestId}
                      onClick={() =>
                        void perform(item.requestId, () =>
                          respondToRequest({
                            requestId: item.requestId as never,
                            response: 'decline',
                          }),
                        )
                      }
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-muted">No incoming requests.</p>
          )}
        </section>
        <section style={{ flex: 1 }}>
          <h2>Outgoing requests</h2>
          {requests === undefined ? (
            <p role="status">Loading requests…</p>
          ) : requests.outgoing.length ? (
            <ul className="finance-record-list">
              {requests.outgoing.map((item) => (
                <li key={item.requestId} className="finance-record-panel">
                  <Link href={`/@${encodeURIComponent(item.user.username ?? '')}`}>
                    {item.user.displayName} <small>@{item.user.username}</small>
                  </Link>
                  <button
                    type="button"
                    className="finance-secondary-action"
                    disabled={busyId === item.requestId}
                    onClick={() =>
                      void perform(item.requestId, () =>
                        cancelRequest({ requestId: item.requestId as never }),
                      )
                    }
                  >
                    Cancel request
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-muted">No outgoing requests.</p>
          )}
        </section>
      </div>
      <section style={{ display: 'grid', gap: 12 }}>
        <h2>Conversations</h2>
        {conversations === undefined ? (
          <p role="status">Loading conversations…</p>
        ) : conversations.length ? (
          <ul className="finance-record-list">
            {conversations.map((conversation) => (
              <li
                key={conversation.userId}
                className="finance-record-panel"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>
                  {conversation.displayName}
                  {conversation.username ? ` · @${conversation.username}` : ''}
                </span>
                <Link
                  className="finance-primary-link"
                  href={`/messages/${encodeURIComponent(conversation.id)}`}
                >
                  Open conversation
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="No conversations yet"
            description="Start a conversation from a friend or username search."
          />
        )}
      </section>
    </div>
  );
}
