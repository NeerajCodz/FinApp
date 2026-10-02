import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OTP_MAX_AGE_SECONDS,
  resendOtpProvider,
  sendAppLockResetEmail,
  sendTwoFactorEmail,
} from '../../convex/shared/email';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function expectFinappEmailBranding(payload: { html: string; attachments: unknown }) {
  expect(payload.html).toContain('background-color:#050505');
  expect(payload.html).toContain('#b7ff4a');
  expect(payload.html).toContain('src="cid:finapp-logo"');
  expect(payload.attachments).toMatchObject([
    { filename: 'finapp-logo.png', content_id: 'finapp-logo' },
  ]);
}

describe('Resend OTP email provider', () => {
  it('generates six-digit codes with a ten-minute lifetime', async () => {
    const provider = resendOtpProvider('verify-test', 'verify');
    const generate = provider.options.generateVerificationToken;

    expect(generate).toBeDefined();
    expect(provider.options.maxAge).toBe(OTP_MAX_AGE_SECONDS);
    expect(await generate!()).toMatch(/^\d{6}$/);
  });

  it.each([
    ['verify', 'Your Finapp verification code', 'verify your email', 'Verify your email'],
    [
      'reset',
      'Your Finapp password reset code',
      'reset your Finapp password',
      'Reset your password',
    ],
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
      expectFinappEmailBranding(payload);
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
    expect(payload.text).toContain('Never share it with anyone.');
    expect(payload.text).toContain('004281');
    expect(payload.html).toContain('Finish signing in');
    expect(payload.html).toContain('Never share it with anyone.');
    expectFinappEmailBranding(payload);
  });
  it('sends the branded app passcode reset template', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
    vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await sendAppLockResetEmail('person@example.com', '004281');

    const payload = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(payload).toMatchObject({
      from: 'Finapp <mail@example.com>',
      to: ['person@example.com'],
      subject: 'Your Finapp app passcode reset code',
    });
    expect(payload.text).toContain('reset the passcode on this device');
    expect(payload.text).toContain('004281');
    expect(payload.html).toContain('Reset your app passcode');
    expectFinappEmailBranding(payload);
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
