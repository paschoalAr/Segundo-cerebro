import { parseCalendarSectorMap, type CalendarSectorMap } from './derive';

/** Lido a cada chamada de propósito: scripts e o servidor carregam `.env` em momentos
 * diferentes, e o custo de um `JSON.parse` de duas linhas é irrelevante. */
export function calendarSectorMap(): CalendarSectorMap {
  return parseCalendarSectorMap(process.env.SECTOR_CALENDAR_MAP);
}
