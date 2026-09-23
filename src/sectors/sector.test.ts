import { describe, expect, it } from 'vitest';
import { SECTORS, SECTOR_LABELS, isSector } from './sector';

describe('SECTORS', () => {
  it('tem os seis setores na ordem da roda', () => {
    expect(SECTORS).toEqual(['estudos', 'carreira', 'financas', 'saude', 'projetos', 'pessoal']);
  });

  it('usa slug sem acento e sem cedilha — vira URL sem escape', () => {
    for (const s of SECTORS) expect(s).toMatch(/^[a-z]+$/);
  });
});

describe('SECTOR_LABELS', () => {
  it('tem rótulo para todo setor, com acento onde o português pede', () => {
    for (const s of SECTORS) expect(SECTOR_LABELS[s].length).toBeGreaterThan(0);
    expect(SECTOR_LABELS.financas).toBe('Finanças');
    expect(SECTOR_LABELS.saude).toBe('Saúde');
  });
});

describe('isSector', () => {
  it('aceita os seis', () => {
    for (const s of SECTORS) expect(isSector(s)).toBe(true);
  });

  it('recusa qualquer outra coisa', () => {
    expect(isSector('faculdade')).toBe(false);
    expect(isSector('Estudos')).toBe(false);
    expect(isSector('estudos ')).toBe(false);
    expect(isSector(null)).toBe(false);
    expect(isSector(undefined)).toBe(false);
    expect(isSector(3)).toBe(false);
  });
});
