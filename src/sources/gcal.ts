import { getValidAccessToken } from '@/src/google/token';
import { listCalendarList, listEvents, mapGcalEventToFact } from '@/src/google/calendar';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { getCollectionWindow } from '@/src/facts/window';
import type { FactInput } from '@/src/facts/repo';

export async function fetchGcalFacts(): Promise<FactInput[]> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);
  const calendars = await listCalendarList(accessToken);
  const { start, end } = getCollectionWindow();

  const facts: FactInput[] = [];
  for (const cal of calendars) {
    if (cal.id === cerebroId) continue;
    const events = await listEvents(accessToken, cal.id, start, end);
    for (const event of events) facts.push(mapGcalEventToFact(cal.id, event));
  }
  return facts;
}
