import { describe, expect, it } from 'vitest';
import { isCacheStale } from './cache';

describe('isCacheStale', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  it('fresco dentro do TTL', () => {
    expect(isCacheStale(new Date('2026-09-22T10:00:00Z'), now, 6 * 60 * 60 * 1000)).toBe(false);
  });

  it('vencido fora do TTL', () => {
    expect(isCacheStale(new Date('2026-09-22T05:00:00Z'), now, 6 * 60 * 60 * 1000)).toBe(true);
  });
});
