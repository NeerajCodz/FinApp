import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { resendOtpProvider } from './shared/email';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: resendOtpProvider('resend-email-verification', 'verify'),
      reset: resendOtpProvider('resend-password-reset', 'reset'),
      validatePasswordRequirements: (password) => {
        if (password.length < 8) throw new Error('PASSWORD_TOO_SHORT');
      },
    }),
  ],
});
