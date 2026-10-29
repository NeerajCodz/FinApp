import { beforeEach, describe, expect, it, vi } from 'vitest';

const oauth = vi.hoisted(() => ({
  mutation: vi.fn(),
  prepareSigner: vi.fn(),
  signAccessToken: vi.fn(),
}));

vi.mock('@/lib/mcp/oauth', () => ({
  mcpResourceUrl: () => 'https://finapp.test/mcp',
  convexClient: () => ({ mutation: oauth.mutation }),
  prepareMcpAccessTokenSigner: oauth.prepareSigner,
}));

import { POST } from '../../apps/web/app/oauth/token/route';

const encoder = new TextEncoder();
const limit = 16_384;
const validForm = new URLSearchParams({
  grant_type: 'authorization_code',
  code: 'authorization-code',
  client_id: 'client-one',
  redirect_uri: 'https://client.test/callback',
  code_verifier: 'verifier-one',
  resource: 'https://finapp.test/mcp',
}).toString();

function streamedRequest(chunks: Uint8Array[], contentLength?: string) {
  let consumed = 0;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (consumed === chunks.length) controller.close();
        else controller.enqueue(chunks[consumed++]);
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  if (contentLength !== undefined) headers.set('Content-Length', contentLength);
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  };
  return {
    request: new Request('https://finapp.test/oauth/token', init),
    cancel,
    consumed: () => consumed,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  oauth.mutation.mockResolvedValue({
    userId: 'user-one',
    grantId: 'grant-one',
    scopes: ['finapp:read'],
  });
  oauth.prepareSigner.mockResolvedValue(oauth.signAccessToken);
  oauth.signAccessToken.mockResolvedValue('signed-access-token');
});

describe('OAuth token request body limit', () => {
  it.each([undefined, '1'])(
    'cancels an oversized stream with Content-Length %s before trailing chunks',
    async (contentLength) => {
      const stream = streamedRequest(
        [new Uint8Array(limit), encoder.encode('x'), new Uint8Array(limit * 4)],
        contentLength,
      );

      const response = await POST(stream.request);

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: 'invalid_request' });
      expect(stream.cancel).toHaveBeenCalledOnce();
      expect(stream.consumed()).toBe(2);
      expect(oauth.mutation).not.toHaveBeenCalled();
    },
  );

  it('counts UTF-8 bytes rather than decoded characters at the boundary', async () => {
    const prefix = `${validForm}&padding=`;
    const text = prefix + 'a'.repeat(limit - encoder.encode(prefix).byteLength - 1) + 'é';
    expect(text.length).toBe(limit);
    const bytes = encoder.encode(text);
    const stream = streamedRequest([
      bytes.subarray(0, limit),
      bytes.subarray(limit),
      encoder.encode('unread trailing data'),
    ]);

    const response = await POST(stream.request);

    expect(response.status).toBe(413);
    expect(stream.cancel).toHaveBeenCalledOnce();
    expect(stream.consumed()).toBe(2);
    expect(oauth.mutation).not.toHaveBeenCalled();
  });

  it('exchanges an exactly-at-limit form with a multibyte character split across chunks', async () => {
    const prefix = `${validForm}&padding=`;
    const bytes = encoder.encode(
      prefix + 'a'.repeat(limit - encoder.encode(prefix).byteLength - 2) + 'é',
    );
    expect(bytes.byteLength).toBe(limit);
    const stream = streamedRequest([bytes.subarray(0, limit - 1), bytes.subarray(limit - 1)]);

    const response = await POST(stream.request);

    expect(response.status).toBe(200);
    expect(stream.cancel).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
  });

  it('returns invalid_request for a malformed form', async () => {
    const stream = streamedRequest([encoder.encode('grant_type=%&code=incomplete')]);

    const response = await POST(stream.request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(oauth.mutation).not.toHaveBeenCalled();
  });

  it('returns invalid_request if reading the stream fails after receiving data', async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (pulls++ === 0) controller.enqueue(encoder.encode(validForm));
          else controller.error(new Error('Body read failed'));
        },
      },
      { highWaterMark: 0 },
    );
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      duplex: 'half',
    };

    const response = await POST(new Request('https://finapp.test/oauth/token', init));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(oauth.mutation).not.toHaveBeenCalled();
  });

  it('preserves invalid_grant errors for bounded forms', async () => {
    oauth.mutation.mockRejectedValue(new Error('Invalid authorization code'));
    const stream = streamedRequest([encoder.encode(validForm)]);

    const response = await POST(stream.request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_grant' });
    expect(oauth.signAccessToken).not.toHaveBeenCalled();
  });

  it('reports an unexpected signing failure as a server error, not invalid_grant', async () => {
    oauth.signAccessToken.mockRejectedValue(new Error('Signing unavailable'));
    const stream = streamedRequest([encoder.encode(validForm)]);
    const response = await POST(stream.request);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'server_error' });
  });
});
