import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { planRuns } from '@/src/db/schema';

export async function listRecentRuns(limit = 30) {
  return db.select().from(planRuns).orderBy(desc(planRuns.startedAt)).limit(limit);
}

export async function createRun(trigger: 'cron' | 'manual'): Promise<number> {
  const [row] = await db.insert(planRuns).values({ trigger, status: 'running' }).returning({ id: planRuns.id });
  return row.id;
}

export type FinishRunInput = {
  status: 'ok' | 'error';
  inputTokens?: number;
  cacheReadTokens?: number;
  outputTokens?: number;
  summary?: string;
  conflicts?: { text: string; severity: 'info' | 'warn' }[];
  error?: string;
};

export async function finishRun(id: number, data: FinishRunInput): Promise<void> {
  await db
    .update(planRuns)
    .set({ ...data, finishedAt: new Date() })
    .where(eq(planRuns.id, id));
}

/** Um run "em voo" (sem finishedAt) iniciado há menos de 3 minutos — trava geral de concorrência (spec §4.6). */
export async function findRunningRun() {
  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
  return db.query.planRuns.findFirst({
    where: and(isNull(planRuns.finishedAt), gt(planRuns.startedAt, threeMinAgo)),
  });
}

export async function findLastRun() {
  return db.query.planRuns.findFirst({ orderBy: desc(planRuns.startedAt) });
}
