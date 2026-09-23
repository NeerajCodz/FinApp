import { afterEach, describe, expect, it, vi } from 'vitest';
import { resendOtpProvider } from '../../convex/shared/email';

afterEach(() => vi.unstubAllGlobals());

describe('Resend OTP email provider', () => {
  it('generates six-digit codes with a ten-minute lifetime', async () => {
    const provider = resendOtpProvider('verify-test', 'verify');
    const generate = provider.options.generateVerificationToken;

    expect(generate).toBeDefined();
    expect(provider.options.maxAge).toBe(600);
    expect(await generate!()).toMatch(/^\d{6}$/);
  });

  it.each([
    ['verify', 'Verify your Finapp email', 'verification code'],
    ['reset', 'Reset your Finapp password', 'password reset code'],
  ] as const)('sends a %s code only to its destination', async (purpose, subject, bodyPhrase) => {
    const provider = resendOtpProvider(`test-${purpose}`, purpose);
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await provider.sendVerificationRequest(
      {
        identifier: 'person@example.com',
        token: '004281',
        provider: { ...provider, apiKey: 're_test_key', from: 'Finapp <mail@example.com>' },
        url: 'https://app.example.com/verify',
        expires: new Date('2026-09-24T12:10:00Z'),
        request: new Request('https://app.example.com'),
        theme: undefined,
      },
      {} as never,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const payload = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(payload).toMatchObject({
      from: 'Finapp <mail@example.com>',
      to: ['person@example.com'],
      subject,
    });
    expect(payload.text).toContain(bodyPhrase);
    expect(payload.text).toContain('004281');
  });

  it('rejects missing API credentials and rejected delivery responses', async () => {
    const provider = resendOtpProvider('verify-test', 'verify');
    const params = {
      identifier: 'person@example.com',
      token: '123456',
      provider: { ...provider, apiKey: undefined },
      url: 'https://app.example.com/verify',
      expires: new Date(),
      request: new Request('https://app.example.com'),
      theme: undefined,
    } as Parameters<typeof provider.sendVerificationRequest>[0];

    await expect(provider.sendVerificationRequest(params, {} as never)).rejects.toThrow(
      'Email delivery is not configured.',
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(
      provider.sendVerificationRequest(
        {
          ...params,
          provider: { ...provider, apiKey: 're_test_key' },
        },
        {} as never,
      ),
    ).rejects.toThrow('Email delivery failed (403).');
  });
});
