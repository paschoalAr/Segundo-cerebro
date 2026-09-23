import { describe, expect, it } from 'vitest';
import { summarizeSectors } from './summary';

const d = (iso: string) => new Date(iso);

describe('summarizeSectors', () => {
  const blocks = [
    { sector: 'estudos' as const, start: d('2026-09-23T09:00:00-03:00') },
    { sector: 'estudos' as const, start: d('2026-09-24T09:00:00-03:00') },
    { sector: 'carreira' as const, start: d('2026-09-23T14:00:00-03:00') },
    { sector: null, start: d('2026-09-23T18:00:00-03:00') },
  ];
  const facts = [
    { sector: 'estudos' as const, title: 'P1 de Redes', date: d('2026-09-25T19:15:00-03:00') },
    { sector: 'estudos' as const, title: 'Entrega TCC', date: d('2026-09-30T23:59:00-03:00') },
    { sector: null, title: 'Algo solto', date: d('2026-09-24T10:00:00-03:00') },
  ];

  it('devolve os seis setores, sempre, na ordem da roda', () => {
    const out = summarizeSectors(blocks, facts);
    expect(out.map((s) => s.sector)).toEqual(['estudos', 'carreira', 'financas', 'saude', 'projetos', 'pessoal']);
  });

  it('conta os blocos da semana por setor', () => {
    const out = summarizeSectors(blocks, facts);
    expect(out.find((s) => s.sector === 'estudos')!.blockCount).toBe(2);
    expect(out.find((s) => s.sector === 'carreira')!.blockCount).toBe(1);
    expect(out.find((s) => s.sector === 'saude')!.blockCount).toBe(0);
  });

  it('o próximo compromisso é o fato mais cedo do setor', () => {
    const out = summarizeSectors(blocks, facts);
    expect(out.find((s) => s.sector === 'estudos')!.next).toEqual({
      title: 'P1 de Redes',
      date: d('2026-09-25T19:15:00-03:00'),
    });
  });

  it('setor sem nada devolve contagem zero e next nulo — nunca número inventado', () => {
    const out = summarizeSectors(blocks, facts);
    const financas = out.find((s) => s.sector === 'financas')!;
    expect(financas.blockCount).toBe(0);
    expect(financas.factCount).toBe(0);
    expect(financas.next).toBeNull();
  });

  it('acha o fato mais cedo mesmo com a entrada fora de ordem', () => {
    const out = summarizeSectors([], [
      { sector: 'saude' as const, title: 'Depois', date: d('2026-10-02T08:00:00-03:00') },
      { sector: 'saude' as const, title: 'Antes', date: d('2026-09-24T08:00:00-03:00') },
    ]);
    expect(out.find((s) => s.sector === 'saude')!.next!.title).toBe('Antes');
  });

  it('linha sem setor não some: vira a contagem de "sem setor"', () => {
    const out = summarizeSectors(blocks, facts);
    expect(out.reduce((acc, s) => acc + s.blockCount, 0)).toBe(3);
    expect(out.unassigned).toEqual({ blockCount: 1, factCount: 1 });
  });

  it('listas vazias devolvem os seis setores zerados', () => {
    const out = summarizeSectors([], []);
    expect(out).toHaveLength(6);
    expect(out.every((s) => s.blockCount === 0 && s.factCount === 0 && s.next === null)).toBe(true);
    expect(out.unassigned).toEqual({ blockCount: 0, factCount: 0 });
  });
});
