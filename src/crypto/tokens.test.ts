import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './tokens';

const key = Buffer.alloc(32, 7).toString('base64');

describe('tokens', () => {
  it('cifra e decifra de volta ao original', () => {
    const enc = encrypt('1//refresh-token-xyz', key);
    expect(enc).not.toContain('refresh-token');
    expect(decrypt(enc, key)).toBe('1//refresh-token-xyz');
  });

  it('gera saídas diferentes para o mesmo texto (IV aleatório)', () => {
    expect(encrypt('a', key)).not.toBe(encrypt('a', key));
  });

  it('rejeita chave com tamanho errado', () => {
    expect(() => encrypt('a', Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('rejeita texto cifrado adulterado', () => {
    const enc = encrypt('segredo', key);
    const [iv, tag, data] = enc.split(':');
    expect(() => decrypt(`${iv}:${tag}:${data.slice(0, -2)}AA`, key)).toThrow();
  });

  it('rejeita tag de autenticação truncada', () => {
    const enc = encrypt('segredo', key);
    const [iv, tag, data] = enc.split(':');
    const shortTag = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => decrypt(`${iv}:${shortTag}:${data}`, key)).toThrow();
  });
});
