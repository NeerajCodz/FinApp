import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { MutationCtx } from '../../convex/_generated/server';

const modules = import.meta.glob('../../convex/**/*.ts');

async function createUser(
  ctx: MutationCtx,
  username: string,
  options: { verified?: boolean; deleted?: boolean } = {},
) {
  return ctx.db.insert('users', {
    username,
    displayName: username,
    email: `${username}@example.com`,
    ...(options.verified === false ? {} : { emailVerificationTime: 1 }),
    ...(options.deleted ? { deletedAt: Date.now() } : {}),
  });
}

async function connect(ctx: MutationCtx, first: Id<'users'>, second: Id<'users'>) {
  const [userLowId, userHighId] =
    String(first) < String(second) ? [first, second] : [second, first];
  await ctx.db.insert('friendships', { userLowId, userHighId, createdAt: Date.now() });
}

describe('social discovery and relationship summaries', () => {
  it('suggests verified friends-of-friends and excludes existing connections and pending requests', async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const actor = await createUser(ctx, 'actor');
      const firstFriend = await createUser(ctx, 'first_friend');
      const secondFriend = await createUser(ctx, 'second_friend');
      const candidate = await createUser(ctx, 'candidate');
      const outgoing = await createUser(ctx, 'outgoing');
      const incoming = await createUser(ctx, 'incoming');
      const direct = await createUser(ctx, 'direct');
      const unverified = await createUser(ctx, 'unverified', { verified: false });
      const deleted = await createUser(ctx, 'deleted', { deleted: true });
      await connect(ctx, actor, firstFriend);
      await connect(ctx, actor, secondFriend);
      await connect(ctx, actor, direct);
      await connect(ctx, firstFriend, candidate);
      await connect(ctx, secondFriend, candidate);
      await connect(ctx, firstFriend, outgoing);
      await connect(ctx, firstFriend, incoming);
      await connect(ctx, firstFriend, unverified);
      await connect(ctx, firstFriend, deleted);
      await ctx.db.insert('friendRequests', {
        requesterId: actor,
        recipientId: outgoing,
        status: 'pending',
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert('friendRequests', {
        requesterId: incoming,
        recipientId: actor,
        status: 'pending',
        createdAt: 1,
        updatedAt: 1,
      });
      return { actor, candidate };
    });
    const actor = t.withIdentity({ subject: `${fixture.actor}|session` });

    const suggestions = await actor.query(api.social.queries.suggestions, {});

    expect(suggestions).toMatchObject([
      { id: fixture.candidate, username: 'candidate', mutualFriendCount: 2 },
    ]);
    expect(suggestions.map((row) => row.username)).not.toContain('direct');
    expect(suggestions.map((row) => row.username)).not.toContain('outgoing');
    expect(suggestions.map((row) => row.username)).not.toContain('incoming');
    expect(suggestions.map((row) => row.username)).not.toContain('unverified');
    expect(suggestions.map((row) => row.username)).not.toContain('deleted');
  });

  it('returns only mutual friends and groups shared by the viewer and profile', async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const viewer = await createUser(ctx, 'viewer');
      const person = await createUser(ctx, 'person');
      const mutual = await createUser(ctx, 'mutual');
      const unrelated = await createUser(ctx, 'unrelated');
      await connect(ctx, viewer, mutual);
      await connect(ctx, person, mutual);
      const sharedGroup = await ctx.db.insert('groups', {
        ownerId: viewer,
        name: 'Shared trip',
        currency: 'INR',
        createdAt: 1,
        updatedAt: 1,
      });
      const privateGroup = await ctx.db.insert('groups', {
        ownerId: viewer,
        name: 'Viewer only',
        currency: 'INR',
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert('groupMembers', {
        groupId: sharedGroup,
        userId: viewer,
        role: 'owner',
        joinedAt: 1,
      });
      await ctx.db.insert('groupMembers', {
        groupId: sharedGroup,
        userId: person,
        role: 'member',
        joinedAt: 1,
      });
      await ctx.db.insert('groupMembers', {
        groupId: sharedGroup,
        userId: mutual,
        role: 'member',
        joinedAt: 1,
      });
      await ctx.db.insert('groupMembers', {
        groupId: privateGroup,
        userId: viewer,
        role: 'owner',
        joinedAt: 1,
      });
      await ctx.db.insert('groupMembers', {
        groupId: privateGroup,
        userId: unrelated,
        role: 'member',
        joinedAt: 1,
      });
      return { viewer, person, sharedGroup };
    });
    const viewer = t.withIdentity({ subject: `${fixture.viewer}|session` });

    const relation = await viewer.query(api.social.queries.relationship, {
      userId: fixture.person,
    });

    expect(relation).toMatchObject({
      profile: { username: 'person', displayName: 'person' },
      status: 'none',
      mutualFriends: [{ username: 'mutual' }],
      sharedGroups: [{ id: fixture.sharedGroup, name: 'Shared trip', memberCount: 3 }],
    });
    expect(relation && 'email' in relation.profile).toBe(false);
  });

  it('distinguishes incoming and outgoing requests and does not reveal relationship state when signed out', async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const viewer = await createUser(ctx, 'viewer');
      const incoming = await createUser(ctx, 'incoming');
      const outgoing = await createUser(ctx, 'outgoing');
      await ctx.db.insert('friendRequests', {
        requesterId: incoming,
        recipientId: viewer,
        status: 'pending',
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert('friendRequests', {
        requesterId: viewer,
        recipientId: outgoing,
        status: 'pending',
        createdAt: 1,
        updatedAt: 1,
      });
      return { viewer, incoming, outgoing };
    });
    const viewer = t.withIdentity({ subject: `${fixture.viewer}|session` });

    const [incoming, outgoing, anonymous] = await Promise.all([
      viewer.query(api.social.queries.relationship, { userId: fixture.incoming }),
      viewer.query(api.social.queries.relationship, { userId: fixture.outgoing }),
      t.query(api.social.queries.relationship, { userId: fixture.incoming }),
    ]);

    expect(incoming?.status).toBe('incoming');
    expect(incoming?.incomingRequestId).toBeDefined();
    expect(outgoing?.status).toBe('outgoing');
    expect(outgoing?.outgoingRequestId).toBeDefined();
    expect(anonymous?.status).toBe('unknown');
    expect(anonymous?.mutualFriends).toEqual([]);
  });
});
