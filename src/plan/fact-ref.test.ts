import { describe, expect, it } from 'vitest';
import { sanitizeFactId } from './fact-ref';

describe('sanitizeFactId', () => {
  const existentes = [30, 127, 208, 210];

  it('mantém o fact_id quando o fato existe', () => {
    expect(sanitizeFactId(210, existentes)).toBe(210);
  });

  it('descarta o id que a Claude inventou em vez de estourar a foreign key', () => {
    // O run #22 morreu aqui: ela mandou fact_id=4, que era o id do item da inbox #4.
    expect(sanitizeFactId(4, existentes)).toBeNull();
  });

  it('aceita null, que é o valor legítimo para bloco sem fato', () => {
    expect(sanitizeFactId(null, existentes)).toBeNull();
  });

  it('descarta tudo quando ainda não existe nenhum fato', () => {
    expect(sanitizeFactId(210, [])).toBeNull();
  });
});
