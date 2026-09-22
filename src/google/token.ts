import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { oauthTokens } from '@/src/db/schema';
import { decrypt } from '@/src/crypto/tokens';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EXPIRY_BUFFER_MS = 60_000;

export function isExpired(expiresAt: Date | null, now: Date, bufferMs = EXPIRY_BUFFER_MS): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - bufferMs <= now.getTime();
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export async function getValidAccessToken(): Promise<string> {
  const row = await db.query.oauthTokens.findFirst({ where: eq(oauthTokens.provider, 'google') });
  if (!row) throw new Error('Sem oauth_tokens para o Google — faça login primeiro');

  if (row.accessToken && !isExpired(row.expiresAt, new Date())) return row.accessToken;

  const refreshToken = decrypt(row.refreshTokenEnc);
  const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);

  await db
    .update(oauthTokens)
    .set({ accessToken, expiresAt, updatedAt: new Date() })
    .where(eq(oauthTokens.provider, 'google'));

  return accessToken;
}
