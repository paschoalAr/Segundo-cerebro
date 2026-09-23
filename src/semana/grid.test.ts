import { describe, expect, it } from 'vitest';
import { DEFAULT_HOURS, dayIndex, hourRange, splitItems, type GridItem } from './grid';

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m, 0, 0);

function item(partial: Partial<GridItem> & { key: string; start: Date }): GridItem {
  return {
    kind: 'block',
    title: 'x',
    end: null,
    allDay: false,
    alert: false,
    ...partial,
  };
}

describe('hourRange', () => {
  it('sem item nenhum, usa a faixa padrão', () => {
    expect(hourRange([])).toEqual(DEFAULT_HOURS);
    expect(DEFAULT_HOURS).toEqual({ startHour: 7, endHour: 23 });
  });

  it('não encolhe por causa de um dia curto', () => {
    expect(hourRange([item({ key: 'a', start: at(21, 10), end: at(21, 11) })])).toEqual({ startHour: 7, endHour: 23 });
  });

  it('desce pra caber uma madrugada', () => {
    expect(hourRange([item({ key: 'a', start: at(21, 5, 30), end: at(21, 6) })]).startHour).toBe(5);
  });

  it('sobe pra caber algo que termina tarde, arredondando a hora pra cima', () => {
    expect(hourRange([item({ key: 'a', start: at(21, 22), end: at(21, 23, 30) })]).endHour).toBe(24);
  });

  it('cobre o dia inteiro sem passar de 0..24', () => {
    const r = hourRange([item({ key: 'a', start: at(21, 0), end: at(21, 23, 59) })]);
    expect(r.startHour).toBe(0);
    expect(r.endHour).toBe(24);
  });

  it('evento que atravessa a meia-noite estica a faixa até 24, não até a hora do dia seguinte', () => {
    expect(hourRange([item({ key: 'a', start: at(21, 22), end: at(22, 2) })]).endHour).toBe(24);
  });

  it('ignora item de dia todo — ele não mora na grade de horas', () => {
    expect(hourRange([item({ key: 'a', start: at(21, 3), allDay: true })])).toEqual(DEFAULT_HOURS);
  });
});

describe('dayIndex', () => {
  const weekStart = at(21, 0); // segunda 21/09/2026

  it('segunda é 0 e domingo é 6', () => {
    expect(dayIndex(at(21, 10), weekStart)).toBe(0);
    expect(dayIndex(at(27, 10), weekStart)).toBe(6);
  });

  it('a hora do dia não muda a coluna', () => {
    expect(dayIndex(at(23, 0, 0), weekStart)).toBe(2);
    expect(dayIndex(at(23, 23, 59), weekStart)).toBe(2);
  });

  it('fora da semana devolve -1 dos dois lados', () => {
    expect(dayIndex(at(20, 12), weekStart)).toBe(-1);
    expect(dayIndex(at(28, 12), weekStart)).toBe(-1);
  });

  it('aceita weekStart que não está zerado na meia-noite', () => {
    expect(dayIndex(at(23, 8), at(21, 17, 42))).toBe(2);
  });
});

describe('splitItems', () => {
  it('separa dia todo de item com hora', () => {
    const out = splitItems([
      item({ key: 'a', start: at(21, 9), end: at(21, 10) }),
      item({ key: 'b', start: at(21, 0), allDay: true }),
    ]);
    expect(out.allDay.map((i) => i.key)).toEqual(['b']);
    expect(out.timed.map((i) => i.key)).toEqual(['a']);
  });

  it('entrega (deadline) vai pra faixa de dia todo mesmo tendo hora', () => {
    const out = splitItems([item({ key: 'e', kind: 'fact', factKind: 'deadline', start: at(21, 23, 59) })]);
    expect(out.allDay.map((i) => i.key)).toEqual(['e']);
    expect(out.timed).toHaveLength(0);
  });

  it('prova com hora real fica na grade', () => {
    const out = splitItems([item({ key: 'p', kind: 'block', blockKind: 'exam', start: at(22, 19, 15), end: at(22, 21) })]);
    expect(out.timed.map((i) => i.key)).toEqual(['p']);
    expect(out.allDay).toHaveLength(0);
  });

  it('lista vazia devolve dois arrays vazios', () => {
    expect(splitItems([])).toEqual({ allDay: [], timed: [] });
  });
});
