import { getValidAccessToken } from '@/src/google/token';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { listEvents, type GCalEvent } from '@/src/google/calendar';
import { listPlannedBlocksWithGcalId } from './blocks-repo';

export type ObservableBlock = { id: number; title: string; start: Date; gcalEventId: string | null };

export function computeObservations(
  blocks: ObservableBlock[],
  events: Pick<GCalEvent, 'id' | 'summary' | 'start' | 'extendedProperties'>[],
): string[] {
  const byBlockId = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    const blockId = e.extendedProperties?.private?.block_id;
    if (blockId) byBlockId.set(blockId, e);
  }

  const observations: string[] = [];
  for (const block of blocks) {
    if (!block.gcalEventId) continue;
    const event = byBlockId.get(String(block.id));

    if (!event) {
      observations.push(`Arthur removeu "${block.title}" do calendário Cérebro.`);
      continue;
    }

    const eventStart = new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
    if (eventStart.getTime() !== block.start.getTime() || event.summary !== block.title) {
      observations.push(
        `Arthur moveu/editou "${block.title}": agora está como "${event.summary ?? block.title}" em ${eventStart.toLocaleString('pt-BR')}.`,
      );
    }
  }
  return observations;
}

/** Janela -7d..+21d (spec §4.1) — pega tanto o que já rolou nos últimos 7 dias quanto o horizonte de coleta. */
function getObservationWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 21);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function fetchObservations(): Promise<string[]> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);
  const { start, end } = getObservationWindow();

  const [blocks, events] = await Promise.all([
    listPlannedBlocksWithGcalId(),
    listEvents(accessToken, cerebroId, start, end),
  ]);

  return computeObservations(blocks, events);
}
