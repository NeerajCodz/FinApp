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

type OtpPurpose = 'verify' | 'reset' | 'two-factor' | 'app-lock-reset';

const EMAIL_LOGO_CID = 'finapp-logo';
const EMAIL_LOGO_PNG_URL =
  'https://raw.githubusercontent.com/NeerajCodz/FinApp/main/apps/mobile/assets/icon.png';

function otpEmailTemplate(purpose: OtpPurpose, token: string) {
  const content = {
    verify: {
      subject: 'Your Finapp verification code',
      title: 'Verify your email',
      eyebrow: 'EMAIL VERIFICATION',
      action: 'Enter this one-time code to verify your email and finish creating your account.',
      notice: 'If you did not create a Finapp account, you can safely ignore this message.',
    },
    reset: {
      subject: 'Your Finapp password reset code',
      title: 'Reset your password',
      eyebrow: 'PASSWORD RESET',
      action: 'Enter this one-time code to securely reset your Finapp password.',
      notice: 'If you did not request a password reset, no action is needed.',
    },
    'two-factor': {
      subject: 'Your Finapp sign-in code',
      title: 'Finish signing in',
      eyebrow: 'SECURE SIGN-IN',
      action: 'Enter this one-time code on the sign-in screen. Never share it with anyone.',
      notice: 'If you did not try to sign in, change your password and secure your account.',
    },
    'app-lock-reset': {
      subject: 'Your Finapp app passcode reset code',
      title: 'Reset your app passcode',
      eyebrow: 'DEVICE SECURITY',
      action: 'Enter this one-time code in Finapp to reset the passcode on this device.',
      notice: 'If you did not request this reset, no action is needed.',
    },
  }[purpose];
  const safeToken = escapeHtml(token);
  const expiryMinutes = OTP_MAX_AGE_SECONDS / 60;
  const text = [
    content.action,
    `Your one-time code: ${token}`,
    `This code expires in ${expiryMinutes} minutes.`,
    content.notice,
    'Finapp · Your money, your people, one clear place.',
  ].join('\n\n');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${content.title} · Finapp</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-gutter { padding: 24px 12px !important; }
        .email-content { padding-right: 22px !important; padding-left: 22px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#050505;color:#f5f7f1;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${content.action}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#050505" style="width:100%;border-collapse:collapse;background-color:#050505;">
      <tr>
        <td class="email-gutter" align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#10120e" style="width:100%;max-width:560px;border:1px solid #2c3027;border-collapse:separate;border-spacing:0;background-color:#10120e;border-radius:16px;">
            <tr>
              <td height="4" bgcolor="#b7ff4a" style="height:4px;background-color:#b7ff4a;border-radius:16px 16px 0 0;"></td>
            </tr>
            <tr>
              <td class="email-content" style="padding:28px 34px 10px;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding-right:12px;">
                      <img src="cid:${EMAIL_LOGO_CID}" width="40" height="40" alt="Finapp" style="display:block;width:40px;height:40px;border:0;border-radius:50%;">
                    </td>
                    <td>
                      <p style="margin:0;color:#f5f7f1;font-size:18px;font-weight:700;letter-spacing:-0.4px;">finapp<span style="color:#b7ff4a;">.</span></p>
                      <p style="margin:3px 0 0;color:#a5aa9d;font-size:11px;line-height:1.4;">Your money, in focus.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:24px 34px 34px;">
                <p style="margin:0 0 12px;color:#b7ff4a;font-size:11px;font-weight:700;letter-spacing:1.4px;">${content.eyebrow}</p>
                <h1 style="margin:0 0 14px;color:#f5f7f1;font-size:27px;font-weight:700;line-height:1.2;letter-spacing:-0.6px;">${content.title}</h1>
                <p style="margin:0 0 24px;color:#c5c9bf;font-size:15px;line-height:1.65;">${content.action}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#b7ff4a" style="width:100%;border-collapse:separate;border-spacing:0;background-color:#b7ff4a;border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:18px 12px;">
                      <p style="margin:0;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:31px;font-weight:700;letter-spacing:8px;line-height:1.35;">${safeToken}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;color:#f5f7f1;font-size:14px;line-height:1.6;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;margin-top:22px;border-collapse:collapse;">
                  <tr>
                    <td width="3" bgcolor="#b7ff4a" style="width:3px;background-color:#b7ff4a;"></td>
                    <td bgcolor="#191c16" style="padding:13px 15px;background-color:#191c16;">
                      <p style="margin:0;color:#b7bbaf;font-size:13px;line-height:1.6;">${content.notice}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;color:#858b7d;font-size:12px;line-height:1.6;">Finapp · Your money, your people, one clear place.</p>
          <p style="margin:5px 0 0;color:#656b5f;font-size:11px;line-height:1.5;">Automated account security message</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return {
    subject: content.subject,
    text,
    html,
    attachments: [
      {
        path: EMAIL_LOGO_PNG_URL,
        filename: 'finapp-logo.png',
        content_id: EMAIL_LOGO_CID,
      },
    ],
  };
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

export function sendAppLockResetEmail(recipient: string, token: string) {
  return sendOtpEmail(
    'app-lock-reset',
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
