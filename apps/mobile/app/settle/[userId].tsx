import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Deep link to the settle-up hub with a person (and optionally a group) pre-selected. */
export default function SettlementScreen() {
  const params = useLocalSearchParams<{
    userId?: string | string[];
    groupId?: string | string[];
  }>();
  const member = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  return (
    <Redirect
      href={{
        pathname: '/settle/new',
        params: { ...(member ? { member } : {}), ...(groupId ? { groupId } : {}) },
      }}
    />
  );
}
