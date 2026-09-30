import type { PaginationResult } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { AvatarGender } from '../avatars/domain';

export interface GroupRangeMember extends Doc<'groupMembers'> {
  [key: string]: unknown;
  displayName: string;
  username?: string;
  avatarId?: string;
  gender?: AvatarGender;
  avatarUrl: string | null;
}

export interface GroupTransactionRangeResult {
  group: Doc<'groups'> | null;
  groupMembers: GroupRangeMember[];
  transactions: PaginationResult<Doc<'transactions'>>;
  related: {
    accounts: Array<
      Pick<Doc<'accounts'>, '_id' | 'name' | 'ownerId' | 'type' | 'customType' | 'currency'>
    >;
    categories: Doc<'categories'>[];
    groups: Doc<'groups'>[];
    payers: Doc<'expensePayers'>[];
    participants: Doc<'expenseParticipants'>[];
    tags: Doc<'transactionTags'>[];
    receipts: Doc<'receipts'>[];
    people: Array<{
      _id: Id<'users'>;
      displayName?: string;
      username?: string;
      avatarId?: string;
      gender?: AvatarGender;
      avatarUrl: string | null;
      avatarStorageId?: string;
    }>;
  };
  payersAndParticipants: Array<{
    transactionId: Id<'transactions'>;
    payers: Doc<'expensePayers'>[];
    participants: Doc<'expenseParticipants'>[];
  }>;
}

export interface GroupSettlementRangeResult {
  group: Doc<'groups'> | null;
  groupMembers: GroupRangeMember[];
  settlements: PaginationResult<Doc<'settlements'>>;
}
