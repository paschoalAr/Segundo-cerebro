import { describe, expect, it } from 'vitest';
import { MAX_BLOCK_MINUTES, MIN_BLOCK_MINUTES, parseBlockRange, sanitizeTaskId, sortTasks, taskUrgency } from './task';

const at = (day: number, h = 12, m = 0) => new Date(2026, 8, day, h, m, 0, 0);
const NOW = at(23, 10); // quarta 23/09/2026, 10h

function task(partial: { id: number; due?: Date | null; createdAt?: Date; title?: string }) {
  return {
    id: partial.id,
    title: partial.title ?? `t${partial.id}`,
    due: partial.due ?? null,
    createdAt: partial.createdAt ?? at(1),
  };
}

describe('taskUrgency', () => {
  it('sem prazo é "none"', () => {
    expect(taskUrgency(task({ id: 1 }), NOW)).toBe('none');
  });

  it('prazo que já passou é "overdue"', () => {
    expect(taskUrgency(task({ id: 1, due: at(22, 23, 59) }), NOW)).toBe('overdue');
  });

  it('prazo mais cedo hoje, mas ainda no dia de hoje, é "today" e não "overdue"', () => {
    expect(taskUrgency(task({ id: 1, due: at(23, 8) }), NOW)).toBe('today');
  });

  it('prazo ainda hoje, mais tarde, é "today"', () => {
    expect(taskUrgency(task({ id: 1, due: at(23, 23, 59) }), NOW)).toBe('today');
  });

  it('prazo nos próximos 3 dias é "soon"', () => {
    expect(taskUrgency(task({ id: 1, due: at(24, 9) }), NOW)).toBe('soon');
    expect(taskUrgency(task({ id: 1, due: at(26, 9) }), NOW)).toBe('soon');
  });

  it('prazo mais longe é "later"', () => {
    expect(taskUrgency(task({ id: 1, due: at(30, 9) }), NOW)).toBe('later');
  });
});

describe('sortTasks', () => {
  it('atrasada vem primeiro, depois por prazo, e sem prazo por último', () => {
    const out = sortTasks(
      [
        task({ id: 1, due: at(30) }),
        task({ id: 2 }),
        task({ id: 3, due: at(20) }),
        task({ id: 4, due: at(24) }),
      ],
      NOW,
    );
    expect(out.map((t) => t.id)).toEqual([3, 4, 1, 2]);
  });

  it('entre duas sem prazo, a mais recente vem antes', () => {
    const out = sortTasks([task({ id: 1, createdAt: at(1) }), task({ id: 2, createdAt: at(10) })], NOW);
    expect(out.map((t) => t.id)).toEqual([2, 1]);
  });

  it('empate de prazo cai no id, pra ordem ser estável entre renders', () => {
    const out = sortTasks([task({ id: 9, due: at(24) }), task({ id: 2, due: at(24) })], NOW);
    expect(out.map((t) => t.id)).toEqual([2, 9]);
  });

  it('não muta a lista recebida', () => {
    const input = [task({ id: 1, due: at(30) }), task({ id: 2, due: at(20) })];
    sortTasks(input, NOW);
    expect(input.map((t) => t.id)).toEqual([1, 2]);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(sortTasks([], NOW)).toEqual([]);
  });
});

describe('parseBlockRange', () => {
  it('lê o valor de um input datetime-local como horário local', () => {
    const out = parseBlockRange('2026-09-24T09:00', '90');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.start.getHours()).toBe(9);
    expect(out.start.getDate()).toBe(24);
    expect(out.end.getTime() - out.start.getTime()).toBe(90 * 60_000);
  });

  it('recusa data vazia ou inválida', () => {
    expect(parseBlockRange('', '60').ok).toBe(false);
    expect(parseBlockRange('amanhã de manhã', '60').ok).toBe(false);
    expect(parseBlockRange('2026-13-45T99:99', '60').ok).toBe(false);
  });

  it('recusa duração fora dos limites, mas aceita as bordas', () => {
    expect(parseBlockRange('2026-09-24T09:00', String(MIN_BLOCK_MINUTES - 1)).ok).toBe(false);
    expect(parseBlockRange('2026-09-24T09:00', String(MAX_BLOCK_MINUTES + 1)).ok).toBe(false);
    expect(parseBlockRange('2026-09-24T09:00', String(MIN_BLOCK_MINUTES)).ok).toBe(true);
    expect(parseBlockRange('2026-09-24T09:00', String(MAX_BLOCK_MINUTES)).ok).toBe(true);
  });

  it('recusa duração que não é número', () => {
    expect(parseBlockRange('2026-09-24T09:00', 'uma hora').ok).toBe(false);
    expect(parseBlockRange('2026-09-24T09:00', '').ok).toBe(false);
    expect(parseBlockRange('2026-09-24T09:00', '60.5').ok).toBe(false);
  });
});

describe('sanitizeTaskId', () => {
  it('mantém o id quando a tarefa existe e está aberta', () => {
    expect(sanitizeTaskId(7, [3, 7, 9])).toBe(7);
  });

  it('descarta id inventado em vez de estourar a foreign key', () => {
    expect(sanitizeTaskId(42, [3, 7, 9])).toBeNull();
  });

  it('null continua null', () => {
    expect(sanitizeTaskId(null, [3])).toBeNull();
  });
});
