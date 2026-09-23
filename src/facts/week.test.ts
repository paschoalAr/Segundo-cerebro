import { describe, expect, it } from 'vitest';
import { addWeeks, formatWeekLabel, getWeekRange } from './week';

describe('getWeekRange', () => {
  it('acha segunda a domingo quando a data é quarta', () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 23)); // quarta 23/09/2026
    expect(start.getDate()).toBe(21);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(27);
    expect(end.getHours()).toBe(23);
  });

  it('quando a data é domingo, a semana já começou na segunda anterior', () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 27)); // domingo 27/09/2026
    expect(start.getDate()).toBe(21);
    expect(end.getDate()).toBe(27);
  });

  it('quando a data é segunda, a semana começa nela mesma', () => {
    const { start } = getWeekRange(new Date(2026, 8, 21)); // segunda 21/09/2026
    expect(start.getDate()).toBe(21);
  });
});

describe('addWeeks', () => {
  it('soma semanas preservando o dia da semana', () => {
    expect(addWeeks(new Date(2026, 8, 23), 1).getDate()).toBe(30);
  });

  it('aceita offset negativo', () => {
    expect(addWeeks(new Date(2026, 8, 23), -1).getDate()).toBe(16);
  });
});

describe('formatWeekLabel', () => {
  it('formata dd/mm – dd/mm', () => {
    expect(formatWeekLabel(new Date(2026, 8, 21), new Date(2026, 8, 27))).toBe('21/09 – 27/09');
  });
});
