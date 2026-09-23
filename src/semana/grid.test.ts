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

import { isSameWeek, nowLinePct, placeDay, placeWeek } from './grid';

describe('placeDay — posição vertical', () => {
  const range = { startHour: 7, endHour: 23 }; // 960 minutos

  it('9h–11h começa a 12,5% e ocupa 12,5% de uma faixa 7h–23h', () => {
    const [p] = placeDay([item({ key: 'a', start: at(21, 9), end: at(21, 11) })], range);
    expect(p.topPct).toBeCloseTo(12.5, 5);
    expect(p.heightPct).toBeCloseTo(12.5, 5);
  });

  it('o primeiro minuto da faixa fica no topo exato', () => {
    const [p] = placeDay([item({ key: 'a', start: at(21, 7), end: at(21, 8) })], range);
    expect(p.topPct).toBe(0);
  });

  it('fato sem hora de fim ocupa uma hora', () => {
    const [p] = placeDay([item({ key: 'a', kind: 'fact', start: at(21, 9), end: null })], range);
    expect(p.heightPct).toBeCloseTo(6.25, 5);
  });

  it('evento de 10 minutos ainda desenha com a altura mínima de 30', () => {
    const [p] = placeDay([item({ key: 'a', start: at(21, 9), end: at(21, 9, 10) })], range);
    expect(p.heightPct).toBeCloseTo((30 / 960) * 100, 5);
  });

  it('evento que passa do fim da faixa é cortado, nunca vaza da grade', () => {
    const [p] = placeDay([item({ key: 'a', start: at(21, 22), end: at(22, 2) })], range);
    expect(p.topPct + p.heightPct).toBeLessThanOrEqual(100);
  });

  it('evento que começa antes da faixa é grudado no topo', () => {
    const [p] = placeDay([item({ key: 'a', start: at(21, 5), end: at(21, 8) })], range);
    expect(p.topPct).toBe(0);
    expect(p.heightPct).toBeGreaterThan(0);
  });
});

describe('placeDay — faixas paralelas', () => {
  const range = { startHour: 7, endHour: 23 };

  it('eventos que não se cruzam ficam os dois em largura cheia', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 10) }),
        item({ key: 'b', start: at(21, 11), end: at(21, 12) }),
      ],
      range,
    );
    expect(out.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('dois que se cruzam dividem a coluna ao meio', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 11) }),
        item({ key: 'b', start: at(21, 10), end: at(21, 12) }),
      ],
      range,
    );
    expect(out.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('encostar não é cruzar: 9–10 e 10–11 ficam em largura cheia', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 10) }),
        item({ key: 'b', start: at(21, 10), end: at(21, 11) }),
      ],
      range,
    );
    expect(out.every((p) => p.lanes === 1)).toBe(true);
  });

  it('três simultâneos viram três faixas', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 12) }),
        item({ key: 'b', start: at(21, 9, 30), end: at(21, 11) }),
        item({ key: 'c', start: at(21, 10), end: at(21, 10, 30) }),
      ],
      range,
    );
    expect(out.map((p) => p.lane)).toEqual([0, 1, 2]);
    expect(out.every((p) => p.lanes === 3)).toBe(true);
  });

  it('faixa liberada é reaproveitada pelo próximo evento do mesmo grupo', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 13) }),
        item({ key: 'b', start: at(21, 9, 30), end: at(21, 10) }),
        item({ key: 'c', start: at(21, 10, 30), end: at(21, 11) }),
      ],
      range,
    );
    expect(out.find((p) => p.key === 'c')!.lane).toBe(1);
    expect(out.every((p) => p.lanes === 2)).toBe(true);
  });

  it('um grupo apertado não estreita o evento solto mais tarde no dia', () => {
    const out = placeDay(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 11) }),
        item({ key: 'b', start: at(21, 9, 30), end: at(21, 10) }),
        item({ key: 'c', start: at(21, 15), end: at(21, 16) }),
      ],
      range,
    );
    expect(out.find((p) => p.key === 'c')!.lanes).toBe(1);
  });

  it('a entrada fora de ordem não muda o resultado', () => {
    const out = placeDay(
      [
        item({ key: 'b', start: at(21, 10), end: at(21, 12) }),
        item({ key: 'a', start: at(21, 9), end: at(21, 11) }),
      ],
      range,
    );
    expect(out.find((p) => p.key === 'a')!.lane).toBe(0);
    expect(out.find((p) => p.key === 'b')!.lane).toBe(1);
  });
});

describe('placeWeek', () => {
  const weekStart = at(21, 0);

  it('espalha os itens pelas colunas certas', () => {
    const out = placeWeek(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 10) }),
        item({ key: 'b', start: at(24, 9), end: at(24, 10) }),
      ],
      weekStart,
      { startHour: 7, endHour: 23 },
    );
    expect(out.find((p) => p.key === 'a')!.day).toBe(0);
    expect(out.find((p) => p.key === 'b')!.day).toBe(3);
  });

  it('cada dia tem suas próprias faixas — sobreposição na segunda não afeta a terça', () => {
    const out = placeWeek(
      [
        item({ key: 'a', start: at(21, 9), end: at(21, 11) }),
        item({ key: 'b', start: at(21, 10), end: at(21, 12) }),
        item({ key: 'c', start: at(22, 10), end: at(22, 12) }),
      ],
      weekStart,
      { startHour: 7, endHour: 23 },
    );
    expect(out.find((p) => p.key === 'c')!.lanes).toBe(1);
  });

  it('item fora da semana é descartado em vez de virar coluna -1', () => {
    const out = placeWeek([item({ key: 'fora', start: at(29, 9), end: at(29, 10) })], weekStart, DEFAULT_HOURS);
    expect(out).toEqual([]);
  });
});

describe('nowLinePct', () => {
  const range = { startHour: 7, endHour: 23 };

  it('meio-dia numa faixa 7h–23h fica em 31,25%', () => {
    expect(nowLinePct(at(23, 12), range)).toBeCloseTo(31.25, 5);
  });

  it('antes do começo e depois do fim da faixa devolve null', () => {
    expect(nowLinePct(at(23, 6), range)).toBeNull();
    expect(nowLinePct(at(23, 23, 30), range)).toBeNull();
  });

  it('a borda de cima conta como dentro', () => {
    expect(nowLinePct(at(23, 7), range)).toBe(0);
  });
});

describe('isSameWeek', () => {
  it('reconhece a semana de hoje pelos dois extremos', () => {
    expect(isSameWeek(at(21, 0), at(21, 0, 1))).toBe(true);
    expect(isSameWeek(at(21, 0), at(27, 23, 59))).toBe(true);
  });

  it('recusa a semana anterior e a seguinte', () => {
    expect(isSameWeek(at(21, 0), at(20, 23, 59))).toBe(false);
    expect(isSameWeek(at(21, 0), at(28, 0, 1))).toBe(false);
  });
});
