import { Email } from '@convex-dev/auth/providers/Email';

export function resendOtpProvider(id: string, purpose: 'verify' | 'reset') {
  return Email({
    id,
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.AUTH_EMAIL_FROM ?? 'Finapp <onboarding@resend.dev>',
    maxAge: 10 * 60,
    async generateVerificationToken() {
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
    },
    async sendVerificationRequest({ identifier, provider, token }) {
      if (!provider.apiKey) throw new Error('Email delivery is not configured.');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: provider.from,
          to: [identifier],
          subject: purpose === 'verify' ? 'Verify your Finapp email' : 'Reset your Finapp password',
          text:
            purpose === 'verify'
              ? `Your Finapp verification code is ${token}. It expires in 10 minutes. If you did not create a Finapp account, ignore this email.`
              : `Your Finapp password reset code is ${token}. It expires in 10 minutes. If you did not request a reset, ignore this email.`,
        }),
      });
      if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
    },
  });
}
