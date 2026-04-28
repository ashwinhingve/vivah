import { createAuthClient } from 'better-auth/react';
import { phoneNumberClient, twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000',
  plugins: [
    phoneNumberClient(),
    twoFactorClient({
      // After a successful sign-in for a 2FA-enabled user, the server returns
      // `twoFactorRedirect: true`. The client plugin invokes this callback so
      // we can route to the challenge page. URL is stable so the page can
      // call `authClient.twoFactor.verifyTotp(...)` from there.
      onTwoFactorRedirect: () => {
        if (typeof window !== 'undefined') window.location.href = '/two-factor';
      },
    }),
  ],
});
