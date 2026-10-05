import { useMemo } from 'react';
import { useQueries, useQuery, type RequestForQueries } from 'convex/react';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { mergeGroupRecords, type GroupRecord } from '../lib/groupRecords';
import { useLocalRecords } from './useLocalRecords';

export type GroupMemberSummary = {
  id: string;
  displayName: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
  role?: string;
};

type GroupDetails = Record<string, { members?: GroupMemberSummary[] } | null | undefined>;

export function useGroupRecords(userId: string | null, isConnected: boolean) {
  const local = useLocalRecords<GroupRecord>(userId, 'group');
  const cloud = useQuery(api.groups.queries.list, userId && isConnected ? {} : 'skip');
  const data = useMemo(() => mergeGroupRecords(local.data ?? [], cloud ?? []), [cloud, local.data]);
  const detailRequests = useMemo<RequestForQueries>(() => {
    const queries: RequestForQueries = {};
    if (userId && isConnected) {
      for (const group of data) {
        const cloudId =
          typeof group.cloudId === 'string'
            ? group.cloudId
            : typeof group._id === 'string'
              ? group._id
              : '';
        if (cloudId) {
          queries[`detail:${cloudId}`] = {
            query: api.groups.queries.detail,
            args: { groupId: cloudId as Id<'groups'> },
          };
        }
      }
    }
    return queries;
  }, [data, isConnected, userId]);
  const groupDetails = useQueries(detailRequests) as GroupDetails;
  return {
    ...local,
    data,
    groupDetails,
    loading: local.loading || Boolean(userId && isConnected && cloud === undefined),
  };
}
