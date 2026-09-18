import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64');
  return key;
}

/** Saída: `iv:tag:dados`, tudo em base64. */
export function encrypt(plain: string, keyB64 = process.env.TOKEN_ENCRYPTION_KEY ?? ''): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

export function decrypt(payload: string, keyB64 = process.env.TOKEN_ENCRYPTION_KEY ?? ''): string {
  const key = loadKey(keyB64);
  const [iv, tag, data] = payload.split(':').map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
