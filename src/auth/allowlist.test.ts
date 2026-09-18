import { describe, expect, it } from 'vitest';
import { isAllowedEmail } from './allowlist';

describe('isAllowedEmail', () => {
  it('aceita o e-mail permitido, ignorando caixa e espaços', () => {
    expect(isAllowedEmail(' Arthur@Gmail.com ', 'arthur@gmail.com')).toBe(true);
  });

  it('rejeita qualquer outro', () => {
    expect(isAllowedEmail('outro@gmail.com', 'arthur@gmail.com')).toBe(false);
  });

  it('rejeita vazio/indefinido', () => {
    expect(isAllowedEmail(undefined, 'arthur@gmail.com')).toBe(false);
    expect(isAllowedEmail('arthur@gmail.com', '')).toBe(false);
  });
});
