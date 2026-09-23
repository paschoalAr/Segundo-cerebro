/** Bloco criado pela mão não pode ser mais curto que isso nem virar um dia inteiro. */
export const MIN_BLOCK_MINUTES = 15;
export const MAX_BLOCK_MINUTES = 480;

/** Quantos dias à frente ainda contam como "logo". */
const SOON_DAYS = 3;

export type TaskUrgency = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export type SortableTask = {
  id: number;
  due: Date | null;
  createdAt: Date;
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Prazo de hoje que já passou de hora ainda é "today", não "overdue": o dia não acabou,
 * e chamar de atrasado às 10h uma coisa marcada pras 8h só ensina a ignorar o vermelho.
 */
export function taskUrgency(task: { due: Date | null }, now: Date): TaskUrgency {
  if (task.due === null) return 'none';
  if (sameDay(task.due, now)) return 'today';
  if (task.due.getTime() < now.getTime()) return 'overdue';

  const days = (task.due.getTime() - now.getTime()) / 86_400_000;
  return days <= SOON_DAYS ? 'soon' : 'later';
}

const URGENCY_ORDER: Record<TaskUrgency, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };

/**
 * Atrasada primeiro, depois por prazo mais próximo, e o que não tem prazo por último —
 * entre as sem prazo, a mais recente antes, porque é a que ainda está na cabeça dele.
 * Empate cai no id pra ordem não dançar entre um render e outro.
 */
export function sortTasks<T extends SortableTask>(tasks: T[], now: Date): T[] {
  return [...tasks].sort((a, b) => {
    const byUrgency = URGENCY_ORDER[taskUrgency(a, now)] - URGENCY_ORDER[taskUrgency(b, now)];
    if (byUrgency !== 0) return byUrgency;

    if (a.due !== null && b.due !== null && a.due.getTime() !== b.due.getTime()) {
      return a.due.getTime() - b.due.getTime();
    }
    if (a.due === null && b.due === null && a.createdAt.getTime() !== b.createdAt.getTime()) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    return a.id - b.id;
  });
}

export type BlockRangeResult = { ok: true; start: Date; end: Date } | { ok: false; error: string };

/**
 * Lê o par (datetime-local, duração em minutos) do formulário "virar bloco".
 * `new Date('2026-09-24T09:00')` sem fuso é interpretado como **hora local** pelo JS —
 * que é exatamente o que o input entrega e o que o Arthur quis dizer.
 */
export function parseBlockRange(startRaw: string, durationRaw: string): BlockRangeResult {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startRaw)) {
    return { ok: false, error: 'Data e hora inválidas.' };
  }
  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'Data e hora inválidas.' };

  if (!/^\d+$/.test(durationRaw)) return { ok: false, error: 'Duração precisa ser um número de minutos.' };
  const minutes = Number(durationRaw);
  if (minutes < MIN_BLOCK_MINUTES || minutes > MAX_BLOCK_MINUTES) {
    return { ok: false, error: `Duração precisa ficar entre ${MIN_BLOCK_MINUTES} e ${MAX_BLOCK_MINUTES} minutos.` };
  }

  return { ok: true, start, end: new Date(start.getTime() + minutes * 60_000) };
}

/**
 * Mesma ideia de `sanitizeFactId` (`src/plan/fact-ref.ts`): a Claude pode citar o id de
 * uma tarefa que não existe mais ou que ela inventou. Degradar pra `null` custa o vínculo;
 * deixar passar custa o run inteiro numa violação de foreign key.
 */
export function sanitizeTaskId(taskId: number | null, openTaskIds: readonly number[]): number | null {
  if (taskId === null) return null;
  return openTaskIds.includes(taskId) ? taskId : null;
}
