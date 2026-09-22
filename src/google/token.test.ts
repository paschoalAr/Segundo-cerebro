import { describe, expect, it } from 'vitest';
import { isExpired } from './token';

describe('isExpired', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  it('trata null como expirado', () => {
    expect(isExpired(null, now)).toBe(true);
  });

  it('considera expirado dentro da margem de segurança (60s)', () => {
    expect(isExpired(new Date('2026-09-22T12:00:30Z'), now)).toBe(true);
  });

  it('considera válido fora da margem', () => {
    expect(isExpired(new Date('2026-09-22T12:05:00Z'), now)).toBe(false);
  });
});
