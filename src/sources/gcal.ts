import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { getValidAccessToken } from '@/src/google/token';
import {
  createCerebroCalendar,
  listCalendarList,
  listEvents,
  mapGcalEventToFact,
  pickCerebroCalendar,
} from '@/src/google/calendar';
import { getCollectionWindow } from '@/src/facts/window';
import type { FactInput } from '@/src/facts/repo';

async function getCerebroCalendarId(accessToken: string): Promise<string> {
  const cached = await db.query.sourcesCache.findFirst({
    where: eq(sourcesCache.source, 'cerebro_calendar'),
  });
  if (cached) return (cached.payload as { id: string }).id;

  const calendars = await listCalendarList(accessToken);
  const id = pickCerebroCalendar(calendars) ?? (await createCerebroCalendar(accessToken));

  await db
    .insert(sourcesCache)
    .values({ source: 'cerebro_calendar', payload: { id }, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: { id }, fetchedAt: new Date() } });

  return id;
}

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
