import { describe, expect, it } from 'vitest';
import { authorizationDenialUrl } from '../../apps/web/lib/mcp/authorizationCallback';

const redirectUri = 'https://client.example/callback?workspace=personal&error=old&state=old';
const request = {
  clientId: 'registered-client',
  redirectUri,
  state: 'original state + & = ? / #',
};
const client = {
  clientId: request.clientId,
  redirectUris: [redirectUri],
};

describe('MCP authorization denial callback', () => {
  it('returns access_denied and the original state to the registered URI without losing its query', () => {
    const destination = new URL(authorizationDenialUrl(request, client)!);

    expect(destination.origin).toBe('https://client.example');
    expect(destination.pathname).toBe('/callback');
    expect(destination.searchParams.get('workspace')).toBe('personal');
    expect(destination.searchParams.getAll('error')).toEqual(['access_denied']);
    expect(destination.searchParams.getAll('state')).toEqual([request.state]);
  });

  it('does not produce an external callback for an invalid authorization request', () => {
    expect(authorizationDenialUrl(null, client)).toBeNull();
    expect(authorizationDenialUrl({ ...request, state: '' }, client)).toBeNull();
  });

  it('does not produce an external callback before client registration is verified', () => {
    expect(authorizationDenialUrl(request, undefined)).toBeNull();
    expect(authorizationDenialUrl(request, null)).toBeNull();
    expect(authorizationDenialUrl(request, { ...client, clientId: 'another-client' })).toBeNull();
  });

  it.each([
    'https://attacker.example/callback',
    'https://client.example/callback?workspace=other',
    'https://client.example/callback/extra',
    'not-a-url',
  ])('rejects an unregistered redirect URI: %s', (unregisteredUri) => {
    expect(authorizationDenialUrl({ ...request, redirectUri: unregisteredUri }, client)).toBeNull();
  });

  it('uses the exact registered loopback return address for a native client', () => {
    const loopbackUri = 'http://127.0.0.1:8123/callback?session=local';
    const destination = new URL(
      authorizationDenialUrl(
        { ...request, redirectUri: loopbackUri },
        { ...client, redirectUris: [loopbackUri] },
      )!,
    );

    expect(destination.origin).toBe('http://127.0.0.1:8123');
    expect(destination.searchParams.get('session')).toBe('local');
    expect(destination.searchParams.get('error')).toBe('access_denied');
    expect(destination.searchParams.get('state')).toBe(request.state);
  });
});
