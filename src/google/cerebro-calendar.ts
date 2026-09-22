import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { createCerebroCalendar, listCalendarList, pickCerebroCalendar } from './calendar';

export async function getCerebroCalendarId(accessToken: string): Promise<string> {
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
