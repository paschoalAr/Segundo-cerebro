import { describe, expect, it } from 'vitest';
import { getCollectionWindow } from './window';

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('getCollectionWindow', () => {
  it('vai de hoje 00:00 até +21 dias 23:59:59, no horário local', () => {
    const now = new Date(2026, 8, 22, 15, 30); // 22/09/2026 15:30 local
    const { start, end } = getCollectionWindow(now);
    expect(ymd(start)).toBe('2026-09-22');
    expect(start.getHours()).toBe(0);
    expect(ymd(end)).toBe('2026-10-13');
    expect(end.getHours()).toBe(23);
  });
});
