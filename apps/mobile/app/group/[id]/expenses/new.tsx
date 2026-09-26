import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function NewGroupExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/split/new', params: { groupId: id } }} />;
}
