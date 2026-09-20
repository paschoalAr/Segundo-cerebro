import { db } from '@/src/db';
import { oauthTokens } from '@/src/db/schema';
import { encrypt } from '@/src/crypto/tokens';

export async function saveGoogleRefreshToken(refreshToken: string) {
  const enc = encrypt(refreshToken);
  await db
    .insert(oauthTokens)
    .values({ provider: 'google', refreshTokenEnc: enc, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { refreshTokenEnc: enc, updatedAt: new Date() },
    });
}
