import ICAL from 'ical.js';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { isCacheStale } from '@/src/facts/cache';
import type { FactInput } from '@/src/facts/repo';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function mapIcsToFacts(icsText: string): FactInput[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents('vevent');

  return vevents.map((vevent): FactInput => {
    const event = new ICAL.Event(vevent);
    return {
      kind: 'event',
      title: event.summary || '(sem título)',
      date: event.startDate.toJSDate(),
      endDate: event.endDate ? event.endDate.toJSDate() : null,
      allDay: event.startDate.isDate,
      source: 'outlook',
      sourceRef: event.uid,
      meta: {},
    };
  });
}

async function fetchIcsText(): Promise<string> {
  const url = process.env.OUTLOOK_ICS_URL ?? '';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar .ics do Outlook: ${res.status}`);
  return res.text();
}

export async function fetchOutlookFacts(): Promise<FactInput[]> {
  const url = process.env.OUTLOOK_ICS_URL ?? '';
  if (!url) return [];

  const cached = await db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'outlook') });

  let icsText: string;
  if (cached && !isCacheStale(cached.fetchedAt, new Date(), CACHE_TTL_MS)) {
    icsText = (cached.payload as { icsText: string }).icsText;
  } else {
    icsText = await fetchIcsText();
    await db
      .insert(sourcesCache)
      .values({ source: 'outlook', payload: { icsText }, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: { icsText }, fetchedAt: new Date() } });
  }

  return mapIcsToFacts(icsText);
}
