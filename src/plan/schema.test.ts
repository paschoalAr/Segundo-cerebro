import { describe, expect, it } from 'vitest';
import { PlanOutputSchema } from './schema';

const VALID: unknown = {
  inbox: [
    { id: 1, interpretation: { type: 'fact', kind: 'event', title: 'Reunião', date: '2026-09-25T14:00:00-03:00', end_date: null, all_day: false } },
    { id: 2, interpretation: { type: 'question', text: 'Vai viajar no aniversário da mãe?' } },
    { id: 3, interpretation: { type: 'ignore', why: 'já processado antes' } },
  ],
  blocks: {
    create: [{ title: 'Estudar Redes', start: '2026-09-26T09:00:00-03:00', end: '2026-09-26T11:00:00-03:00', kind: 'study', fact_id: null, reason: 'P1 na terça' }],
    update: [{ id: 10, title: 'Estudar Redes (revisão)', start: '2026-09-26T09:00:00-03:00', end: '2026-09-26T11:30:00-03:00', reason: 'ajuste de duração' }],
    delete: [{ id: 11, reason: 'já não é mais necessário' }],
  },
  conflicts: [{ text: 'Sexta tem 3 provas e só 4h livres', severity: 'warn' }],
  questions: [{ text: 'Prefere estudar de manhã ou à noite?', context: { motivo: 'padrão não claro no manual' } }],
  manual_suggestions: [{ section: 'Faculdade', text: 'Prova de Redes = 6h de estudo', from_question_id: null }],
  summary: 'Semana com 2 provas e 1 entrega.',
};

describe('PlanOutputSchema', () => {
  it('aceita uma saída válida completa', () => {
    expect(PlanOutputSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejeita kind de bloco desconhecido', () => {
    const bad = JSON.parse(JSON.stringify(VALID));
    bad.blocks.create[0].kind = 'lazer';
    expect(PlanOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('aceita as categorias novas de trabalho, prova e entrega', () => {
    for (const kind of ['work', 'class', 'exam', 'assignment', 'personal', 'travel']) {
      const ok = JSON.parse(JSON.stringify(VALID));
      ok.blocks.create[0].kind = kind;
      expect(PlanOutputSchema.safeParse(ok).success, kind).toBe(true);
    }
  });

  it('rejeita os kinds antigos que sairam do vocabulario', () => {
    for (const kind of ['task', 'buffer']) {
      const bad = JSON.parse(JSON.stringify(VALID));
      bad.blocks.create[0].kind = kind;
      expect(PlanOutputSchema.safeParse(bad).success, kind).toBe(false);
    }
  });

  it('rejeita interpretation.type desconhecido', () => {
    const bad = JSON.parse(JSON.stringify(VALID));
    bad.inbox[0].interpretation.type = 'evento';
    expect(PlanOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('aceita listas vazias em tudo (semana sem novidade)', () => {
    expect(
      PlanOutputSchema.safeParse({
        inbox: [],
        blocks: { create: [], update: [], delete: [] },
        conflicts: [],
        questions: [],
        manual_suggestions: [],
        summary: 'Nada novo esta semana.',
      }).success,
    ).toBe(true);
  });
});
