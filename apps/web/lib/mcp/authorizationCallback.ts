type AuthorizationCallbackRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
};

type RegisteredClient = {
  clientId: string;
  redirectUris: readonly string[];
};

export function authorizationDenialUrl(
  request: AuthorizationCallbackRequest | null,
  client: RegisteredClient | null | undefined,
): string | null {
  if (
    !request ||
    !request.state ||
    !client ||
    client.clientId !== request.clientId ||
    !client.redirectUris.includes(request.redirectUri)
  ) {
    return null;
  }

  const callback = new URL(request.redirectUri);
  callback.searchParams.set('error', 'access_denied');
  callback.searchParams.set('state', request.state);
  return callback.toString();
}
