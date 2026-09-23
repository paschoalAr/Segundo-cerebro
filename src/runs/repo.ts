import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '@/src/db';
import { planRuns } from '@/src/db/schema';
import { RunLockedError, STALE_RUN_MS, isUniqueViolation } from './lock';

export async function listRecentRuns(limit = 30) {
  return db.select().from(planRuns).orderBy(desc(planRuns.startedAt)).limit(limit);
}

/**
 * Abre um run. A exclusão mútua é do banco: `plan_runs_one_running_idx` só admite uma linha
 * com `finished_at IS NULL`, então o segundo processo leva 23505 e vira RunLockedError.
 * Chame `reapStaleRuns()` antes, senão um run que crashou trava o motor até a janela vencer.
 */
export async function createRun(trigger: 'cron' | 'manual'): Promise<number> {
  try {
    const [row] = await db.insert(planRuns).values({ trigger, status: 'running' }).returning({ id: planRuns.id });
    return row.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new RunLockedError();
    throw e;
  }
}

/**
 * Fecha runs que ficaram sem `finishedAt` porque o processo morreu. Sem isso o índice único
 * travaria o motor pra sempre. Idempotente — não toca em run vivo dentro da janela.
 */
export async function reapStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const rows = await db
    .update(planRuns)
    .set({
      status: 'error',
      error: 'Run abandonado — o processo morreu sem finalizar.',
      finishedAt: new Date(),
    })
    .where(and(isNull(planRuns.finishedAt), lt(planRuns.startedAt, cutoff)))
    .returning({ id: planRuns.id });
  return rows.length;
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

/**
 * Um run em voo, pra UI mostrar "replanejando…". NÃO é mais a trava de concorrência — quem
 * garante exclusão mútua é `plan_runs_one_running_idx` (ver `createRun`). A janela é a mesma
 * do reaper, pra não reportar como vivo um run que já pode ser colhido.
 */
export async function findRunningRun() {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  return db.query.planRuns.findFirst({
    where: and(isNull(planRuns.finishedAt), gt(planRuns.startedAt, cutoff)),
  });
}

/**
 * O run ANTERIOR ao que está rodando agora.
 *
 * Aceita `beforeRunId` porque o motor cria o run e só depois pergunta "o que mudou desde o
 * último?" — sem o filtro, a resposta era o próprio run recém-criado, a janela virava "de
 * agora até agora" e nenhuma resposta do Arthur jamais entrava no prompt.
 */
export async function findLastRun(beforeRunId?: number) {
  return db.query.planRuns.findFirst({
    where: beforeRunId === undefined ? undefined : lt(planRuns.id, beforeRunId),
    orderBy: desc(planRuns.id),
  });
}
