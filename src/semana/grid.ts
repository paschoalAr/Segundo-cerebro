/**
 * Matemática da grade da Semana. Tudo aqui é puro e não toca em DOM: o componente
 * (`app/(app)/semana/week-grid.tsx`) só consome o que estas funções devolvem.
 */

export type GridItem = {
  /** Chave única e estável: 'fact-12' ou 'block-7'. */
  key: string;
  kind: 'fact' | 'block';
  title: string;
  start: Date;
  /** Fato sem hora de fim vem null — vira `DEFAULT_DURATION_MIN`. */
  end: Date | null;
  allDay: boolean;
  /** Pinta de --alert: prova, entrega, atrasado. */
  alert: boolean;
  /** Só pra fatos: 'event' | 'deadline' | 'task' | 'info'. */
  factKind?: string;
  /** Só pra blocos: a categoria (`BLOCK_KINDS`). */
  blockKind?: string;
  /** Só pra blocos: 'planned' | 'done' | 'skipped' — vira `data-status` no CSS. */
  status?: string;
  /** Texto pequeno no rodapé do evento (hoje: a fonte do fato ou a categoria do bloco). */
  tag?: string | null;
};

export type HourRange = { startHour: number; endHour: number };

/** Faixa padrão: cobre o dia útil do Arthur sem deixar a grade gigante. */
export const DEFAULT_HOURS: HourRange = { startHour: 7, endHour: 23 };

/** Fato sem `end` ocupa uma hora na grade. */
export const DEFAULT_DURATION_MIN = 60;

/** Nenhum evento desenha com menos que isto, senão vira um risco ilegível. */
export const MIN_ITEM_MINUTES = 30;

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Entrega (`deadline`) mora na faixa de dia todo mesmo tendo hora: o `23:59` do Moodle
 * não é informação de horário, é "é nesse dia". Prova com hora real fica na grade.
 */
export function isAllDayItem(item: GridItem): boolean {
  return item.allDay || item.factKind === 'deadline';
}

export function splitItems(items: GridItem[]): { allDay: GridItem[]; timed: GridItem[] } {
  const allDay: GridItem[] = [];
  const timed: GridItem[] = [];
  for (const item of items) (isAllDayItem(item) ? allDay : timed).push(item);
  return { allDay, timed };
}

function itemEnd(item: GridItem): Date {
  if (item.end !== null) return item.end;
  return new Date(item.start.getTime() + DEFAULT_DURATION_MIN * 60_000);
}

/**
 * A faixa padrão nunca encolhe — ela só cresce pra caber o item mais extremo da semana.
 * Assim a grade não muda de tamanho toda vez que o Arthur navega de semana.
 */
export function hourRange(items: GridItem[], base: HourRange = DEFAULT_HOURS): HourRange {
  let startHour = base.startHour;
  let endHour = base.endHour;

  for (const item of items) {
    if (isAllDayItem(item)) continue;
    startHour = Math.min(startHour, item.start.getHours());

    const end = itemEnd(item);
    // Evento que vira o dia "termina" antes de começar se olharmos só a hora: ele estica
    // a faixa até o fim do dia, e `placeDay` corta o que passa da borda.
    const crossesMidnight = !sameCalendarDay(item.start, end);
    const endMin = end.getHours() * 60 + end.getMinutes();
    endHour = Math.max(endHour, crossesMidnight ? 24 : Math.ceil(endMin / 60));
  }

  return { startHour: Math.max(0, startHour), endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}

/** Coluna 0..6 (segunda..domingo) ou -1 se a data está fora da semana. */
export function dayIndex(date: Date, weekStart: Date): number {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(weekStart).getTime()) / 86_400_000);
  return days >= 0 && days <= 6 ? days : -1;
}
