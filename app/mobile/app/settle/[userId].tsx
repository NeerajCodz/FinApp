import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SettlementScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const member = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  return <Redirect href={{ pathname: '/settle/new', params: member ? { member } : {} }} />;
}
