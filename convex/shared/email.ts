import { Email } from '@convex-dev/auth/providers/Email';

export const OTP_MAX_AGE_SECONDS = 10 * 60;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

type OtpPurpose = 'verify' | 'reset' | 'two-factor';

function otpEmailTemplate(purpose: OtpPurpose, token: string) {
  const content = {
    verify: {
      subject: 'Verify your Finapp email',
      title: 'Verify your email',
      action:
        'Use this code to verify your email address and finish setting up your Finapp account.',
      text: `Your Finapp verification code is ${token}. It expires in 10 minutes. If you did not create a Finapp account, ignore this email.`,
      notice: 'If you did not create a Finapp account, you can safely ignore this email.',
    },
    reset: {
      subject: 'Reset your Finapp password',
      title: 'Reset your password',
      action: 'Use this code to securely reset your Finapp password.',
      text: `Your Finapp password reset code is ${token}. It expires in 10 minutes. If you did not request a reset, ignore this email.`,
      notice: 'If you did not request a password reset, you can safely ignore this email.',
    },
    'two-factor': {
      subject: 'Your Finapp sign-in code',
      title: 'Complete your sign-in',
      action: 'Enter this code in Finapp to finish signing in. Never share this code with anyone.',
      text: `Your Finapp two-factor sign-in code is ${token}. It expires in 10 minutes. If you did not try to sign in, ignore this email and secure your account.`,
      notice: 'If you did not try to sign in, ignore this email and secure your account.',
    },
  }[purpose];
  const safeToken = escapeHtml(token);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${content.title} · Finapp</title>
  </head>
  <body style="margin:0;background:#f1f3ef;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#171914;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${content.action}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e1e4dc;border-radius:20px;">
            <tr>
              <td style="padding:28px 32px 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="14" height="14" style="width:14px;height:14px;border-radius:50%;background:#a3ff3b;"></td>
                    <td style="padding-left:9px;font-size:16px;font-weight:700;letter-spacing:-0.3px;">Finapp</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;">
                <p style="margin:0 0 12px;color:#6b7065;font-size:11px;font-weight:700;letter-spacing:1.5px;">PRIVATE MONEY, CLEARLY</p>
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;letter-spacing:-0.6px;">${content.title}</h1>
                <p style="margin:0 0 22px;color:#50554b;font-size:15px;line-height:1.6;">${content.action}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#f4f6f1;border-radius:14px;">
                  <tr>
                    <td align="center" style="padding:18px 12px;">
                      <p style="margin:0;color:#181a15;font-size:30px;font-weight:700;letter-spacing:8px;line-height:1.4;">${safeToken}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;color:#50554b;font-size:14px;line-height:1.6;">This code expires in <strong>10 minutes</strong>.</p>
                <p style="margin:12px 0 0;color:#777c71;font-size:13px;line-height:1.6;">${content.notice}</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#777c71;font-size:12px;line-height:1.5;">Finapp · Your money, your people, one clear place.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject: content.subject, text: content.text, html };
}

export function generateOtp(): string {
  const digits: number[] = [];
  const random = new Uint8Array(32);
  while (digits.length < 6) {
    crypto.getRandomValues(random);
    for (const byte of random) {
      if (byte < 250) digits.push(byte % 10);
      if (digits.length === 6) break;
    }
  }
  return digits.join('');
}

async function sendOtpEmail(
  purpose: OtpPurpose,
  recipient: string,
  token: string,
  apiKey: string | undefined,
  from: string,
) {
  if (!apiKey) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      ...otpEmailTemplate(purpose, token),
    }),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
}

export function sendTwoFactorEmail(recipient: string, token: string) {
  return sendOtpEmail(
    'two-factor',
    recipient,
    token,
    process.env.AUTH_RESEND_KEY,
    process.env.AUTH_EMAIL_FROM ?? 'Finapp <onboarding@resend.dev>',
  );
}

export function resendOtpProvider(id: string, purpose: 'verify' | 'reset') {
  return Email({
    id,
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.AUTH_EMAIL_FROM ?? 'Finapp <onboarding@resend.dev>',
    maxAge: OTP_MAX_AGE_SECONDS,

    generateVerificationToken: generateOtp,
    async sendVerificationRequest({ identifier, provider, token }) {
      await sendOtpEmail(
        purpose,
        identifier,
        token,
        provider.apiKey,
        provider.from ?? 'Finapp <onboarding@resend.dev>',
      );
    },
  });
}
