import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserContent } from './prompt';

describe('buildSystemPrompt', () => {
  it('menciona as regras de comportamento e as seções válidas do manual', () => {
    const blocks = buildSystemPrompt();
    const text = blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/Idempotente/);
    expect(text).toMatch(/Passado é imutável/);
    expect(text).toContain('Perfil');
    expect(text).toContain('Regras de planejamento');
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('explica cada categoria de bloco para a Claude escolher certo', () => {
    const texto = buildSystemPrompt()[0].text;
    for (const kind of ['work', 'class', 'exam', 'assignment', 'study', 'personal', 'travel']) {
      expect(texto, kind).toContain(kind);
    }
    expect(texto).toContain('Galapos');
    expect(texto).not.toContain('buffer');
  });
});

describe('buildUserContent', () => {
  const base = {
    manual: '# Manual\n\n## Faculdade\n- Prova de Redes = 6h',
    knowledge: [{ title: 'TCC Estado', content: 'Projeto Ressoa...' }],
    today: new Date(2026, 8, 22),
    weekStart: new Date(2026, 8, 21),
    weekEnd: new Date(2026, 8, 27),
    facts: [] as never[],
    blocks: [] as never[],
    observations: [] as string[],
    inboxItems: [] as never[],
    answeredQuestions: [] as never[],
    manualChangedSinceLastRun: false,
  };

  it('bloco estável contém o manual e o conhecimento, com cache_control', () => {
    const content = buildUserContent(base);
    expect(content[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(content[0].text).toContain('Prova de Redes = 6h');
    expect(content[0].text).toContain('TCC Estado');
  });

  it('bloco variável contém a data de hoje e não tem cache_control', () => {
    const content = buildUserContent(base);
    expect(content[1].cache_control).toBeUndefined();
    expect(content[1].text).toContain('22/09/2026');
  });

  it('lista vazia de facts/blocos/observações não quebra e mostra placeholder', () => {
    const content = buildUserContent(base);
    expect(content[1].text).toMatch(/\(nenhum/);
  });
});

describe('manual alterado desde o último run', () => {
  const base = {
    manual: '# Manual',
    knowledge: [] as never[],
    today: new Date(2026, 8, 23),
    weekStart: new Date(2026, 8, 21),
    weekEnd: new Date(2026, 8, 27),
    facts: [] as never[],
    blocks: [] as never[],
    observations: [] as string[],
    inboxItems: [] as never[],
    answeredQuestions: [] as never[],
  };

  it('avisa no bloco variável quando o manual mudou', () => {
    const [, variable] = buildUserContent({ ...base, manualChangedSinceLastRun: true });
    expect(variable.text).toContain('O manual mudou desde o último run');
  });

  it('não inventa o aviso quando o manual está igual', () => {
    const [, variable] = buildUserContent({ ...base, manualChangedSinceLastRun: false });
    expect(variable.text).not.toContain('O manual mudou');
  });

  it('o system prompt trata manual alterado como novidade', () => {
    expect(buildSystemPrompt()[0].text).toContain('manual mudou');
  });
});
