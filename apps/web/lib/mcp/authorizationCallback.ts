type AuthorizationCallbackRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
};

type RegisteredClient = {
  clientId: string;
  redirectUris: readonly string[];
};

/** Our issuer (RFC 9207 `iss`); the consent page is served from the issuer's origin. */
export function currentIssuer(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export function authorizationDenialUrl(
  request: AuthorizationCallbackRequest | null,
  client: RegisteredClient | null | undefined,
  issuer: string = currentIssuer(),
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
  if (issuer) callback.searchParams.set('iss', issuer);
  return callback.toString();
}
