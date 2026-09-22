import { describe, expect, it } from 'vitest';
import { pickLatestVersion } from './claude-cli';

describe('pickLatestVersion', () => {
  it('escolhe a versão mais alta por comparação numérica, não alfabética', () => {
    expect(pickLatestVersion(['2.1.9', '2.1.275', '2.1.30'])).toBe('2.1.275');
  });

  it('retorna null pra lista vazia', () => {
    expect(pickLatestVersion([])).toBeNull();
  });

  it('ignora entradas que não parecem versão (ex.: pastas soltas na mesma árvore)', () => {
    expect(pickLatestVersion(['2.1.5', 'not-a-version', '2.2.0'])).toBe('2.2.0');
  });
});
