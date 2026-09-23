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

export type PlacedItem = GridItem & {
  day: number;
  topPct: number;
  heightPct: number;
  /** Faixa horizontal dentro da coluna, 0-based. */
  lane: number;
  /** Quantas faixas o grupo de sobreposição deste item usa. */
  lanes: number;
};

function rangeMinutes(range: HourRange): number {
  return (range.endHour - range.startHour) * 60;
}

/**
 * Posiciona os itens de UM dia. Dois passos:
 *
 * 1. Agrupa em "grupos de sobreposição": itens encadeados por cruzamento. Um grupo
 *    fecha quando começa um item depois do fim mais tardio visto até ali.
 * 2. Dentro do grupo, cada item pega a primeira faixa livre (a que terminou antes dele).
 *    A largura sai da contagem de faixas DO GRUPO, não do dia inteiro — senão um único
 *    par de eventos sobrepostos de manhã espremeria a tarde toda.
 *
 * Encostar não é cruzar: fim 10:00 e começo 10:00 dividem faixa sem conflito.
 */
export function placeDay(items: GridItem[], range: HourRange): PlacedItem[] {
  const total = rangeMinutes(range);
  const floor = range.startHour * 60;

  const sorted = [...items].sort((a, b) => {
    const byStart = a.start.getTime() - b.start.getTime();
    if (byStart !== 0) return byStart;
    return itemEnd(b).getTime() - itemEnd(a).getTime();
  });

  const out: PlacedItem[] = [];
  let group: PlacedItem[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  const closeGroup = () => {
    for (const placed of group) placed.lanes = laneEnds.length;
    out.push(...group);
    group = [];
    laneEnds = [];
    groupEnd = -Infinity;
  };

  for (const item of sorted) {
    const startMin = minutesOfDay(item.start);
    const end = itemEnd(item);
    // Evento que atravessa a meia-noite termina "depois" do fim da faixa deste dia.
    const endMin = sameCalendarDay(item.start, end) ? minutesOfDay(end) : range.endHour * 60;

    if (startMin >= groupEnd) closeGroup();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endMin);
    } else {
      laneEnds[lane] = endMin;
    }
    groupEnd = Math.max(groupEnd, endMin);

    const top = Math.max(0, startMin - floor);
    const drawnMinutes = Math.max(MIN_ITEM_MINUTES, endMin - startMin);
    const height = Math.max(0, Math.min(drawnMinutes, total - top));

    group.push({
      ...item,
      day: 0,
      topPct: (top / total) * 100,
      heightPct: (height / total) * 100,
      lane,
      lanes: 1,
    });
  }
  closeGroup();

  return out;
}

/** Posiciona a semana inteira: separa por coluna, posiciona cada dia, descarta o que caiu fora. */
export function placeWeek(items: GridItem[], weekStart: Date, range: HourRange): PlacedItem[] {
  const byDay = new Map<number, GridItem[]>();
  for (const item of items) {
    const day = dayIndex(item.start, weekStart);
    if (day === -1) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  const out: PlacedItem[] = [];
  for (const [day, dayItems] of byDay) {
    for (const placed of placeDay(dayItems, range)) out.push({ ...placed, day });
  }
  return out;
}

/** Altura da linha "agora" em %, ou null quando a hora atual está fora da faixa desenhada. */
export function nowLinePct(now: Date, range: HourRange): number | null {
  const minutes = minutesOfDay(now);
  const floor = range.startHour * 60;
  const total = rangeMinutes(range);
  if (minutes < floor || minutes > floor + total) return null;
  return ((minutes - floor) / total) * 100;
}

/** A semana visível é a semana em que `now` cai? Só então a linha de agora faz sentido. */
export function isSameWeek(weekStart: Date, now: Date): boolean {
  return dayIndex(now, weekStart) !== -1;
}
