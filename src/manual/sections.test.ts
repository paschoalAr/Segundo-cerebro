import { describe, expect, it } from 'vitest';
import { DEFAULT_MANUAL, MANUAL_SECTIONS, appendToSection } from './sections';

describe('manual', () => {
  it('conteúdo inicial tem todas as seções, vazias', () => {
    for (const s of MANUAL_SECTIONS) expect(DEFAULT_MANUAL).toContain(`## ${s}`);
  });

  it('appendToSection adiciona bullet no fim da seção certa', () => {
    const out = appendToSection(DEFAULT_MANUAL, 'Pessoas', 'Aniversário da mãe: 20/09, costumo viajar');
    const pessoas = out.split('## Pessoas')[1].split('## Regras de planejamento')[0];
    expect(pessoas).toContain('- Aniversário da mãe: 20/09, costumo viajar');
    expect(out.split('## Faculdade')[1].split('## Trabalho')[0]).not.toContain('Aniversário');
  });

  it('appendToSection preserva bullets existentes e ordem', () => {
    const base = appendToSection(DEFAULT_MANUAL, 'Faculdade', 'Prova de Redes = 6h');
    const out = appendToSection(base, 'Faculdade', 'Prova de Comp. Paralela = 4h');
    const fac = out.split('## Faculdade')[1].split('## Trabalho')[0];
    expect(fac.indexOf('Redes')).toBeLessThan(fac.indexOf('Paralela'));
  });

  it('appendToSection cria a seção no fim se ela sumiu do texto', () => {
    const out = appendToSection('# Manual\n\n## Perfil\n', 'Trabalho', 'Home office às sextas');
    expect(out).toContain('## Trabalho\n\n- Home office às sextas');
  });

  it('rejeita seção desconhecida', () => {
    expect(() => appendToSection(DEFAULT_MANUAL, 'Hobbies', 'x')).toThrow(/seção/i);
  });

  it('achata quebras de linha na linha adicionada e rejeita vazio', () => {
    const out = appendToSection(DEFAULT_MANUAL, 'Perfil', 'foo\r\n## Trabalho\nbar');
    expect(out.match(/^## Trabalho$/gm)).toHaveLength(1);
    expect(out).toContain('- foo ## Trabalho bar');
    expect(() => appendToSection(DEFAULT_MANUAL, 'Perfil', '  \n ')).toThrow(/vazia/i);
  });
});
