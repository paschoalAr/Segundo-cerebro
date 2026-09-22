import type { FactInput } from '@/src/facts/repo';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export type GCalCalendarEntry = { id: string; summary: string };
export type GCalEventTime = { date?: string; dateTime?: string };
export type GCalEvent = {
  id: string;
  summary?: string;
  status: string;
  start: GCalEventTime;
  end: GCalEventTime;
};

async function gcalFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Calendar API falhou (${path}): ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function listCalendarList(accessToken: string): Promise<GCalCalendarEntry[]> {
  const data = await gcalFetch<{ items: GCalCalendarEntry[] }>(accessToken, '/users/me/calendarList');
  return data.items;
}

export function pickCerebroCalendar(items: GCalCalendarEntry[]): string | null {
  return items.find((c) => c.summary === 'Cérebro')?.id ?? null;
}

export async function createCerebroCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Cérebro' }),
  });
  if (!res.ok) throw new Error(`Falha ao criar calendário Cérebro: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GCalEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const data = await gcalFetch<{ items: GCalEvent[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  );
  return data.items.filter((e) => e.status !== 'cancelled');
}

export function mapGcalEventToFact(calendarId: string, event: GCalEvent): FactInput {
  const allDay = Boolean(event.start.date);
  const date = new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
  const endRaw = event.end.dateTime ?? (event.end.date ? `${event.end.date}T00:00:00` : undefined);

  return {
    kind: 'event',
    title: event.summary ?? '(sem título)',
    date,
    endDate: endRaw ? new Date(endRaw) : null,
    allDay,
    source: 'gcal',
    sourceRef: event.id,
    meta: { calendarId },
  };
}
