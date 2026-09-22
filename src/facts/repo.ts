import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/src/db';
import { facts } from '@/src/db/schema';
import { planFactSync } from './sync';

export type FactInput = {
  kind: 'event' | 'deadline' | 'task' | 'info';
  title: string;
  date: Date;
  endDate: Date | null;
  allDay: boolean;
  source: 'moodle' | 'gcal' | 'outlook' | 'inbox';
  sourceRef: string;
  meta: Record<string, unknown>;
};

/** `incoming` precisa ser o conjunto completo e atual da fonte — tudo que não estiver
 * nele é apagado. Nunca chame com `[]` por causa de um erro de coleta engolido; deixe
 * o erro propagar, senão isso apaga silenciosamente todos os facts daquela fonte. */
export async function syncFactsForSource(
  source: FactInput['source'],
  incoming: FactInput[],
): Promise<{ upserts: number; deletes: number }> {
  const existing = await db
    .select({ sourceRef: facts.sourceRef })
    .from(facts)
    .where(eq(facts.source, source));

  const plan = planFactSync(
    existing.map((r) => r.sourceRef),
    incoming,
  );

  for (const item of plan.upserts) {
    await db
      .insert(facts)
      .values({ ...item, lastSeen: new Date() })
      .onConflictDoUpdate({
        target: [facts.source, facts.sourceRef],
        set: {
          kind: item.kind,
          title: item.title,
          date: item.date,
          endDate: item.endDate,
          allDay: item.allDay,
          meta: item.meta,
          lastSeen: new Date(),
        },
      });
  }

  if (plan.deletes.length > 0) {
    await db.delete(facts).where(and(eq(facts.source, source), inArray(facts.sourceRef, plan.deletes)));
  }

  return { upserts: plan.upserts.length, deletes: plan.deletes.length };
}

export async function insertFact(input: FactInput): Promise<number> {
  const [row] = await db.insert(facts).values(input).returning({ id: facts.id });
  return row.id;
}

export async function listFactsInRange(start: Date, end: Date) {
  return db
    .select()
    .from(facts)
    .where(and(gte(facts.date, start), lte(facts.date, end)))
    .orderBy(facts.date);
}
