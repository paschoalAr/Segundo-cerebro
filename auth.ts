import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAllowedEmail } from '@/src/auth/allowlist';
import { saveGoogleRefreshToken } from '@/src/auth/tokens-repo';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          // offline + consent: é o único jeito de o Google devolver refresh_token.
          access_type: 'offline',
          prompt: 'consent',
          scope: `openid email profile ${CALENDAR_SCOPE}`,
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ profile, account }) {
      if (!isAllowedEmail(profile?.email)) return false;
      if (account?.refresh_token) await saveGoogleRefreshToken(account.refresh_token);
      return true;
    },
  },
});
