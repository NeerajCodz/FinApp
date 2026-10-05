import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyProfileRedirect() {
  const { username: routeUsername } = useLocalSearchParams<{ username?: string | string[] }>();
  const value = Array.isArray(routeUsername) ? routeUsername[0] : routeUsername;
  const username = value?.replace(/^@+/, '').trim().toLowerCase() ?? '';

  return /^[a-z0-9_]{3,32}$/.test(username) ? (
    <Redirect href={`/@${username}` as never} />
  ) : (
    <Redirect href="/(tabs)/people" />
  );
}
