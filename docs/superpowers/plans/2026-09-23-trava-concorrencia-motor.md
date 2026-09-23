# Trava de Concorrência do Motor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que nunca existam dois runs do motor em voo ao mesmo tempo, movendo a exclusão mútua do código (check-then-act, com corrida comprovada) para um índice único parcial no Postgres.

**Architecture:** Hoje `runPlanEngine` faz `findRunningRun()` e só depois `createRun()` — dois processos simultâneos passam pelos dois (comprovado em 2026-09-23: `A1 CREATED #6` / `B1 CREATED #7`). A correção tira o guarda do código e coloca no banco: um índice único parcial sobre `plan_runs` onde `finished_at IS NULL` permite no máximo uma linha em voo, e o segundo `INSERT` morre com SQLSTATE 23505. Como o índice sozinho travaria o motor pra sempre se um processo crashasse, um *reaper* roda antes de cada tentativa e fecha runs abandonados (`started_at` mais velho que 15 min). `findRunningRun()` sobrevive, mas rebaixado a informativo (UI).

**Tech Stack:** TypeScript, Next.js 16, Drizzle ORM 0.45 + drizzle-kit, Postgres (Neon serverless via HTTP), Vitest, tsx.

**⚠️ Aviso sobre o banco:** este projeto tem um único Postgres (Neon) — não há banco de teste. A migration da Task 2 e o script da Task 5 batem no banco **real**, inclusive se executados de dentro de um worktree. A Task 5 limpa as linhas que cria. Não rodar a Task 5 enquanto um replanejamento de verdade estiver em andamento.

**Convenção do repo:** nenhum teste existente usa `vi.mock` — os testes cobrem funções puras (`src/**/*.test.ts`). Por isso a lógica testável é extraída pra `src/runs/lock.ts` (puro, com teste unitário) e o comportamento de banco é provado pelo script de aceitação da Task 5, não por teste unitário.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/runs/lock.ts` (criar) | Puro: janela de reaping, nome do índice, `RunLockedError`, `isUniqueViolation()` |
| `src/runs/lock.test.ts` (criar) | Testes unitários do acima |
| `src/db/schema.ts` (modificar) | Declara o índice único parcial em `plan_runs` |
| `drizzle/0002_*.sql` (gerado) | Migration do índice |
| `src/runs/repo.ts` (modificar) | `reapStaleRuns()`, `createRun()` atômico, `findRunningRun()` informativo |
| `src/plan/engine.ts` (modificar) | Remove o check-then-act; reap + create |
| `scripts/check-lock-race.ts` (criar) | Aceitação: N processos simultâneos, exatamente 1 vence |
| `package.json` (modificar) | Script `check:lock-race` |

---

### Task 1: Helpers puros da trava

**Files:**
- Create: `src/runs/lock.ts`
- Test: `src/runs/lock.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/runs/lock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RunLockedError, STALE_RUN_MS, isUniqueViolation } from './lock';

