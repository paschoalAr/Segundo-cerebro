/**
 * Janela após a qual um run sem `finishedAt` é considerado morto (o processo crashou) e
 * pode ser colhido. Precisa ser bem maior que a duração real de um run — o mais longo
 * observado até hoje foi 85s (run #3, 2026-09-23).
 */
export const STALE_RUN_MS = 15 * 60 * 1000;

/** Índice único parcial que garante um único run em voo (ver `src/db/schema.ts`). */
export const RUN_LOCK_INDEX = 'plan_runs_one_running_idx';

export class RunLockedError extends Error {
  constructor() {
    super('Já existe um replanejamento em andamento.');
    this.name = 'RunLockedError';
  }
}

/**
 * Violação de unicidade do Postgres (SQLSTATE 23505). O driver da Neon às vezes embrulha o
 * erro original em `cause`, então percorremos a cadeia; sem `code`, caímos no nome do índice.
 */
export function isUniqueViolation(e: unknown, indexName: string = RUN_LOCK_INDEX): boolean {
  let cur: unknown = e;
  for (let depth = 0; cur !== null && cur !== undefined && depth < 5; depth++) {
    if (typeof cur !== 'object') return false;
    const o = cur as { code?: unknown; message?: unknown; cause?: unknown };
    if (o.code === '23505') return true;
    if (typeof o.message === 'string' && o.message.includes(indexName)) return true;
    if (o.cause === cur) return false;
    cur = o.cause;
  }
  return false;
}
