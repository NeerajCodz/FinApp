'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowRight, Bell, MessageCircle, Search, UsersRound, UserPlus, X } from 'lucide-react';
import { Button, Input } from '@finapp/ui/web';
import {
  FinanceEmptyState,
  SocialPersonCard,
  SocialSection,
  SocialStat,
  type SocialProfileSummary,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type Profile = SocialProfileSummary & { id: Id<'users'> };
type SuggestedProfile = Profile & { mutualFriendCount: number };
type RequestRow = { requestId: Id<'friendRequests'>; createdAt: number; user: Profile };
type Requests = { incoming: RequestRow[]; outgoing: RequestRow[] };
type Conversation = Profile & {
  userId: Id<'users'>;
  id: Id<'directConversations'>;
  updatedAt: number;
  lastMessage: null | {
    kind: 'text' | 'image';
    text: string;
    createdAt: number;
    mine: boolean;
    seen: boolean;
  };
};
type PeopleFilter = 'all' | 'friends' | 'requests' | 'messages';
const filters: { id: PeopleFilter; label: string }[] = [
  { id: 'all', label: 'All people' },
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
  { id: 'messages', label: 'Messages' },
];

const profileHref = (profile: SocialProfileSummary) =>
  profile.username ? `/@${encodeURIComponent(profile.username.replace(/^@+/, ''))}` : '/people';
const timeAgo = (timestamp: number) => {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
};

export default function PeoplePage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [requestsOpen, setRequestsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<PeopleFilter>('all');
  const [suggestionSort, setSuggestionSort] = React.useState<'mutuals' | 'name'>('mutuals');
  const [actionError, setActionError] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const friends = useQuery(api.social.queries.friends, userId && isConnected ? {} : 'skip') as
    Profile[] | undefined;
  const requests = useQuery(api.social.queries.requests, userId && isConnected ? {} : 'skip') as
    Requests | undefined;
  const invitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const suggestions = useQuery(
    api.social.queries.suggestions,
    userId && isConnected ? {} : 'skip',
  ) as SuggestedProfile[] | undefined;
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
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const friendIds = new Set((friends ?? []).map((person) => person.id));
  const pendingCount = (requests?.incoming.length ?? 0) + (invitations?.length ?? 0);
  const peopleCount = new Set([
    ...(friends ?? []).map((person) => String(person.id)),
    ...(requests?.incoming ?? []).map((row) => String(row.user.id)),
    ...(requests?.outgoing ?? []).map((row) => String(row.user.id)),
  ]).size;
  const sortedSuggestions = [...(suggestions ?? [])].sort((left, right) =>
    suggestionSort === 'mutuals'
      ? right.mutualFriendCount - left.mutualFriendCount ||
        left.displayName.localeCompare(right.displayName)
      : left.displayName.localeCompare(right.displayName),
  );
  const filteredFriends = (friends ?? []).filter((profile) =>
    `${profile.displayName} ${profile.username ?? ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  React.useEffect(() => {
    if (!requestsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRequestsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestsOpen]);

  async function respondToGroupInvitation(inviteId: string, response: 'accept' | 'decline') {
    if (!isConnected) {
      setActionError('You are offline. Reconnect to respond to this invitation.');
      return;
    }
    await perform(inviteId, () =>
      respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response }),
    );
  }
  async function perform(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError('');
    try {
      await action();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'That action could not be completed. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function relationshipAction(
    profile: Profile,
    request?: RequestRow,
    outgoing?: RequestRow,
    inRequestsDialog = false,
  ) {
    if (friendIds.has(profile.id))
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busyId === profile.id}
          onPress={() => void openConversation(profile.id)}
        >
          <MessageCircle size={15} aria-hidden="true" /> Message
        </Button>
      );
    if (request && !inRequestsDialog)
      return (
        <Button type="button" variant="outline" size="sm" onPress={() => setRequestsOpen(true)}>
          Respond
        </Button>
      );
    if (outgoing && !inRequestsDialog)
      return (
        <Button type="button" variant="outline" size="sm" onPress={() => setRequestsOpen(true)}>
          Pending
        </Button>
      );
    if (request)
      return (
        <div className="people-actions-inline">
          <Button
            type="button"
            size="sm"
            disabled={busyId === request.requestId}
            onPress={() =>
              void perform(String(request.requestId), () =>
                respondToRequest({ requestId: request.requestId, response: 'accept' }),
              )
            }
          >
            Accept
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyId === request.requestId}
            onPress={() =>
              void perform(String(request.requestId), () =>
                respondToRequest({ requestId: request.requestId, response: 'decline' }),
              )
            }
          >
            Decline
          </Button>
        </div>
      );
    if (outgoing)
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busyId === outgoing.requestId}
          onPress={() =>
            void perform(String(outgoing.requestId), () =>
              cancelRequest({ requestId: outgoing.requestId }),
            )
          }
        >
          Request sent
        </Button>
      );
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busyId === profile.id}
        onPress={() =>
          void perform(String(profile.id), () => sendRequest({ recipientId: profile.id }))
        }
      >
        <UserPlus size={15} aria-hidden="true" /> Add friend
      </Button>
    );
  }

  async function openConversation(id: Id<'users'>) {
    await perform(String(id), async () => {
      const conversationId = await startConversation({ userId: id });
      router.push(`/messages/${encodeURIComponent(String(conversationId))}`);
    });
  }

  function requestFor(profile: Profile) {
    const incoming = requests?.incoming.find((row) => row.user.id === profile.id);
    const outgoing = requests?.outgoing.find((row) => row.user.id === profile.id);
    return { incoming, outgoing };
  }

  if (!userId)
    return (
      <div className="finance-page">
        <header className="finance-page-heading">
          <div>
            <p className="finance-kicker">YOUR NETWORK</p>
            <h1>People</h1>
          </div>
        </header>
        <FinanceEmptyState
          kind="people"
          title="Your circle starts here."
          description="Sign in to find friends, share expenses, and keep conversations together."
          action={
            <Link className="finance-primary-link" href="/sign-in">
              Sign in
            </Link>
          }
        />
      </div>
    );

  return (
    <main className="people-page">
      <header className="people-heading">
        <div>
          <p className="finance-kicker">YOUR NETWORK</p>
          <h1>People</h1>
          <p>Find friends, settle balances, and manage your network.</p>
        </div>
        <div className="people-header-actions">
          <Button type="button" variant="outline" onPress={() => setRequestsOpen(true)}>
            Requests
            {pendingCount > 0 && <span className="people-request-count">{pendingCount}</span>}
          </Button>
          <Link
            className="people-notification-link"
            href="/notifications"
            aria-label="Notifications"
          >
            <Bell size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <form
        className="people-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <label className="people-search">
          <Search size={19} aria-hidden="true" />
          <Input
            id="people-search"
            type="search"
            value={query}
            onChangeText={setQuery}
            autoComplete="off"
            placeholder="Search by username…"
            disabled={!isConnected}
            aria-label="Search people by username"
          />
        </label>
        <div className="people-filter-tabs" role="group" aria-label="Filter people">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'is-active' : ''}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort people you may know"
          value={suggestionSort}
          onChange={(event) => setSuggestionSort(event.target.value as 'mutuals' | 'name')}
        >
          <option value="mutuals">Sort: Mutual friends</option>
          <option value="name">Sort: Name</option>
        </select>
        <Button type="button" onPress={() => searchRef.current?.focus()}>
          <UserPlus size={17} aria-hidden="true" /> Find people
        </Button>
      </form>

      {!isConnected && (
        <p className="finance-form-note" role="status">
          You’re offline. Reconnect to find people and send messages.
        </p>
      )}
      {actionError && (
        <p className="finance-form-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="people-dashboard">
        <div className="people-main-column">
          {query.trim().length >= 2 && (
            <SocialSection title="Search results" count={results?.length ?? 0}>
              {results === undefined ? (
                <p role="status" className="finance-muted">
                  Searching people…
                </p>
              ) : results.length ? (
                <div className="people-card-grid people-card-grid--search">
                  {results
                    .filter((person) => person.id !== userId)
                    .map((profile) => {
                      const { incoming, outgoing } = requestFor(profile);
                      return (
                        <SocialPersonCard
                          key={profile.id}
                          profile={profile}
                          href={profileHref(profile)}
                          detail={
                            incoming ? 'Wants to connect' : outgoing ? 'Request pending' : undefined
                          }
                          action={relationshipAction(profile, incoming, outgoing)}
                        />
                      );
                    })}
                </div>
              ) : (
                <FinanceEmptyState
                  kind="search"
                  title="No matching people."
                  description="Try another username. We only show public profile details."
                  compact
                />
              )}
            </SocialSection>
          )}

          {filter === 'all' || filter === 'friends' ? (
            <SocialSection
              title="Friends"
              count={friends?.length ?? 0}
              action={
                friends && friends.length > 5 ? (
                  <Link href="#friends" className="people-see-all">
                    See all
                  </Link>
                ) : undefined
              }
            >
              {friends === undefined ? (
                <p role="status" className="finance-muted">
                  Loading friends…
                </p>
              ) : filteredFriends.length ? (
                <div className="people-card-grid" id="friends">
                  {filteredFriends.slice(0, filter === 'all' ? 6 : undefined).map((profile) => (
                    <SocialPersonCard
                      key={profile.id}
                      profile={profile}
                      href={profileHref(profile)}
                      detail="Friend"
                      action={relationshipAction(profile)}
                    />
                  ))}
                </div>
              ) : friends.length ? (
                <FinanceEmptyState
                  kind="search"
                  title="No friends match that search."
                  description="Clear the search to see your full network."
                  compact
                />
              ) : (
                <FinanceEmptyState
                  kind="people"
                  title="Your circle starts here."
                  description="Find someone you know and send a friend request. Accepted friends can message and split expenses with you."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onPress={() => searchRef.current?.focus()}
                    >
                      <Search size={15} aria-hidden="true" /> Find a friend
                    </Button>
                  }
                  compact
                />
              )}
            </SocialSection>
          ) : null}

          {filter === 'all' || filter === 'friends' ? (
            <SocialSection
              title="People you may know"
              count={suggestions?.length ?? 0}
              action={
                <Link
                  href="#people-search"
                  className="people-see-all"
                  onClick={(event) => {
                    event.preventDefault();
                    searchRef.current?.focus();
                  }}
                >
                  Search by username
                </Link>
              }
            >
              {suggestions === undefined ? (
                <p role="status" className="finance-muted">
                  Finding people from your mutual connections…
                </p>
              ) : sortedSuggestions.length ? (
                <div className="people-card-grid">
                  {sortedSuggestions.map((profile) => {
                    const { incoming, outgoing } = requestFor(profile);
                    return (
                      <SocialPersonCard
                        key={profile.id}
                        profile={profile}
                        href={profileHref(profile)}
                        detail={`${profile.mutualFriendCount} mutual ${profile.mutualFriendCount === 1 ? 'friend' : 'friends'}`}
                        action={relationshipAction(profile, incoming, outgoing)}
                      />
                    );
                  })}
                </div>
              ) : (
                <FinanceEmptyState
                  kind="people"
                  title="No suggestions yet."
                  description="Add friends to build your network. We’ll suggest verified people connected to your circle."
                  compact
                />
              )}
            </SocialSection>
          ) : null}

          {filter === 'all' || filter === 'messages' ? (
            <SocialSection
              title="Recent conversations"
              count={conversations?.length ?? 0}
              action={
                conversations && conversations.length > 5 ? (
                  <Link href="#recent-conversations" className="people-see-all">
                    See all
                  </Link>
                ) : undefined
              }
            >
              {conversations === undefined ? (
                <p role="status" className="finance-muted">
                  Loading conversations…
                </p>
              ) : conversations.length ? (
                <div className="people-conversation-list" id="recent-conversations">
                  {conversations.slice(0, filter === 'all' ? 4 : undefined).map((conversation) => (
                    <SocialPersonCard
                      key={conversation.id}
                      profile={{
                        id: conversation.userId,
                        username: conversation.username,
                        displayName: conversation.displayName ?? 'Finapp user',
                        avatarId: conversation.avatarId,
                        avatarUrl: conversation.avatarUrl,
                      }}
                      href={profileHref(conversation)}
                      detail={
                        conversation.lastMessage
                          ? `${conversation.lastMessage.mine ? 'You: ' : ''}${conversation.lastMessage.text}`
                          : 'Start the conversation'
                      }
                      action={
                        <Link
                          className="finance-secondary-action"
                          href={`/messages/${encodeURIComponent(String(conversation.id))}`}
                        >
                          Open <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : (
                <FinanceEmptyState
                  kind="message"
                  title="No conversations yet."
                  description="Open a friend’s profile and send a message to start a private conversation."
                  compact
                />
              )}
            </SocialSection>
          ) : null}
        </div>

        <aside className="people-sidebar" aria-label="Network overview">
          <section className="people-overview-panel">
            <h2>
              <UsersRound size={18} aria-hidden="true" /> Network overview
            </h2>
            <div className="people-overview-stats">
              <SocialStat label="Friends" value={friends?.length ?? '—'} />
              <SocialStat label="Pending" value={requests ? pendingCount : '—'} />
              <SocialStat label="People" value={friends && requests ? peopleCount : '—'} />
            </div>
          </section>

          <section className="people-overview-panel">
            <div className="people-panel-heading">
              <h2>
                <MessageCircle size={18} aria-hidden="true" /> Recent messages
              </h2>
              {conversations && conversations.length > 3 && (
                <button
                  type="button"
                  className="people-see-all"
                  onClick={() => setFilter('messages')}
                >
                  View all
                </button>
              )}
            </div>
            {conversations === undefined ? (
              <p className="finance-muted" role="status">
                Loading conversations…
              </p>
            ) : conversations.length ? (
              <div className="people-sidebar-conversations">
                {conversations.slice(0, 3).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/messages/${encodeURIComponent(String(conversation.id))}`}
                    className="people-sidebar-conversation"
                  >
                    <span className="people-sidebar-conversation-copy">
                      <strong>{conversation.displayName ?? 'Finapp user'}</strong>
                      <small>{conversation.lastMessage?.text ?? 'Start the conversation'}</small>
                    </span>
                    <small>
                      {timeAgo(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <FinanceEmptyState
                kind="message"
                title="Say hello."
                description="Your conversations will appear here."
                compact
              />
            )}
          </section>

          <section className="people-split-callout">
            <span className="people-split-icon">
              <UsersRound size={21} aria-hidden="true" />
            </span>
            <div>
              <strong>Split expenses together</strong>
              <p>Create a group to split bills with friends or family.</p>
              <Link href="/groups/new">
                Create a group <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
      {requestsOpen && (
        <div
          className="people-requests-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRequestsOpen(false);
          }}
        >
          <section
            className="people-requests-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-requests-title"
          >
            <header className="people-requests-dialog-heading">
              <h2 id="people-requests-title">Requests</h2>
              <button
                type="button"
                onClick={() => setRequestsOpen(false)}
                aria-label="Close requests"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            {!isConnected && (
              <p className="finance-form-note" role="status">
                You’re offline. Reconnect to manage requests and invitations.
              </p>
            )}
            {actionError && (
              <p className="finance-form-error" role="alert">
                {actionError}
              </p>
            )}
            <SocialSection
              title="Friend requests"
              count={(requests?.incoming.length ?? 0) + (requests?.outgoing.length ?? 0)}
            >
              {requests === undefined ? (
                <p role="status" className="finance-muted">
                  Loading requests…
                </p>
              ) : requests.incoming.length || requests.outgoing.length ? (
                <div className="people-card-grid people-card-grid--requests">
                  {requests.incoming.map((row) => (
                    <SocialPersonCard
                      key={row.requestId}
                      profile={row.user}
                      href={profileHref(row.user)}
                      detail={`Requested ${timeAgo(row.createdAt)}`}
                      action={relationshipAction(row.user, row, undefined, true)}
                    />
                  ))}
                  {requests.outgoing.map((row) => (
                    <SocialPersonCard
                      key={row.requestId}
                      profile={row.user}
                      href={profileHref(row.user)}
                      detail={`Sent ${timeAgo(row.createdAt)}`}
                      action={relationshipAction(row.user, undefined, row, true)}
                    />
                  ))}
                </div>
              ) : (
                <FinanceEmptyState
                  kind="people"
                  title="No friend requests."
                  description="Incoming and sent friend requests will appear here."
                  compact
                />
              )}
            </SocialSection>
            <SocialSection title="Group invitations" count={invitations?.length ?? 0}>
              {!isConnected ? (
                <p role="status" className="finance-muted">
                  Connect to the internet to view invitations.
                </p>
              ) : invitations === undefined ? (
                <p role="status" className="finance-muted">
                  Loading invitations…
                </p>
              ) : invitations.length ? (
                invitations.map((invite) => (
                  <article className="people-group-invitation" key={invite.id}>
                    <strong>
                      {invite.groupName} · {invite.currency}
                    </strong>
                    <span>
                      Invited by {invite.inviter.displayName}
                      {invite.inviter.username ? ` (@${invite.inviter.username})` : ''}
                    </span>
                    <div className="people-actions-inline">
                      <Button
                        size="sm"
                        disabled={busyId === invite.id || !isConnected}
                        onPress={() => void respondToGroupInvitation(invite.id, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === invite.id || !isConnected}
                        onPress={() => void respondToGroupInvitation(invite.id, 'decline')}
                      >
                        Decline
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <FinanceEmptyState
                  kind="invitation"
                  title="No group invitations."
                  description="Group invitations will appear here when someone invites you."
                  compact
                />
              )}
            </SocialSection>
          </section>
        </div>
      )}
    </main>
  );
}
