import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OTP_MAX_AGE_SECONDS,
  resendOtpProvider,
  sendTwoFactorEmail,
} from '../../convex/shared/email';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Resend OTP email provider', () => {
  it('generates six-digit codes with a ten-minute lifetime', async () => {
    const provider = resendOtpProvider('verify-test', 'verify');
    const generate = provider.options.generateVerificationToken;

    expect(generate).toBeDefined();
    expect(provider.options.maxAge).toBe(OTP_MAX_AGE_SECONDS);
    expect(await generate!()).toMatch(/^\d{6}$/);
  });

  it.each([
    ['verify', 'Verify your Finapp email', 'verification code', 'Verify your email'],
    ['reset', 'Reset your Finapp password', 'password reset code', 'Reset your password'],
  ] as const)(
    'sends a %s code only to its destination',
    async (purpose, subject, bodyPhrase, heading) => {
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
      expect(payload.html).toContain('<h1');
      expect(payload.html).toContain(heading);
      expect(payload.html).toContain('004281');
      expect(payload.html).toContain('10 minutes');
    },
  );
  it('sends the second-factor code with sign-in-specific copy', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await sendTwoFactorEmail('person@example.com', '004281');

    const payload = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(payload).toMatchObject({
      from: 'Finapp <mail@example.com>',
      to: ['person@example.com'],
      subject: 'Your Finapp sign-in code',
    });
    expect(payload.text).toContain('two-factor sign-in code');
    expect(payload.text).toContain('004281');
    expect(payload.html).toContain('Complete your sign-in');
    expect(payload.html).toContain('Never share this code');
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
