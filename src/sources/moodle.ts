import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { isCacheStale } from '@/src/facts/cache';
import type { FactInput } from '@/src/facts/repo';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type MoodleUpcomingEvent = {
  id: number;
  name: string;
  timestart: number;
  timeduration: number;
  eventtype: string;
  course: { fullname: string } | null;
};

export type MoodleCourse = { id: number; fullname: string };

export type MoodleAssignmentsResponse = {
  courses: Array<{
    id: number;
    fullname: string;
    assignments: Array<{ id: number; name: string; duedate: number }>;
  }>;
};

export function mapMoodleUpcomingToFacts(events: MoodleUpcomingEvent[]): FactInput[] {
  return events
    .filter((e) => e.timestart > 0)
    .map(
      (e): FactInput => ({
        kind: 'event',
        title: e.course ? `${e.name} (${e.course.fullname})` : e.name,
        date: new Date(e.timestart * 1000),
        endDate: e.timeduration > 0 ? new Date((e.timestart + e.timeduration) * 1000) : null,
        allDay: false,
        source: 'moodle',
        sourceRef: `event-${e.id}`,
        meta: { eventtype: e.eventtype },
      }),
    );
}

export function mapMoodleAssignmentsToFacts(response: MoodleAssignmentsResponse): FactInput[] {
  const result: FactInput[] = [];
  for (const course of response.courses) {
    for (const a of course.assignments) {
      if (!a.duedate) continue;
      result.push({
        kind: 'deadline',
        title: `${a.name} (${course.fullname})`,
        date: new Date(a.duedate * 1000),
        endDate: null,
        allDay: false,
        source: 'moodle',
        sourceRef: `assign-${a.id}`,
        meta: { courseId: course.id },
      });
    }
  }
  return result;
}

// wstoken vai na query string porque o web service do Moodle exige isso — nunca logar
// ou lançar a URL montada aqui (ela carrega o token).
function moodleUrl(wsfunction: string, params: Record<string, string>): string {
  const base = process.env.MOODLE_URL ?? 'https://moodle.pucrs.br';
  const token = process.env.MOODLE_TOKEN ?? '';
  const qs = new URLSearchParams({ wstoken: token, moodlewsrestformat: 'json', wsfunction, ...params });
  return `${base}/webservice/rest/server.php?${qs}`;
}

// O Moodle responde HTTP 200 mesmo em erro (token inválido, userid errado etc.), com um
// corpo {exception, errorcode, message} em vez do array/objeto esperado. Sem checar isso,
// um MOODLE_TOKEN vencido vira um TypeError genérico rio abaixo em vez de um erro claro.
function assertNoMoodleException(wsfunction: string, data: unknown): void {
  if (data && typeof data === 'object' && 'exception' in data) {
    const err = data as { errorcode?: unknown; message?: unknown };
    throw new Error(`Moodle API (${wsfunction}) retornou erro: ${String(err.errorcode ?? err.message ?? 'desconhecido')}`);
  }
}

async function fetchMoodleRaw(): Promise<{ upcoming: MoodleUpcomingEvent[]; assignments: MoodleAssignmentsResponse }> {
  const userId = process.env.MOODLE_USER_ID ?? '';

  const coursesRes = await fetch(moodleUrl('core_enrol_get_users_courses', { userid: userId }));
  const coursesData: unknown = await coursesRes.json();
  assertNoMoodleException('core_enrol_get_users_courses', coursesData);
  if (!Array.isArray(coursesData)) throw new Error('Moodle API (core_enrol_get_users_courses) não retornou uma lista');
  const courses = coursesData as MoodleCourse[];

  const upcomingRes = await fetch(
    moodleUrl('core_calendar_get_calendar_upcoming_view', { courseid: '0', categoryid: '0' }),
  );
  const upcomingData: unknown = await upcomingRes.json();
  assertNoMoodleException('core_calendar_get_calendar_upcoming_view', upcomingData);
  const upcoming = (upcomingData as { events?: MoodleUpcomingEvent[] }).events ?? [];

  const courseIdParams: Record<string, string> = {};
  courses.forEach((c, i) => {
    courseIdParams[`courseids[${i}]`] = String(c.id);
  });
  const assignRes = await fetch(moodleUrl('mod_assign_get_assignments', courseIdParams));
  const assignData: unknown = await assignRes.json();
  assertNoMoodleException('mod_assign_get_assignments', assignData);
  const assignments = assignData as MoodleAssignmentsResponse;

  return { upcoming, assignments };
}

export async function fetchMoodleFacts(): Promise<FactInput[]> {
  const cached = await db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'moodle') });

  let raw: { upcoming: MoodleUpcomingEvent[]; assignments: MoodleAssignmentsResponse };
  if (cached && !isCacheStale(cached.fetchedAt, new Date(), CACHE_TTL_MS)) {
    raw = cached.payload as typeof raw;
  } else {
    raw = await fetchMoodleRaw();
    await db
      .insert(sourcesCache)
      .values({ source: 'moodle', payload: raw, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: raw, fetchedAt: new Date() } });
  }

  return [...mapMoodleUpcomingToFacts(raw.upcoming), ...mapMoodleAssignmentsToFacts(raw.assignments)];
}