describe('isUniqueViolation', () => {
  it('reconhece o SQLSTATE 23505 direto no erro', () => {
    const e = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(isUniqueViolation(e)).toBe(true);
  });

  it('reconhece 23505 embrulhado em cause (driver da Neon)', () => {
    const inner = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(isUniqueViolation(new Error('falha no insert', { cause: inner }))).toBe(true);
  });

  it('reconhece pelo nome do índice quando não vem code', () => {
    const e = new Error('duplicate key value violates unique constraint "plan_runs_one_running_idx"');
    expect(isUniqueViolation(e)).toBe(true);
  });

  it('não confunde outro erro de banco', () => {
    const e = Object.assign(new Error('foreign key'), { code: '23503' });
    expect(isUniqueViolation(e)).toBe(false);
  });

  it('não confunde erro comum', () => {
    expect(isUniqueViolation(new Error('fetch failed'))).toBe(false);
  });

  it('aguenta null e undefined', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('não entra em loop com cause circular', () => {
    const a: { cause?: unknown; message: string } = { message: 'a' };
    a.cause = a;
    expect(isUniqueViolation(a)).toBe(false);
  });
});

describe('RunLockedError', () => {
  it('carrega a mensagem que o script e a UI mostram', () => {
    expect(new RunLockedError().message).toBe('Já existe um replanejamento em andamento.');
  });

  it('é identificável por instanceof e por name', () => {
    expect(new RunLockedError()).toBeInstanceOf(Error);
    expect(new RunLockedError().name).toBe('RunLockedError');
  });
});

describe('STALE_RUN_MS', () => {
  it('é 15 minutos — folga larga sobre o run real mais longo observado (85s)', () => {
    expect(STALE_RUN_MS).toBe(15 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/runs/lock.test.ts`

Esperado: FAIL com `Failed to resolve import "./lock"`.

- [ ] **Step 3: Implementar**

Criar `src/runs/lock.ts`:

```ts
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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/runs/lock.test.ts`

Esperado: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add src/runs/lock.ts src/runs/lock.test.ts
git commit -m "feat(runs): helpers puros da trava — RunLockedError e isUniqueViolation"
```

---

### Task 2: Índice único parcial no schema + migration

**Files:**
- Modify: `src/db/schema.ts:25-37`
- Create: `drizzle/0002_*.sql` (gerado pelo drizzle-kit)

- [ ] **Step 1: Conferir que o banco está apto a receber o índice**

O índice falha se já existir mais de uma linha com `finished_at IS NULL`. Verificar antes:

```bash
npx tsx -e "import 'dotenv/config'; import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); sql\`select id, started_at from plan_runs where finished_at is null\`.then(r=>console.log('em voo:', r.length, r));"
```

Esperado: `em voo: 0 []`.

Se vier mais de 1 linha, fechar as antigas antes de seguir:

```bash
npx tsx -e "import 'dotenv/config'; import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); sql\`update plan_runs set status='error', error='Run abandonado (limpeza pre-migration).', finished_at=now() where finished_at is null\`.then(()=>console.log('fechados'));"
```

- [ ] **Step 2: Declarar o índice no schema**

Em `src/db/schema.ts`, trocar a definição de `planRuns` (linhas 25-37) por esta — as colunas são idênticas, só ganha o terceiro argumento do `pgTable`:

```ts
export const planRuns = pgTable(
  'plan_runs',
  {
    id: serial('id').primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    trigger: runTrigger('trigger').notNull(),
    status: runStatus('status').notNull().default('running'),
    inputTokens: integer('input_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    outputTokens: integer('output_tokens'),
    summary: text('summary'),
    error: text('error'),
    conflicts: jsonb('conflicts').$type<{ text: string; severity: 'info' | 'warn' }[]>().default([]),
  },
  (t) => [
    // Trava de concorrência: no máximo UM run sem finished_at. O índice é sobre a constante
    // (1), então todas as linhas em voo colidem entre si. Ver src/runs/lock.ts.
    uniqueIndex('plan_runs_one_running_idx')
      .on(sql`(1)`)
      .where(sql`${t.finishedAt} is null`),
  ],
);
```

`uniqueIndex` e `sql` já estão importados no arquivo (usados por `plan_blocks_gcal_event_id_idx`) — não precisa mexer nos imports.

- [ ] **Step 3: Gerar a migration**

Run: `npm run db:generate`

- [ ] **Step 4: Conferir o SQL gerado ANTES de aplicar**

Run: `cat drizzle/0002_*.sql`

Esperado, uma linha equivalente a:

```sql
CREATE UNIQUE INDEX "plan_runs_one_running_idx" ON "plan_runs" USING btree ((1)) WHERE "plan_runs"."finished_at" is null;
```

**Se o drizzle-kit gerar algo diferente disso** — por exemplo omitindo o `WHERE`, ou recusando a expressão `(1)` — sobrescrever o conteúdo do arquivo gerado à mão com exatamente:

```sql
CREATE UNIQUE INDEX "plan_runs_one_running_idx" ON "plan_runs" USING btree ((1)) WHERE finished_at is null;
```

e seguir. O snapshot em `drizzle/meta/` já terá sido escrito pelo `generate`, então schema e histórico continuam coerentes.

- [ ] **Step 5: Aplicar a migration**

Run: `npm run db:migrate`

- [ ] **Step 6: Provar que o índice está ativo no banco**

Duas inserções cruas em voo: a segunda tem que estourar 23505.

```bash
npx tsx -e "import 'dotenv/config'; import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); (async()=>{ const [a]=await sql\`insert into plan_runs (trigger,status) values ('manual','running') returning id\`; console.log('primeira OK #'+a.id); try { await sql\`insert into plan_runs (trigger,status) values ('manual','running') returning id\`; console.log('FALHA: segunda passou'); } catch(e){ console.log('segunda barrada, code='+e.code); } await sql\`delete from plan_runs where id=\${a.id}\`; console.log('limpo'); })();"
```

Esperado:

```
primeira OK #N
segunda barrada, code=23505
limpo
```

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(db): indice unico parcial — no maximo um plan_run em voo"
```

---

### Task 3: `createRun` atômico + reaper no repo

**Files:**
- Modify: `src/runs/repo.ts`

- [ ] **Step 1: Trocar os imports do topo**

Substituir as três primeiras linhas de `src/runs/repo.ts` por:

```ts
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '@/src/db';
import { planRuns } from '@/src/db/schema';
import { RunLockedError, STALE_RUN_MS, isUniqueViolation } from './lock';
```

- [ ] **Step 2: Tornar o `createRun` atômico**

Substituir a função `createRun` inteira por:

```ts
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
```

- [ ] **Step 3: Rebaixar `findRunningRun` a informativo**

Substituir a função `findRunningRun` inteira por:

```ts
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
```

- [ ] **Step 4: Verificar typecheck e suíte**

Run: `npm run typecheck && npm test`

Esperado: typecheck limpo; 70/70 testes passando (60 anteriores + 10 da Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/runs/repo.ts
git commit -m "feat(runs): createRun atomico via indice unico + reaper de runs abandonados"
```

---

### Task 4: Ligar o motor na trava nova

**Files:**
- Modify: `src/plan/engine.ts:11` (import) e `src/plan/engine.ts:25-30` (abertura do run)

- [ ] **Step 1: Trocar o import do repo de runs**

Em `src/plan/engine.ts`, substituir a linha 11:

```ts
import { createRun, finishRun, findLastRun, findRunningRun } from '@/src/runs/repo';
```

por:

```ts
import { createRun, finishRun, findLastRun, reapStaleRuns } from '@/src/runs/repo';
```

- [ ] **Step 2: Remover o check-then-act**

Substituir estas linhas da abertura de `runPlanEngine`:

```ts
  const running = await findRunningRun();
  if (running) throw new Error('Já existe um replanejamento em andamento.');

  const runId = await createRun(trigger);
```

por:

```ts
  // Sem check-then-act: `createRun` lança RunLockedError se já houver run em voo, e quem
  // decide isso é o índice único do banco — dois processos simultâneos não passam os dois.
  await reapStaleRuns();
  const runId = await createRun(trigger);
```

`createRun` fica **fora** do `try` que chama `finishRun(runId, ...)` — se ele lançar, não existe `runId` pra finalizar. Não mover pra dentro.

- [ ] **Step 3: Verificar typecheck, suíte e build**

Run: `npm run typecheck && npm test && npm run build`

Esperado: typecheck limpo, 70/70 testes, build completo sem erro.

- [ ] **Step 4: Confirmar o bloqueio ponta a ponta, com a mensagem certa**

Insere um run em voo, chama o motor, confere a mensagem e limpa:

```bash
npx tsx -e "import 'dotenv/config'; import {neon} from '@neondatabase/serverless'; import {runPlanEngine} from './src/plan/engine'; const sql=neon(process.env.DATABASE_URL); (async()=>{ const [a]=await sql\`insert into plan_runs (trigger,status) values ('manual','running') returning id\`; try { await runPlanEngine('manual'); console.log('FALHA: motor rodou'); } catch(e){ console.log('motor barrado: '+e.message+' ('+e.name+')'); } await sql\`delete from plan_runs where id=\${a.id}\`; const rest=await sql\`select id,status from plan_runs order by id\`; console.log('plan_runs:', rest); })();"
```

Esperado:

```
motor barrado: Já existe um replanejamento em andamento. (RunLockedError)
plan_runs: [ { id: 1, status: 'error' }, { id: 2, status: 'error' }, { id: 3, status: 'ok' } ]
```

O motor tem que barrar **em menos de 1s**, sem chamar o Claude e sem tocar no calendário.

- [ ] **Step 5: Commit**

```bash
git add src/plan/engine.ts
git commit -m "feat(plan): motor usa a trava atomica do banco em vez de check-then-act"
```

---

### Task 5: Script de aceitação — a corrida de verdade

Esta é a task que prova o fix: é exatamente o teste que reprovou em 2026-09-23.

**Files:**
- Create: `scripts/check-lock-race.ts`
- Modify: `package.json` (bloco `scripts`)

- [ ] **Step 1: Criar o script**

Criar `scripts/check-lock-race.ts`:

```ts
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inArray } from 'drizzle-orm';
import { db } from '../src/db';
import { planRuns } from '../src/db/schema';
import { RunLockedError } from '../src/runs/lock';
import { createRun, reapStaleRuns } from '../src/runs/repo';

const WORKERS = 3;
/** Folga pro `tsx` de cada processo compilar e aquecer antes do instante combinado. */
const ALIGN_MS = 15_000;

async function runWorker(label: string, startAt: number): Promise<void> {
  // Todos os processos esperam o mesmo instante de parede — é o que maximiza a corrida.
  while (Date.now() < startAt) await new Promise((r) => setTimeout(r, 1));
  try {
    await reapStaleRuns();
    const id = await createRun('manual');
    console.log(`${label} CREATED ${id}`);
  } catch (e) {
    if (e instanceof RunLockedError) console.log(`${label} BLOCKED`);
    else console.log(`${label} ERROR ${e instanceof Error ? e.message : String(e)}`);
  }
}

function spawnWorker(label: string, startAt: number): Promise<string> {
  const self = fileURLToPath(import.meta.url);
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', self, '--worker', label, String(startAt)], { shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', () => resolve(out.trim()));
    child.on('error', reject);
  });
}

async function main() {
  if (process.argv[2] === '--worker') {
    await runWorker(process.argv[3], Number(process.argv[4]));
    return;
  }

  const startAt = Date.now() + ALIGN_MS;
  console.log(`Disparando ${WORKERS} processos alinhados em ${ALIGN_MS / 1000}s...`);
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => spawnWorker(`W${i + 1}`, startAt)),
  );
  for (const o of outputs) console.log('  ' + o);

  const created = outputs.filter((o) => o.includes('CREATED'));
  const blocked = outputs.filter((o) => o.includes('BLOCKED'));
  const ids = created.map((o) => Number(o.split('CREATED ')[1]));

  if (ids.length) {
    await db.delete(planRuns).where(inArray(planRuns.id, ids));
    console.log(`Limpeza: removidos ${ids.map((i) => '#' + i).join(', ')}`);
  }

  const ok = created.length === 1 && blocked.length === WORKERS - 1;
  console.log(
    ok
      ? `OK — 1 processo criou o run, ${blocked.length} foram barrados.`
      : `FALHA — criados=${created.length}, barrados=${blocked.length} (esperado 1 e ${WORKERS - 1})`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar o script no package.json**

No bloco `"scripts"` de `package.json`, adicionar após a linha do `"sync-knowledge"` (lembrar da vírgula no fim da linha anterior):

```json
    "check:lock-race": "tsx scripts/check-lock-race.ts"
```

- [ ] **Step 3: Rodar a corrida**

Run: `npm run check:lock-race`

Esperado (a ordem dos `W` varia):

```
Disparando 3 processos alinhados em 15s...
  W1 CREATED 8
  W2 BLOCKED
  W3 BLOCKED
Limpeza: removidos #8
OK — 1 processo criou o run, 2 foram barrados.
```

Exit code 0. **Se aparecer mais de um `CREATED`, o fix não pegou** — parar e conferir se o índice existe mesmo no banco (repetir o Step 6 da Task 2).

- [ ] **Step 4: Rodar a corrida mais duas vezes**

Corrida é probabilística — uma passada limpa não prova muito.

Run: `npm run check:lock-race && npm run check:lock-race`

Esperado: `OK` nas duas, exit 0.

- [ ] **Step 5: Confirmar que o banco ficou limpo**

```bash
npx tsx -e "import 'dotenv/config'; import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); sql\`select id, status, finished_at from plan_runs order by id\`.then(r=>console.log(r));"
```

Esperado: as três linhas reais (`#1/error`, `#2/error`, `#3/ok`), nenhuma com `finished_at` nulo.

- [ ] **Step 6: Verificação final da suíte**

Run: `npm run typecheck && npm test && npm run build`

Esperado: limpo, 70/70, build completo.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-lock-race.ts package.json
git commit -m "test(runs): script de aceitacao da corrida — N processos, um unico vence"
```

---

### Task 6: Atualizar o ESTADO do Plano 3

**Files:**
- Modify: `docs/superpowers/plans/2026-09-22-plano-3-ESTADO.md:5` e `:41`

- [ ] **Step 1: Marcar o item da trava e registrar o achado**

Em `docs/superpowers/plans/2026-09-22-plano-3-ESTADO.md`, na seção "Task 11 — o que ainda falta", trocar a linha:

```markdown
- [ ] Testar a trava de concorrência (dois runs em paralelo).
```

por:

```markdown
- [x] Testar a trava de concorrência (dois runs em paralelo) — feito 2026-09-23. **O teste reprovou**: `findRunningRun()` + `createRun()` no engine era check-then-act e dois processos simultâneos criaram os runs #6 e #7. Corrigido pelo plano `2026-09-23-trava-concorrencia-motor.md` — a exclusão mútua virou o índice único parcial `plan_runs_one_running_idx` (uma única linha com `finished_at IS NULL`), com reaper de 15 min pra crash. Regressão coberta por `npm run check:lock-race`.
```

- [ ] **Step 2: Atualizar o cabeçalho do ESTADO**

Trocar a linha `**Testes:**` no topo do mesmo arquivo por:

```markdown
**Testes:** `npm test` → 70/70 passando · `npm run typecheck` limpo · `npm run build` completo passa · `npm run check:lock-race` verde.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/
git commit -m "docs: trava de concorrencia testada, furo encontrado e corrigido"
```

---

## Notas de verificação

- **O que provou o bug (2026-09-23, antes do fix):** três rodadas de dois processos alinhados no mesmo instante de parede. Rodada 1 → `A1 CREATED #6` e `B1 CREATED #7`, os dois passaram. Rodadas 2 e 3 → ambos `BLOCKED`, mas só porque o `#6` órfão da rodada 1 ficou pendurado. As linhas #6 e #7 já foram removidas do banco.
- **Furo secundário resolvido de quebra:** a janela antiga era de 3 min contados do *início* do run. O run #3 real levou 84,9s — um prompt maior cruzaria os 180s e a trava soltaria com o run ainda vivo. Agora a janela de 15 min só serve pra colher crash, e quem impede o segundo run é o índice, independente de quanto tempo o primeiro demore.
- **Não coberto de propósito:** não há teste unitário batendo no Postgres, porque o projeto não tem banco de teste e nenhum teste existente usa `vi.mock`. A garantia de atomicidade é o índice (provado na Task 2 Step 6) e o script da Task 5.
