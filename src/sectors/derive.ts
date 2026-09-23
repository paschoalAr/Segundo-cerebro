import type { BlockKind } from '@/src/plan/categories';
import { isSector, type Sector } from './sector';

export type CalendarSectorMap = Readonly<Record<string, Sector>>;

/** Fatos só precisam da fonte e do `meta` pra ter setor derivado. */
export type FactLike = {
  source: 'moodle' | 'gcal' | 'outlook' | 'inbox';
  meta: Record<string, unknown>;
};

/**
 * `SECTOR_CALENDAR_MAP` no `.env`: JSON de id de calendário do Google para setor.
 * Qualquer coisa fora do formato vira mapa vazio — um `.env` torto degrada o app para
 * "sem setor", nunca o derruba no boot.
 */
export function parseCalendarSectorMap(raw: string | undefined): CalendarSectorMap {
  if (!raw || raw.trim() === '') return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const out: Record<string, Sector> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isSector(value)) out[key] = value;
  }
  return out;
}

export function deriveFactSector(fact: FactLike, map: CalendarSectorMap = {}): Sector | null {
  switch (fact.source) {
    case 'moodle':
      return 'estudos';
    case 'outlook':
      return 'carreira';
    case 'gcal': {
      const calendarId = fact.meta.calendarId;
      if (typeof calendarId !== 'string') return null;
      return map[calendarId] ?? null;
    }
    case 'inbox':
      return null;
  }
}

const BLOCK_KIND_SECTOR: Record<BlockKind, Sector | null> = {
  study: 'estudos',
  class: 'estudos',
  exam: 'estudos',
  assignment: 'estudos',
  work: 'carreira',
  personal: 'pessoal',
  travel: null,
};

/**
 * Bloco ligado a um fato herda o setor dele — é a informação mais forte que existe
 * (uma viagem até a PUCRS é estudos; até a Galapos, carreira). Sem fato, a categoria é
 * o melhor palpite disponível.
 */
export function deriveBlockSector(kind: BlockKind, factSector: Sector | null = null): Sector | null {
  return factSector ?? BLOCK_KIND_SECTOR[kind];
}
