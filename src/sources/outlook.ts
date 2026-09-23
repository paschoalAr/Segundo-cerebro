import ICAL from 'ical.js';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { isCacheStale } from '@/src/facts/cache';
import { getCollectionWindow } from '@/src/facts/window';
import type { FactInput } from '@/src/facts/repo';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** v1: `getAllSubcomponents('vevent')` retorna os VEVENTs como estão no .ics — RRULE
 * (reuniões recorrentes) não é expandido, só a primeira ocorrência aparece. Aceitável
 * porque o Outlook é fonte opcional/secundária (spec §6, §10); expandir recorrência
 * direito (ICAL.RecurExpansion, janela, sourceRef por ocorrência) fica pra quando isso
 * incomodar de verdade. */
export function mapIcsToFacts(icsText: string): FactInput[] {
  if (!icsText.trimStart().startsWith('BEGIN:VCALENDAR')) {
    throw new Error('Resposta do link .ics do Outlook não parece um calendário válido — link expirado ou exige login?');
  }

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
    return filterToWindow(mapIcsToFacts(icsText));
  }

  icsText = await fetchIcsText();
  // Parseia antes de cachear: se o link expirou ou exige login, o servidor costuma
  // responder 200 com uma página HTML em vez do .ics — sem isso, essa resposta quebrada
  // ficaria presa no cache pelas 6h inteiras do TTL, mesmo depois do link ser corrigido.
  const facts = mapIcsToFacts(icsText);

  await db
    .insert(sourcesCache)
    .values({ source: 'outlook', payload: { icsText }, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: { icsText }, fetchedAt: new Date() } });

  return filterToWindow(facts);
}

// Um .ics publicado tende a listar o calendário inteiro (passado e futuro), não só o
// período que importa — mesmo achado que o coletor do Moodle teve contra a API real.
// Fica aqui, não em mapIcsToFacts, pra o mapper continuar puro/testável sem depender da hora atual.
function filterToWindow(facts: FactInput[]): FactInput[] {
  const { start, end } = getCollectionWindow();
  return facts.filter((f) => f.date >= start && f.date <= end);
}
