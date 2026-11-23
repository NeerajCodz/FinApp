export function isGroupInvitationOffline(network: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return network.isConnected === false || network.isInternetReachable === false;
}
