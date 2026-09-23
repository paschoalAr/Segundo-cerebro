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

  it('explica de onde sai um fact_id, pra nao confundir com id de item da inbox', () => {
    const texto = buildSystemPrompt()[0].text;
    expect(texto).toContain('fact_id');
    expect(texto).toContain('inbox');
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

describe('setor no prompt', () => {
  const base = {
    manual: '# Manual',
    knowledge: [] as never[],
    today: new Date(2026, 8, 23),
    weekStart: new Date(2026, 8, 21),
    weekEnd: new Date(2026, 8, 27),
    observations: [] as string[],
    inboxItems: [] as never[],
    answeredQuestions: [] as never[],
    manualChangedSinceLastRun: false,
  };

  it('mostra o setor de cada fato', () => {
    const [, variable] = buildUserContent({
      ...base,
      facts: [
        { source: 'moodle', kind: 'deadline', title: 'Entrega TCC', date: new Date(2026, 8, 30), sector: 'estudos' },
      ],
      blocks: [],
    });
    expect(variable.text).toContain('{estudos}');
    expect(variable.text).toContain('Entrega TCC');
  });

  it('mostra o setor de cada bloco', () => {
    const [, variable] = buildUserContent({
      ...base,
      facts: [],
      blocks: [
        {
          id: 7,
          kind: 'study',
          status: 'planned',
          title: 'Estudar Redes',
          start: new Date(2026, 8, 24, 9),
          end: new Date(2026, 8, 24, 11),
          sector: 'estudos',
        },
      ],
    });
    expect(variable.text).toContain('#7');
    expect(variable.text).toContain('{estudos}');
  });

  it('linha sem setor aparece como {sem setor}, não some nem vira "null"', () => {
    const [, variable] = buildUserContent({
      ...base,
      facts: [{ source: 'gcal', kind: 'event', title: 'Algo solto', date: new Date(2026, 8, 24), sector: null }],
      blocks: [],
    });
    expect(variable.text).toContain('{sem setor}');
    expect(variable.text).not.toContain('{null}');
  });

  it('o system prompt deixa claro que a Claude não escolhe setor', () => {
    expect(buildSystemPrompt()[0].text).toContain('você não escolhe nem altera setor');
  });
});
