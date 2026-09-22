# Plano 3 — Motor: prompt com Manual+knowledge+facts, Claude Code local monta a semana, aplica no Cérebro, gera perguntas/sugestões

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um script local (`scripts/run-plan-local.ts`), disparado ao logar no Windows (Agendador de Tarefas) ou rodado na mão, lê Manual + knowledge + facts + blocos atuais + observações + inbox, chama o Claude Code instalado na máquina do Arthur (via assinatura, sem billing por token) com saída estruturada, e aplica o resultado: escreve/edita/apaga blocos de estudo/tarefa/viagem no calendário "Cérebro", processa a inbox em facts/perguntas, registra perguntas e sugestões de manual, e mostra tudo na Semana (blocos coloridos, conflitos) e na Pendências (perguntas + sugestões).

**Architecture:** Fluxo em 4 fases sequenciais, cada uma seu próprio módulo: coletar (reaproveita `collectAll` do Plano 2 + novas "observações" do calendário Cérebro) → montar prompt (`src/plan/prompt.ts`) → chamar o `claude.exe` local como subprocesso com `--json-schema` (structured output) → aplicar (`src/plan/apply.ts`, escreve no Google Calendar e no Postgres). Decisão registrada em `docs/superpowers/specs/2026-09-22-motor-local-claude-code-design.md`: nada disso passa pela API paga da Anthropic — usa a assinatura do Arthur via `CLAUDE_CODE_OAUTH_TOKEN` (token de 1 ano gerado com `claude setup-token`). Sem cron na Vercel, sem rota HTTP — o motor só roda local.

**Tech Stack:** o que já existe (Next 16, Drizzle, Neon, Google Calendar REST) + o binário `claude.exe` já instalado pelo app desktop (nenhuma dependência nova no `package.json` do site — o motor roda via `node_modules/.bin/tsx` local, subprocesso do `claude.exe`).

**Spec:** `docs/superpowers/specs/2026-09-15-segundo-cerebro-design.md` (§4 fluxo de planejamento completo, §5 telas Semana/Pendências, §9 F1/F2 sobre `prep` — fora do escopo aqui) + `docs/superpowers/specs/2026-09-22-motor-local-claude-code-design.md` (decisão de rodar local em vez da API paga — leia antes da Task 8).

---

## Estado herdado dos Planos 1 e 2 (não recriar)

- Todas as tabelas existem e estão migradas: `plan_blocks`, `questions`, `manual`, `manual_suggestions`, `plan_runs`, `knowledge`, `inbox_items`, `facts`, `sources_cache`, `oauth_tokens` — só `plan_runs` ganha uma coluna nova aqui (`conflicts`).
- `src/facts/collect.ts` (`collectAll`) já sincroniza `facts` a partir de gcal/moodle/outlook — o motor chama isso como primeiro passo, não recria.
- `src/google/token.ts` (`getValidAccessToken`) e `src/google/calendar.ts` (`listCalendarList`, `listEvents`, `pickCerebroCalendar`, `createCerebroCalendar`) já existem — este plano só adiciona escrita (insert/patch/delete de eventos).
- `src/manual/repo.ts` (`getManual`/`saveManual`) e `src/manual/sections.ts` (`MANUAL_SECTIONS`, `appendToSection`) já existem, prontos pra reaproveitar.
- `src/knowledge/repo.ts` só tem `listKnowledge` (metadados, sem `content`) — este plano adiciona uma função com o conteúdo completo, pro prompt.
- A tela Semana (Plano 2) já mostra `facts` reais; este plano a estende pra também mostrar `plan_blocks`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/db/schema.ts` (modificar) | Adiciona `planRuns.conflicts` (jsonb) |
| `src/runs/repo.ts` (modificar) | `createRun`, `finishRun`, `findRunningRun`, `findLastRun` |
| `src/knowledge/repo.ts` (modificar) | `listKnowledgeFull` (com `content`) |
| `src/inbox/repo.ts` (modificar) | `listNewInboxItems`, `markInboxProcessed`, `markInboxIgnored` |
| `src/facts/repo.ts` (modificar) | `insertFact` (fato avulso, não sincronizado por fonte) |
| `src/questions/repo.ts` (novo) | `listOpenQuestions`, `listAnsweredSince`, `createQuestion`, `answerQuestion`, `dismissQuestion`, `countOpenQuestions` |
| `src/manual/suggestions-repo.ts` (novo) | `listPendingSuggestions`, `createSuggestion`, `acceptSuggestion`, `rejectSuggestion`, `countPendingSuggestions` |
| `src/plan/blocks-repo.ts` (novo) | CRUD de `plan_blocks`: `listBlocksInRange`, `listPlannedBlocksWithGcalId`, `getBlock`, `insertBlockDraft`, `setBlockGcalEventId`, `updateBlock`, `deleteBlockRow`, `setBlockStatus` |
| `src/google/cerebro-calendar.ts` (novo) | `getCerebroCalendarId` — extraído de `src/sources/gcal.ts` pra ser reaproveitado |
| `src/sources/gcal.ts` (modificar) | Usa `getCerebroCalendarId` importado em vez da cópia local |
| `src/google/calendar.ts` (modificar) | `insertEvent`, `patchEvent`, `deleteEvent`, `toGCalEventTime`, `extendedProperties` no tipo `GCalEvent` |
| `src/plan/observations.ts` (novo) | `computeObservations` (puro, testado) + `fetchObservations` (IO) |
| `src/plan/schema.ts` (novo) | `PlanOutputSchema` (Zod) — o contrato de saída estruturada |
| `src/plan/prompt.ts` (novo) | `buildSystemPrompt`, `buildUserContent` |
| `src/plan/apply.ts` (novo) | `applyPlanOutput` — inbox → facts/perguntas, blocos → Google Calendar + `plan_blocks` |
| `src/motor/claude-cli.ts` (novo) | `pickLatestVersion` (puro, testado) + `findClaudeCliPath` — acha o `claude.exe` instalado pelo app desktop |
| `src/motor/run-claude-cli.ts` (novo) | `runClaudeCli` — sobe o subprocesso `claude -p ...` com saída estruturada, valida o envelope |
| `src/plan/engine.ts` (novo) | `runPlanEngine` — orquestra coletar → montar prompt → `runClaudeCli` → aplicar → fechar o run; trava de concorrência embutida |
| `scripts/run-plan-local.ts` (novo) | Entry point local — chamado pelo Agendador de Tarefas do Windows (ao logar) ou na mão |
| `scripts/run-plan-local.cmd` (novo) | Launcher `.cmd` que o Agendador de Tarefas aponta, com log em arquivo |
| `app/(app)/actions.ts` (modificar) | `markBlockDone`, `markBlockSkipped` (sem `replanejar` — motor é só local) |
| `app/(app)/page.tsx` (modificar) | Mostra `plan_blocks` coloridos junto dos facts e o banner de conflitos, sem botão Replanejar |
| `app/(app)/layout.tsx` (modificar) | `pendingCount` real (perguntas abertas + sugestões pendentes) |
| `app/(app)/pendencias/page.tsx` (modificar) | Perguntas abertas (responder/dispensar) + sugestões pendentes (aceitar/editar/rejeitar) |
| `app/(app)/pendencias/actions.ts` (novo) | Server actions da tela Pendências |
| `.env.example` (modificar) | `CLAUDE_CODE_OAUTH_TOKEN`, `MOTOR_MODEL` (opcional) |
| `.gitignore` (modificar) | `logs/` (saída do launcher local) |

---

### Task 1: `plan_runs.conflicts` + repositório de runs

**Files:**
- Modify: `src/db/schema.ts`, `src/runs/repo.ts`
- Create: migração via `drizzle-kit generate`

- [ ] **Step 1: Adicionar a coluna em `src/db/schema.ts`**

Achar o bloco `export const planRuns = pgTable('plan_runs', { ... });` e adicionar o campo `conflicts` antes do fechamento:

```ts
  conflicts: jsonb('conflicts').$type<{ text: string; severity: 'info' | 'warn' }[]>().default([]),
```

(A tabela já usa `jsonb` — confirme que `jsonb` já está importado de `drizzle-orm/pg-core` no topo do arquivo; se não estiver, adicione ao import existente.)

- [ ] **Step 2: Gerar e aplicar a migração**

Run: `npm run db:generate && npm run db:migrate`
Expected: `drizzle/0001_*.sql` criado com `ALTER TABLE plan_runs ADD COLUMN conflicts jsonb DEFAULT '[]'::jsonb`; migrate termina sem erro.

- [ ] **Step 3: Reescrever `src/runs/repo.ts`**

```ts
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
```

- [ ] **Step 4: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/db/schema.ts src/runs/repo.ts drizzle
git commit -m "feat(runs): plan_runs.conflicts + createRun/finishRun/findRunningRun/findLastRun

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Repositórios de apoio (knowledge completo, inbox, facts avulsos, perguntas, sugestões, blocos)

**Files:**
- Modify: `src/knowledge/repo.ts`, `src/inbox/repo.ts`, `src/facts/repo.ts`
- Create: `src/questions/repo.ts`, `src/manual/suggestions-repo.ts`, `src/plan/blocks-repo.ts`

- [ ] **Step 1: Adicionar `listKnowledgeFull` em `src/knowledge/repo.ts`**

Adicionar (não remover o que já existe):

```ts
export async function listKnowledgeFull() {
  return db
    .select({ slug: knowledge.slug, title: knowledge.title, content: knowledge.content })
    .from(knowledge)
    .orderBy(knowledge.title);
}
```

- [ ] **Step 2: Adicionar funções em `src/inbox/repo.ts`**

Adicionar (mantendo `addInboxItem`/`listInboxItems`/`deleteInboxItem` como estão):

```ts
export async function listNewInboxItems() {
  return db.select().from(inboxItems).where(eq(inboxItems.status, 'new'));
}

export async function markInboxProcessed(
  id: number,
  processedInto: { factIds?: number[]; questionIds?: number[] },
): Promise<void> {
  await db.update(inboxItems).set({ status: 'processed', processedInto }).where(eq(inboxItems.id, id));
}

export async function markInboxIgnored(id: number, why: string): Promise<void> {
  await db.update(inboxItems).set({ status: 'ignored', processedInto: { why } }).where(eq(inboxItems.id, id));
}
```

- [ ] **Step 3: Adicionar `insertFact` em `src/facts/repo.ts`**

Adicionar (mantendo `syncFactsForSource`/`listFactsInRange` como estão):

```ts
export async function insertFact(input: FactInput): Promise<number> {
  const [row] = await db.insert(facts).values(input).returning({ id: facts.id });
  return row.id;
}
```

- [ ] **Step 4: Criar `src/questions/repo.ts`**

```ts
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/src/db';
import { questions } from '@/src/db/schema';

export async function listOpenQuestions() {
  return db.select().from(questions).where(eq(questions.status, 'open')).orderBy(desc(questions.askedAt));
}

export async function listAnsweredSince(since: Date) {
  return db
    .select()
    .from(questions)
    .where(and(eq(questions.status, 'answered'), gt(questions.answeredAt, since)));
}

export async function createQuestion(
  text: string,
  context: Record<string, unknown>,
  runId: number,
): Promise<number> {
  const [row] = await db.insert(questions).values({ text, context, runId }).returning({ id: questions.id });
  return row.id;
}

export async function answerQuestion(id: number, answer: string): Promise<void> {
  await db
    .update(questions)
    .set({ answer, answeredAt: new Date(), status: 'answered' })
    .where(eq(questions.id, id));
}

export async function dismissQuestion(id: number): Promise<void> {
  await db.update(questions).set({ status: 'dismissed' }).where(eq(questions.id, id));
}

export async function countOpenQuestions(): Promise<number> {
  const rows = await db.select({ id: questions.id }).from(questions).where(eq(questions.status, 'open'));
  return rows.length;
}
```

- [ ] **Step 5: Criar `src/manual/suggestions-repo.ts`**

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { manualSuggestions } from '@/src/db/schema';
import { appendToSection } from './sections';
import { getManual, saveManual } from './repo';

export async function listPendingSuggestions() {
  return db
    .select()
    .from(manualSuggestions)
    .where(eq(manualSuggestions.status, 'pending'))
    .orderBy(desc(manualSuggestions.createdAt));
}

export async function createSuggestion(
  section: string,
  text: string,
  fromQuestionId: number | null,
  runId: number,
): Promise<void> {
  await db.insert(manualSuggestions).values({ section, text, fromQuestionId, runId });
}

/** `text` opcional deixa aceitar uma versão editada (tela Pendências: "editar e aceitar"). */
export async function acceptSuggestion(id: number, text?: string): Promise<void> {
  const row = await db.query.manualSuggestions.findFirst({ where: eq(manualSuggestions.id, id) });
  if (!row) return;

  const manual = await getManual();
  await saveManual(appendToSection(manual.content, row.section, text ?? row.text));
  await db.update(manualSuggestions).set({ status: 'accepted' }).where(eq(manualSuggestions.id, id));
}

export async function rejectSuggestion(id: number): Promise<void> {
  await db.update(manualSuggestions).set({ status: 'rejected' }).where(eq(manualSuggestions.id, id));
}

export async function countPendingSuggestions(): Promise<number> {
  const rows = await db
    .select({ id: manualSuggestions.id })
    .from(manualSuggestions)
    .where(eq(manualSuggestions.status, 'pending'));
  return rows.length;
}
```

- [ ] **Step 6: Criar `src/plan/blocks-repo.ts`**

```ts
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/src/db';
import { planBlocks } from '@/src/db/schema';

export type BlockInput = {
  title: string;
  start: Date;
  end: Date;
  kind: 'study' | 'task' | 'travel' | 'buffer';
  factId: number | null;
  reason: string;
};

export async function listBlocksInRange(start: Date, end: Date) {
  return db
    .select()
    .from(planBlocks)
    .where(and(gte(planBlocks.start, start), lte(planBlocks.start, end)))
    .orderBy(planBlocks.start);
}

/** Blocos ainda "planned" com evento no Cérebro — base pra computeObservations. */
export async function listPlannedBlocksWithGcalId() {
  return db
    .select({ id: planBlocks.id, title: planBlocks.title, start: planBlocks.start, gcalEventId: planBlocks.gcalEventId })
    .from(planBlocks)
    .where(and(eq(planBlocks.status, 'planned'), isNotNull(planBlocks.gcalEventId)));
}

export async function getBlock(id: number) {
  return db.query.planBlocks.findFirst({ where: eq(planBlocks.id, id) });
}

/** Insere o bloco sem gcalEventId ainda — o id gerado aqui vira extendedProperties.private.block_id no evento. */
export async function insertBlockDraft(input: BlockInput, runId: number): Promise<number> {
  const [row] = await db
    .insert(planBlocks)
    .values({ ...input, createdRunId: runId, updatedRunId: runId })
    .returning({ id: planBlocks.id });
  return row.id;
}

export async function setBlockGcalEventId(id: number, gcalEventId: string): Promise<void> {
  await db.update(planBlocks).set({ gcalEventId }).where(eq(planBlocks.id, id));
}

export async function updateBlock(
  id: number,
  input: Pick<BlockInput, 'title' | 'start' | 'end' | 'reason'>,
  runId: number,
): Promise<void> {
  await db
    .update(planBlocks)
    .set({ ...input, updatedRunId: runId })
    .where(eq(planBlocks.id, id));
}

export async function deleteBlockRow(id: number): Promise<void> {
  await db.delete(planBlocks).where(eq(planBlocks.id, id));
}

export async function setBlockStatus(id: number, status: 'done' | 'skipped'): Promise<void> {
  await db.update(planBlocks).set({ status }).where(eq(planBlocks.id, id));
}
```

- [ ] **Step 7: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/knowledge/repo.ts src/inbox/repo.ts src/facts/repo.ts src/questions src/manual/suggestions-repo.ts src/plan/blocks-repo.ts
git commit -m "feat(plan): repos de apoio — knowledge completo, inbox, facts avulsos, perguntas, sugestões, blocos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Escrita no Google Calendar + `getCerebroCalendarId` compartilhado

**Files:**
- Create: `src/google/cerebro-calendar.ts`
- Modify: `src/google/calendar.ts`, `src/sources/gcal.ts`

- [ ] **Step 1: Criar `src/google/cerebro-calendar.ts`**

Extraído verbatim de `src/sources/gcal.ts` (mesma lógica, só movida pra ser reaproveitada pelo motor):

```ts
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
```

- [ ] **Step 2: Atualizar `src/sources/gcal.ts` pra reaproveitar**

Remover a função `getCerebroCalendarId` local (e os imports que só ela usava: `eq`, `sourcesCache`, `createCerebroCalendar`, `pickCerebroCalendar`) e importar a versão compartilhada:

```ts
import { getValidAccessToken } from '@/src/google/token';
import { listCalendarList, listEvents, mapGcalEventToFact } from '@/src/google/calendar';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { getCollectionWindow } from '@/src/facts/window';
import type { FactInput } from '@/src/facts/repo';

export async function fetchGcalFacts(): Promise<FactInput[]> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);
  const calendars = await listCalendarList(accessToken);
  const { start, end } = getCollectionWindow();

  const facts: FactInput[] = [];
  for (const cal of calendars) {
    if (cal.id === cerebroId) continue;
    const events = await listEvents(accessToken, cal.id, start, end);
    for (const event of events) facts.push(mapGcalEventToFact(cal.id, event));
  }
  return facts;
}
```

- [ ] **Step 3: Adicionar escrita + `extendedProperties` em `src/google/calendar.ts`**

Atualizar o tipo `GCalEvent` (adicionar o campo) e adicionar as três funções novas + o helper de conversão de data, ao final do arquivo:

```ts
export type GCalEvent = {
  id: string;
  summary?: string;
  status: string;
  start: GCalEventTime;
  end: GCalEventTime;
  extendedProperties?: { private?: Record<string, string> };
};
```

```ts
export function toGCalEventTime(date: Date): GCalEventTime {
  return { dateTime: date.toISOString() };
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: { summary: string; start: GCalEventTime; end: GCalEventTime; blockId: number },
): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.summary,
      start: event.start,
      end: event.end,
      extendedProperties: { private: { block_id: String(event.blockId) } },
    }),
  });
  if (!res.ok) throw new Error(`Falha ao criar evento no Cérebro: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Tolerante a 404: o Arthur pode ter apagado o evento manualmente — nesse caso só a linha do banco importa daqui pra frente. */
export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: { summary: string; start: GCalEventTime; end: GCalEventTime },
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: event.summary, start: event.start, end: event.end }),
    },
  );
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Falha ao atualizar evento no Cérebro: ${res.status} ${await res.text()}`);
}

/** Tolerante a 404/410: apagar um evento que já não existe é sucesso, não erro. */
export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404 || res.status === 410) return;
  if (!res.ok) throw new Error(`Falha ao apagar evento no Cérebro: ${res.status} ${await res.text()}`);
}
```

- [ ] **Step 4: Rodar a suíte inteira (garantir que a extração não quebrou o Plano 2) e typecheck**

Run: `npm test && npm run typecheck`
Expected: todos os testes existentes continuam passando; typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/google/cerebro-calendar.ts src/google/calendar.ts src/sources/gcal.ts
git commit -m "feat(google): escrita de eventos no Calendar (insert/patch/delete) + getCerebroCalendarId compartilhado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Observações (o que o Arthur mudou manualmente no Cérebro)

**Files:**
- Create: `src/plan/observations.ts`, `src/plan/observations.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/plan/observations.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeObservations } from './observations';

describe('computeObservations', () => {
  it('sem diferença, não gera observação', () => {
    const start = new Date(2026, 8, 25, 14, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start, gcalEventId: 'evt1' }],
      [{ id: 'evt1', summary: 'Estudar Redes', start: { dateTime: start.toISOString() }, extendedProperties: { private: { block_id: '1' } } }],
    );
    expect(obs).toEqual([]);
  });

  it('bloco sem evento correspondente no Cérebro vira "Arthur removeu"', () => {
    const start = new Date(2026, 8, 25, 14, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start, gcalEventId: 'evt1' }],
      [],
    );
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatch(/removeu/);
    expect(obs[0]).toContain('Estudar Redes');
  });

  it('evento com horário diferente do bloco vira observação de mudança', () => {
    const blockStart = new Date(2026, 8, 25, 14, 0);
    const movedStart = new Date(2026, 8, 25, 18, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start: blockStart, gcalEventId: 'evt1' }],
      [{ id: 'evt1', summary: 'Estudar Redes', start: { dateTime: movedStart.toISOString() }, extendedProperties: { private: { block_id: '1' } } }],
    );
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatch(/moveu|editou/);
  });

  it('bloco sem gcalEventId é ignorado (nunca foi escrito no Cérebro)', () => {
    const obs = computeObservations([{ id: 2, title: 'x', start: new Date(), gcalEventId: null }], []);
    expect(obs).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/plan/observations`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/plan/observations.ts`**

```ts
import { getValidAccessToken } from '@/src/google/token';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { listEvents, type GCalEvent } from '@/src/google/calendar';
import { listPlannedBlocksWithGcalId } from './blocks-repo';

export type ObservableBlock = { id: number; title: string; start: Date; gcalEventId: string | null };

export function computeObservations(
  blocks: ObservableBlock[],
  events: Pick<GCalEvent, 'id' | 'summary' | 'start' | 'extendedProperties'>[],
): string[] {
  const byBlockId = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    const blockId = e.extendedProperties?.private?.block_id;
    if (blockId) byBlockId.set(blockId, e);
  }

  const observations: string[] = [];
  for (const block of blocks) {
    if (!block.gcalEventId) continue;
    const event = byBlockId.get(String(block.id));

    if (!event) {
      observations.push(`Arthur removeu "${block.title}" do calendário Cérebro.`);
      continue;
    }

    const eventStart = new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
    if (eventStart.getTime() !== block.start.getTime() || event.summary !== block.title) {
      observations.push(
        `Arthur moveu/editou "${block.title}": agora está como "${event.summary ?? block.title}" em ${eventStart.toLocaleString('pt-BR')}.`,
      );
    }
  }
  return observations;
}

/** Janela -7d..+21d (spec §4.1) — pega tanto o que já rolou nos últimos 7 dias quanto o horizonte de coleta. */
function getObservationWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 21);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function fetchObservations(): Promise<string[]> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);
  const { start, end } = getObservationWindow();

  const [blocks, events] = await Promise.all([
    listPlannedBlocksWithGcalId(),
    listEvents(accessToken, cerebroId, start, end),
  ]);

  return computeObservations(blocks, events);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/plan/observations`
Expected: 4 passed.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/plan/observations.ts src/plan/observations.test.ts
git commit -m "feat(plan): observações — diff entre plan_blocks e o calendário Cérebro real

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Contrato de saída estruturada (`PlanOutputSchema`)

**Files:**
- Create: `src/plan/schema.ts`, `src/plan/schema.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/plan/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PlanOutputSchema } from './schema';

const VALID: unknown = {
  inbox: [
    { id: 1, interpretation: { type: 'fact', kind: 'event', title: 'Reunião', date: '2026-09-25T14:00:00-03:00', end_date: null, all_day: false } },
    { id: 2, interpretation: { type: 'question', text: 'Vai viajar no aniversário da mãe?' } },
    { id: 3, interpretation: { type: 'ignore', why: 'já processado antes' } },
  ],
  blocks: {
    create: [{ title: 'Estudar Redes', start: '2026-09-26T09:00:00-03:00', end: '2026-09-26T11:00:00-03:00', kind: 'study', fact_id: null, reason: 'P1 na terça' }],
    update: [{ id: 10, title: 'Estudar Redes (revisão)', start: '2026-09-26T09:00:00-03:00', end: '2026-09-26T11:30:00-03:00', reason: 'ajuste de duração' }],
    delete: [{ id: 11, reason: 'já não é mais necessário' }],
  },
  conflicts: [{ text: 'Sexta tem 3 provas e só 4h livres', severity: 'warn' }],
  questions: [{ text: 'Prefere estudar de manhã ou à noite?', context: { motivo: 'padrão não claro no manual' } }],
  manual_suggestions: [{ section: 'Faculdade', text: 'Prova de Redes = 6h de estudo', from_question_id: null }],
  summary: 'Semana com 2 provas e 1 entrega.',
};

describe('PlanOutputSchema', () => {
  it('aceita uma saída válida completa', () => {
    expect(PlanOutputSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejeita kind de bloco desconhecido', () => {
    const bad = JSON.parse(JSON.stringify(VALID));
    bad.blocks.create[0].kind = 'lazer';
    expect(PlanOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejeita interpretation.type desconhecido', () => {
    const bad = JSON.parse(JSON.stringify(VALID));
    bad.inbox[0].interpretation.type = 'evento';
    expect(PlanOutputSchema.safeParse(bad).success).toBe(false);
  });

  it('aceita listas vazias em tudo (semana sem novidade)', () => {
    expect(
      PlanOutputSchema.safeParse({
        inbox: [],
        blocks: { create: [], update: [], delete: [] },
        conflicts: [],
        questions: [],
        manual_suggestions: [],
        summary: 'Nada novo esta semana.',
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/plan/schema`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/plan/schema.ts`**

```ts
import { z } from 'zod';

const FactKind = z.enum(['event', 'deadline', 'task', 'info']);
const BlockKind = z.enum(['study', 'task', 'travel', 'buffer']);

export const PlanOutputSchema = z.object({
  inbox: z.array(
    z.object({
      id: z.number(),
      interpretation: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('fact'),
          kind: FactKind,
          title: z.string(),
          date: z.string(),
          end_date: z.string().nullable(),
          all_day: z.boolean(),
        }),
        z.object({ type: z.literal('question'), text: z.string() }),
        z.object({ type: z.literal('ignore'), why: z.string() }),
      ]),
    }),
  ),
  blocks: z.object({
    create: z.array(
      z.object({
        title: z.string(),
        start: z.string(),
        end: z.string(),
        kind: BlockKind,
        fact_id: z.number().nullable(),
        reason: z.string(),
      }),
    ),
    update: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        reason: z.string(),
      }),
    ),
    delete: z.array(z.object({ id: z.number(), reason: z.string() })),
  }),
  conflicts: z.array(z.object({ text: z.string(), severity: z.enum(['info', 'warn']) })),
  questions: z.array(z.object({ text: z.string(), context: z.record(z.string(), z.unknown()) })),
  manual_suggestions: z.array(
    z.object({ section: z.string(), text: z.string(), from_question_id: z.number().nullable() }),
  ),
  summary: z.string(),
});

export type PlanOutput = z.infer<typeof PlanOutputSchema>;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/plan/schema`
Expected: 4 passed.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/plan/schema.ts src/plan/schema.test.ts
git commit -m "feat(plan): PlanOutputSchema — contrato Zod da saída estruturada da Claude

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Montagem do prompt

**Files:**
- Create: `src/plan/prompt.ts`, `src/plan/prompt.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/plan/prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserContent } from './prompt';

describe('buildSystemPrompt', () => {
  it('menciona as regras de comportamento e as seções válidas do manual', () => {
    const blocks = buildSystemPrompt();
    const text = blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/Idempotente/);
    expect(text).toMatch(/Passado é imutável/);
    expect(text).toContain('Perfil');
    expect(text).toContain('Regras de planejamento');
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('buildUserContent', () => {
  const base = {
    manual: '# Manual\n\n## Faculdade\n- Prova de Redes = 6h',
    knowledge: [{ title: 'TCC Estado', content: 'Projeto Ressoa...' }],
    today: new Date(2026, 8, 22),
    weekStart: new Date(2026, 8, 21),
    weekEnd: new Date(2026, 8, 27),
    facts: [] as never[],
    blocks: [] as never[],
    observations: [] as string[],
    inboxItems: [] as never[],
    answeredQuestions: [] as never[],
  };

  it('bloco estável contém o manual e o conhecimento, com cache_control', () => {
    const content = buildUserContent(base);
    expect(content[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(content[0].text).toContain('Prova de Redes = 6h');
    expect(content[0].text).toContain('TCC Estado');
  });

  it('bloco variável contém a data de hoje e não tem cache_control', () => {
    const content = buildUserContent(base);
    expect(content[1].cache_control).toBeUndefined();
    expect(content[1].text).toContain('22/09/2026');
  });

  it('lista vazia de facts/blocos/observações não quebra e mostra placeholder', () => {
    const content = buildUserContent(base);
    expect(content[1].text).toMatch(/\(nenhum/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/plan/prompt`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/plan/prompt.ts`**

```ts
const SYSTEM_PROMPT = `Você é o "cérebro" de um sistema pessoal de planejamento para o Arthur. Sua função é olhar pra tudo que existe no mundo dele (Google Calendar, Moodle, Outlook, itens da inbox) e decidir os blocos de estudo, tarefa e viagem da semana, escrevendo-os no calendário Google "Cérebro" dele.

Regras de comportamento:
1. Idempotente: sem nada novo, não emita blocks.update nem blocks.delete. Só gere diffs em relação aos blocos atuais recebidos.
2. Passado é imutável: nunca inclua em blocks.update ou blocks.delete um bloco cujo horário de término já passou.
3. Edição do Arthur vence: se as observações indicarem que o Arthur moveu ou editou um bloco, mantenha a versão dele a menos que ela colida com um evento real (fact). Quando notar um padrão repetido, proponha um manual_suggestion sobre isso.
4. Pergunta não bloqueia: planeje com a melhor hipótese possível e registre no reason "assumindo X — pergunta em aberto", em vez de esperar a resposta.
5. Só escreva no Cérebro: nunca proponha alterar um fact vindo de fonte externa (gcal/moodle/outlook) — isso é gerenciado fora do seu controle.
6. Manual é sugestão, não edição: nunca reescreva o manual inteiro; só proponha linhas novas via manual_suggestions.
7. Conflitos explícitos: se a soma de horas necessárias (segundo o manual) não couber na semana, emita um conflict em vez de espremer os blocos silenciosamente.

Seções válidas do manual (use exatamente um destes valores em manual_suggestions.section): Perfil, Faculdade, Trabalho, Pessoas, Regras de planejamento.

Tipos de bloco válidos: study (estudo), task (tarefa), travel (viagem), buffer (respiro/deslocamento).

Todas as datas (inbox.date, inbox.end_date, blocks.*.start, blocks.*.end) devem ser strings ISO 8601 completas com o fuso -03:00 (horário de Brasília), por exemplo "2026-09-25T14:00:00-03:00".`;

export function buildSystemPrompt(): { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }[] {
  return [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];
}

type Fact = { source: string; kind: string; title: string; date: Date };
type Block = { id: number; kind: string; status: string; title: string; start: Date; end: Date };
type InboxItem = { id: number; text: string };
type AnsweredQuestion = { text: string; answer: string | null };
type KnowledgeDoc = { title: string; content: string };

export type UserContentInput = {
  manual: string;
  knowledge: KnowledgeDoc[];
  today: Date;
  weekStart: Date;
  weekEnd: Date;
  facts: Fact[];
  blocks: Block[];
  observations: string[];
  inboxItems: InboxItem[];
  answeredQuestions: AnsweredQuestion[];
};

function fmt(d: Date): string {
  return d.toLocaleString('pt-BR');
}

export function buildUserContent(
  input: UserContentInput,
): [
  { type: 'text'; text: string; cache_control: { type: 'ephemeral' } },
  { type: 'text'; text: string },
] {
  const stable = [
    `Manual sobre o Arthur:\n${input.manual}`,
    `Conhecimento:\n${input.knowledge.map((k) => `## ${k.title}\n${k.content}`).join('\n\n')}`,
  ].join('\n\n');

  const variable = [
    `Hoje: ${input.today.toLocaleDateString('pt-BR')}`,
    `Semana: ${input.weekStart.toLocaleDateString('pt-BR')} a ${input.weekEnd.toLocaleDateString('pt-BR')}`,
    '',
    'Fatos (próximas semanas):',
    input.facts.map((f) => `- [${f.source}/${f.kind}] ${f.title} — ${fmt(f.date)}`).join('\n') || '(nenhum)',
    '',
    'Blocos atuais no Cérebro:',
    input.blocks.map((b) => `- #${b.id} [${b.kind}/${b.status}] ${b.title} — ${fmt(b.start)} a ${fmt(b.end)}`).join('\n') ||
      '(nenhum)',
    '',
    'Observações (o que o Arthur mudou manualmente):',
    input.observations.join('\n') || '(nenhuma)',
    '',
    'Itens novos na inbox:',
    input.inboxItems.map((i) => `- #${i.id} ${i.text}`).join('\n') || '(nenhum)',
    '',
    'Respostas novas desde o último run:',
    input.answeredQuestions.map((q) => `- Pergunta: ${q.text}\n  Resposta: ${q.answer ?? ''}`).join('\n') || '(nenhuma)',
  ].join('\n');

  return [
    { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: variable },
  ];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/plan/prompt`
Expected: 5 passed.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/plan/prompt.ts src/plan/prompt.test.ts
git commit -m "feat(plan): monta o system prompt e o conteúdo do usuário (blocos estável/variável com cache_control)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Aplicar o `PlanOutput` (inbox, blocos no Cérebro, perguntas, sugestões)

**Files:**
- Create: `src/plan/apply.ts`

- [ ] **Step 1: Implementar `src/plan/apply.ts`**

```ts
import { getValidAccessToken } from '@/src/google/token';
import { deleteEvent, insertEvent, patchEvent, toGCalEventTime } from '@/src/google/calendar';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { deleteBlockRow, getBlock, insertBlockDraft, setBlockGcalEventId, updateBlock } from './blocks-repo';
import { insertFact } from '@/src/facts/repo';
import { markInboxIgnored, markInboxProcessed } from '@/src/inbox/repo';
import { createQuestion } from '@/src/questions/repo';
import { createSuggestion } from '@/src/manual/suggestions-repo';
import { MANUAL_SECTIONS } from '@/src/manual/sections';
import type { PlanOutput } from './schema';

export type ApplySummary = {
  blocksCreated: number;
  blocksUpdated: number;
  blocksDeleted: number;
  questionsCreated: number;
  suggestionsCreated: number;
};

export async function applyPlanOutput(output: PlanOutput, runId: number): Promise<ApplySummary> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);

  // 1. Inbox: vira fact, pergunta, ou é ignorado — sempre marca o item como processado.
  for (const item of output.inbox) {
    const interp = item.interpretation;
    if (interp.type === 'fact') {
      const factId = await insertFact({
        kind: interp.kind,
        title: interp.title,
        date: new Date(interp.date),
        endDate: interp.end_date ? new Date(interp.end_date) : null,
        allDay: interp.all_day,
        source: 'inbox',
        sourceRef: `inbox-${item.id}`,
        meta: {},
      });
      await markInboxProcessed(item.id, { factIds: [factId] });
    } else if (interp.type === 'question') {
      const questionId = await createQuestion(interp.text, { fromInboxId: item.id }, runId);
      await markInboxProcessed(item.id, { questionIds: [questionId] });
    } else {
      await markInboxIgnored(item.id, interp.why);
    }
  }

  // 2. Blocos: deletes → updates → creates (spec §4.5), cada escrita no Google Calendar tolerante a 404.
  for (const del of output.blocks.delete) {
    const block = await getBlock(del.id);
    if (block?.gcalEventId) await deleteEvent(accessToken, cerebroId, block.gcalEventId);
    await deleteBlockRow(del.id);
  }

  for (const upd of output.blocks.update) {
    const block = await getBlock(upd.id);
    if (!block) continue;
    if (block.gcalEventId) {
      await patchEvent(accessToken, cerebroId, block.gcalEventId, {
        summary: upd.title,
        start: toGCalEventTime(new Date(upd.start)),
        end: toGCalEventTime(new Date(upd.end)),
      });
    }
    await updateBlock(upd.id, { title: upd.title, start: new Date(upd.start), end: new Date(upd.end), reason: upd.reason }, runId);
  }

  for (const create of output.blocks.create) {
    const id = await insertBlockDraft(
      {
        title: create.title,
        start: new Date(create.start),
        end: new Date(create.end),
        kind: create.kind,
        factId: create.fact_id,
        reason: create.reason,
      },
      runId,
    );
    const eventId = await insertEvent(accessToken, cerebroId, {
      summary: create.title,
      start: toGCalEventTime(new Date(create.start)),
      end: toGCalEventTime(new Date(create.end)),
      blockId: id,
    });
    await setBlockGcalEventId(id, eventId);
  }

  // 3. Perguntas novas.
  for (const q of output.questions) {
    await createQuestion(q.text, q.context, runId);
  }

  // 4. Sugestões de manual — seção inválida (a Claude alucinou) cai em "Regras de planejamento" em vez de quebrar o run.
  for (const s of output.manual_suggestions) {
    const section = (MANUAL_SECTIONS as readonly string[]).includes(s.section) ? s.section : 'Regras de planejamento';
    await createSuggestion(section, s.text, s.from_question_id, runId);
  }

  return {
    blocksCreated: output.blocks.create.length,
    blocksUpdated: output.blocks.update.length,
    blocksDeleted: output.blocks.delete.length,
    questionsCreated: output.questions.length,
    suggestionsCreated: output.manual_suggestions.length,
  };
}
```

Sem teste unitário — é IO puro (Google Calendar + banco), seguindo o mesmo padrão de `src/facts/repo.ts` e dos coletores do Plano 2. A lógica de decisão (o que criar/atualizar/apagar) já vem pronta da Claude via `PlanOutputSchema` (Task 5); aqui só se aplica na ordem certa.

- [ ] **Step 2: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/plan/apply.ts
git commit -m "feat(plan): aplica o PlanOutput — inbox, blocos no Cérebro, perguntas, sugestões

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Motor local via Claude Code (subprocesso, sem API paga)

Leia `docs/superpowers/specs/2026-09-22-motor-local-claude-code-design.md` antes de começar — essa task implementa exatamente o desenho lá, já validado contra o binário real (`claude --help`) e uma chamada real (`--json-schema` + `--output-format json` devolve `structured_output` populado e `usage` com contagem de tokens de verdade).

**Files:**
- Create: `src/motor/claude-cli.ts`, `src/motor/claude-cli.test.ts`, `src/motor/run-claude-cli.ts`, `src/plan/engine.ts`, `scripts/run-plan-local.ts`, `scripts/run-plan-local.cmd`
- Modify: `.env.example`, `.gitignore`

- [ ] **Step 1: Adicionar a variável no `.env.example`**

```
# Motor local (Plano 3) — token de longa duração (1 ano) do Claude Code, gerado com
# `claude setup-token` (roda o claude.exe do app desktop com esse subcomando, sem
# argumento nenhum). Usa a assinatura, não cobra por token via API.
CLAUDE_CODE_OAUTH_TOKEN=

# Alias de modelo pro motor ('opus', 'sonnet', ou nome completo). Opcional, default 'opus'.
MOTOR_MODEL=opus
```

(No `.env` real, `CLAUDE_CODE_OAUTH_TOKEN` já está preenchido — foi gerado e colado durante o brainstorm desta task.)

- [ ] **Step 2: Ignorar a pasta de logs do launcher**

Adicionar ao `.gitignore` (append, não remover o que já existe):

```
logs/
```

- [ ] **Step 3: Escrever o teste de `src/motor/claude-cli.ts`**

`src/motor/claude-cli.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickLatestVersion } from './claude-cli';

describe('pickLatestVersion', () => {
  it('escolhe a versão mais alta por comparação numérica, não alfabética', () => {
    expect(pickLatestVersion(['2.1.9', '2.1.275', '2.1.30'])).toBe('2.1.275');
  });

  it('retorna null pra lista vazia', () => {
    expect(pickLatestVersion([])).toBeNull();
  });

  it('ignora entradas que não parecem versão (ex.: pastas soltas na mesma árvore)', () => {
    expect(pickLatestVersion(['2.1.5', 'not-a-version', '2.2.0'])).toBe('2.2.0');
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/motor/claude-cli`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 5: Implementar `src/motor/claude-cli.ts`**

```ts
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Compara versões tipo "2.1.275" numericamente, componente a componente — não como string. */
export function pickLatestVersion(versions: string[]): string | null {
  const parsed = versions
    .map((v) => ({ raw: v, parts: v.split('.').map(Number) }))
    .filter((v) => v.parts.length > 0 && v.parts.every((n) => Number.isFinite(n)));
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => {
    const len = Math.max(a.parts.length, b.parts.length);
    for (let i = 0; i < len; i++) {
      const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return parsed[parsed.length - 1].raw;
}

/** O app desktop instala o claude.exe numa pasta versionada dentro do pacote MSIX —
 * o número de versão muda a cada atualização, então isso precisa ser resolvido a cada
 * execução, nunca hardcoded (achado durante o brainstorm desta task, contra a instalação real). */
export async function findClaudeCliPath(): Promise<string> {
  const packagesDir = path.join(process.env.LOCALAPPDATA ?? '', 'Packages');
  const packageDirs = await readdir(packagesDir).catch(() => [] as string[]);
  const claudePackage = packageDirs.find((d) => d.startsWith('Claude_'));
  if (!claudePackage) throw new Error(`Não encontrei a pasta do app Claude em ${packagesDir}`);

  const claudeCodeDir = path.join(packagesDir, claudePackage, 'LocalCache', 'Roaming', 'Claude', 'claude-code');
  const versions = await readdir(claudeCodeDir).catch(() => [] as string[]);
  const latest = pickLatestVersion(versions);
  if (!latest) throw new Error(`Não encontrei nenhuma versão do Claude Code em ${claudeCodeDir}`);

  return path.join(claudeCodeDir, latest, 'claude.exe');
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/motor/claude-cli`
Expected: 3 passed.

- [ ] **Step 7: Implementar `src/motor/run-claude-cli.ts`**

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findClaudeCliPath } from './claude-cli';

const execFileAsync = promisify(execFile);

export type ClaudeCliResult = {
  structuredOutput: unknown;
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number };
};

type Envelope = {
  is_error: boolean;
  result: string;
  structured_output?: unknown;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

/** Roda `claude -p` com saída estruturada, num diretório neutro (sem CLAUDE.md do
 * projeto). Sem --bare de propósito: --bare exige ANTHROPIC_API_KEY e ignora
 * CLAUDE_CODE_OAUTH_TOKEN (confirmado no --help) — quebraria o uso da assinatura. */
export async function runClaudeCli(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  model: string;
}): Promise<ClaudeCliResult> {
  const claudePath = await findClaudeCliPath();
  const cwd = path.join(os.tmpdir(), 'segundo-cerebro-motor');
  await mkdir(cwd, { recursive: true });

  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(input.jsonSchema),
    '--system-prompt', input.systemPrompt,
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence',
    '--model', input.model,
    input.userPrompt,
  ];

  const { stdout } = await execFileAsync(claudePath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });

  const envelope = JSON.parse(stdout) as Envelope;

  if (envelope.is_error) {
    throw new Error(`Claude Code retornou erro: ${envelope.result}`);
  }
  if (envelope.structured_output === undefined) {
    throw new Error(`Claude Code não retornou structured_output — resposta: ${envelope.result}`);
  }

  return {
    structuredOutput: envelope.structured_output,
    usage: {
      inputTokens: envelope.usage.input_tokens,
      outputTokens: envelope.usage.output_tokens,
      cacheReadInputTokens: envelope.usage.cache_read_input_tokens,
      cacheCreationInputTokens: envelope.usage.cache_creation_input_tokens,
    },
  };
}
```

Sem teste unitário — é subprocesso (IO), mesmo padrão dos coletores do Plano 2. Verificado manualmente contra o binário real na Task 11.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 9: Implementar `src/plan/engine.ts`**

```ts
import { z } from 'zod';
import { runClaudeCli } from '@/src/motor/run-claude-cli';
import { collectAll } from '@/src/facts/collect';
import { getManual } from '@/src/manual/repo';
import { listKnowledgeFull } from '@/src/knowledge/repo';
import { listFactsInRange } from '@/src/facts/repo';
import { listBlocksInRange } from './blocks-repo';
import { fetchObservations } from './observations';
import { listNewInboxItems } from '@/src/inbox/repo';
import { listAnsweredSince } from '@/src/questions/repo';
import { createRun, finishRun, findLastRun, findRunningRun } from '@/src/runs/repo';
import { getCollectionWindow } from '@/src/facts/window';
import { buildSystemPrompt, buildUserContent } from './prompt';
import { PlanOutputSchema } from './schema';
import { applyPlanOutput } from './apply';

function getPromptWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const { end } = getCollectionWindow();
  return { start, end };
}

export async function runPlanEngine(trigger: 'cron' | 'manual'): Promise<number> {
  const running = await findRunningRun();
  if (running) throw new Error('Já existe um replanejamento em andamento.');

  const runId = await createRun(trigger);

  try {
    const collected = await collectAll();
    if (!collected.ok) throw new Error(collected.error ?? 'Falha ao coletar fontes');

    const { start, end } = getPromptWindow();
    const lastRun = await findLastRun();
    const since = lastRun?.startedAt ?? new Date(0);

    const [manual, knowledge, facts, blocks, observations, inboxItems, answered] = await Promise.all([
      getManual(),
      listKnowledgeFull(),
      listFactsInRange(start, end),
      listBlocksInRange(start, end),
      fetchObservations(),
      listNewInboxItems(),
      listAnsweredSince(since),
    ]);

    const today = new Date();
    const systemBlocks = buildSystemPrompt();
    const userBlocks = buildUserContent({
      manual: manual.content,
      knowledge,
      today,
      weekStart: start,
      weekEnd: end,
      facts,
      blocks,
      observations,
      inboxItems,
      answeredQuestions: answered,
    });

    // cache_control em buildSystemPrompt/buildUserContent é pra API da Anthropic — o
    // Claude Code local gerencia cache próprio, então só concatenamos o texto aqui.
    const systemPrompt = systemBlocks.map((b) => b.text).join('\n\n');
    const userPrompt = userBlocks.map((b) => b.text).join('\n\n');
    const jsonSchema = z.toJSONSchema(PlanOutputSchema) as Record<string, unknown>;

    const cliResult = await runClaudeCli({
      systemPrompt,
      userPrompt,
      jsonSchema,
      model: process.env.MOTOR_MODEL ?? 'opus',
    });

    const output = PlanOutputSchema.parse(cliResult.structuredOutput);

    await applyPlanOutput(output, runId);

    const conflictsSummary = output.conflicts.length
      ? `\n\nConflitos:\n${output.conflicts.map((c) => `- [${c.severity}] ${c.text}`).join('\n')}`
      : '';

    await finishRun(runId, {
      status: 'ok',
      inputTokens: cliResult.usage.inputTokens,
      cacheReadTokens: cliResult.usage.cacheReadInputTokens,
      outputTokens: cliResult.usage.outputTokens,
      summary: output.summary + conflictsSummary,
      conflicts: output.conflicts,
    });

    return runId;
  } catch (e) {
    await finishRun(runId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
```

- [ ] **Step 10: Implementar `scripts/run-plan-local.ts`**

```ts
import 'dotenv/config';
import { runPlanEngine } from '../src/plan/engine';

async function main() {
  const trigger = process.argv.includes('--cron') ? 'cron' : 'manual';
  const runId = await runPlanEngine(trigger);
  console.log(`[${new Date().toISOString()}] Run #${runId} concluído (trigger=${trigger}).`);
}

main().catch((e) => {
  console.error(`[${new Date().toISOString()}] Motor falhou:`, e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 11: Implementar `scripts/run-plan-local.cmd`**

```bat
@echo off
cd /d "C:\Users\arthu\segundo-cerebro"
if not exist logs mkdir logs
npx tsx scripts\run-plan-local.ts --cron >> logs\motor.log 2>&1
```

- [ ] **Step 12: Rodar a suíte inteira e typecheck**

Run: `npm test && npm run typecheck`
Expected: todos os testes (Plano 1+2 + os 3 novos de `claude-cli.test.ts`) passando; typecheck limpo.

- [ ] **Step 13: Commit**

```bash
git add src/motor src/plan/engine.ts scripts/run-plan-local.ts scripts/run-plan-local.cmd .env.example .gitignore
git commit -m "feat(plan): motor local — chama o Claude Code via subprocesso (assinatura, sem API paga), aplica o plano

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Tela Semana com blocos coloridos e conflitos

**Files:**
- Modify: `app/(app)/actions.ts`, `app/(app)/page.tsx`

- [ ] **Step 1: Adicionar `markBlockDone`, `markBlockSkipped` em `app/(app)/actions.ts`**

Adicionar ao arquivo existente (mantendo `refreshFacts` como está). Sem `replanejar` aqui — o motor só roda local (Task 8), não tem como o site disparar um processo na máquina do Arthur:

```ts
import { setBlockStatus } from '@/src/plan/blocks-repo';

export async function markBlockDone(formData: FormData) {
  await setBlockStatus(Number(formData.get('id')), 'done');
  revalidatePath('/');
}

export async function markBlockSkipped(formData: FormData) {
  await setBlockStatus(Number(formData.get('id')), 'skipped');
  revalidatePath('/');
}
```

- [ ] **Step 2: Reescrever `app/(app)/page.tsx`**

```tsx
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { listFactsInRange } from '@/src/facts/repo';
import type { CollectResult } from '@/src/facts/collect';
import { listBlocksInRange } from '@/src/plan/blocks-repo';
import { findLastRun } from '@/src/runs/repo';
import { addWeeks, formatWeekLabel, getWeekRange } from '@/src/facts/week';
import { markBlockDone, markBlockSkipped, refreshFacts } from './actions';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const BLOCK_COLOR: Record<string, string> = {
  study: 'var(--block-study)',
  task: 'var(--block-task)',
  travel: 'var(--block-travel)',
  buffer: 'var(--block-buffer)',
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Item =
  | { kind: 'fact'; id: number; date: Date; allDay: boolean; title: string; source: string }
  | { kind: 'block'; id: number; date: Date; allDay: boolean; title: string; blockKind: string; status: string; reason: string };

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const rawOffset = w ? Number(w) : 0;
  const offset = Number.isFinite(rawOffset) ? Math.max(-520, Math.min(520, rawOffset)) : 0;
  const base = addWeeks(new Date(), offset);
  const { start, end } = getWeekRange(base);

  const [facts, blocks, statusRow, lastRun] = await Promise.all([
    listFactsInRange(start, end),
    listBlocksInRange(start, end),
    db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'collect_status') }),
    findLastRun(),
  ]);
  const status = statusRow?.payload as CollectResult | undefined;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const items: Item[] = [
    ...facts.map((f): Item => ({ kind: 'fact', id: f.id, date: f.date, allDay: f.allDay, title: f.title, source: f.source })),
    ...blocks.map((b): Item => ({
      kind: 'block',
      id: b.id,
      date: b.start,
      allDay: false,
      title: b.title,
      blockKind: b.kind,
      status: b.status,
      reason: b.reason,
    })),
  ];

  const byDay = new Map<string, Item[]>();
  for (const item of items) {
    const key = dayKey(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const conflicts = (lastRun?.conflicts ?? []) as { text: string; severity: 'info' | 'warn' }[];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Semana</h1>
        <form action={refreshFacts}>
          <button type="submit" className="secondary">Atualizar fontes</button>
        </form>
      </div>

      {status?.error && <p className="card">Última coleta falhou: {status.error}</p>}
      {status?.warning && <p className="muted">{status.warning}</p>}

      {lastRun && (
        <p className="muted">
          Último planejamento: {lastRun.startedAt.toLocaleString('pt-BR')} · {lastRun.trigger} · {lastRun.status}
          {lastRun.summary ? ` · ${lastRun.summary.split('\n')[0]}` : ''}
          {' · roda automaticamente ao logar no Windows, ou na mão com scripts/run-plan-local.ts'}
        </p>
      )}
      {lastRun?.error && <p className="card">Último planejamento falhou: {lastRun.error}</p>}
      {conflicts.map((c, i) => (
        <p key={i} className="card">
          {c.severity === 'warn' ? '⚠️ ' : ''}
          {c.text}
        </p>
      ))}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <a href={`/?w=${offset - 1}`}>&larr; anterior</a>
        <strong>{formatWeekLabel(start, end)}</strong>
        <a href={`/?w=${offset + 1}`}>próxima &rarr;</a>
      </div>

      {days.map((d) => {
        const key = dayKey(d);
        const dayItems = byDay.get(key) ?? [];
        return (
          <div key={key} className="card">
            <strong>
              {WEEKDAYS[(d.getDay() + 6) % 7]} · {String(d.getDate()).padStart(2, '0')}/
              {String(d.getMonth() + 1).padStart(2, '0')}
            </strong>
            {dayItems.length === 0 && <p className="muted">Nada.</p>}
            {dayItems.map((item) =>
              item.kind === 'fact' ? (
                <div key={`fact-${item.id}`} className="row" style={{ gap: 8 }}>
                  <span style={{ color: 'var(--block-real)' }}>●</span>
                  <span>
                    {item.allDay ? '' : `${item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
                    {item.title}
                  </span>
                  <span className="muted">({item.source})</span>
                </div>
              ) : (
                <div key={`block-${item.id}`} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: BLOCK_COLOR[item.blockKind] ?? 'var(--block-buffer)' }}>●</span>
                  <div style={{ flex: 1 }}>
                    <div>
                      {item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {item.title}{' '}
                      <span className="muted">({item.status})</span>
                    </div>
                    <div className="muted">{item.reason}</div>
                    {item.status === 'planned' && (
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        <form action={markBlockDone}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="secondary">feito</button>
                        </form>
                        <form action={markBlockSkipped}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="secondary">não feito</button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        );
      })}
    </>
  );
}
```

**Desvio consciente do spec §5:** a tabela de cores pede `buffer` tracejado (não só uma cor sólida). Aqui todo tipo de bloco usa o mesmo "●" colorido — o tracejado é polimento visual puro, fica pra quando a grade horária de verdade (Plano 3+ futuro, mencionado no Plano 2) substituir essa lista por dia.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/actions.ts app/\(app\)/page.tsx
git commit -m "feat(semana): blocos coloridos por tipo, feito/não feito, banner de conflitos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Tela Pendências (perguntas + sugestões) e badge real na navegação

**Files:**
- Modify: `app/(app)/pendencias/page.tsx`, `app/(app)/layout.tsx`
- Create: `app/(app)/pendencias/actions.ts`

- [ ] **Step 1: Criar `app/(app)/pendencias/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { answerQuestion, dismissQuestion } from '@/src/questions/repo';
import { acceptSuggestion, rejectSuggestion } from '@/src/manual/suggestions-repo';

export async function answerQuestionAction(formData: FormData) {
  const answer = String(formData.get('answer') ?? '').trim();
  if (!answer) return;
  await answerQuestion(Number(formData.get('id')), answer);
  revalidatePath('/pendencias');
}

export async function dismissQuestionAction(formData: FormData) {
  await dismissQuestion(Number(formData.get('id')));
  revalidatePath('/pendencias');
}

export async function acceptSuggestionAction(formData: FormData) {
  const editedText = String(formData.get('text') ?? '').trim();
  await acceptSuggestion(Number(formData.get('id')), editedText || undefined);
  revalidatePath('/pendencias');
}

export async function rejectSuggestionAction(formData: FormData) {
  await rejectSuggestion(Number(formData.get('id')));
  revalidatePath('/pendencias');
}
```

- [ ] **Step 2: Reescrever `app/(app)/pendencias/page.tsx`**

```tsx
import { listOpenQuestions } from '@/src/questions/repo';
import { listPendingSuggestions } from '@/src/manual/suggestions-repo';
import {
  acceptSuggestionAction,
  answerQuestionAction,
  dismissQuestionAction,
  rejectSuggestionAction,
} from './actions';

export default async function PendenciasPage() {
  const [questions, suggestions] = await Promise.all([listOpenQuestions(), listPendingSuggestions()]);

  return (
    <>
      <h1>Pendências</h1>

      <h2>Perguntas ({questions.length})</h2>
      {questions.length === 0 && <p className="muted">Nenhuma pergunta em aberto.</p>}
      {questions.map((q) => (
        <div key={q.id} className="card">
          <div>{q.text}</div>
          <span className="muted">{q.askedAt.toLocaleString('pt-BR')}</span>
          <form action={answerQuestionAction} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={q.id} />
            <input type="text" name="answer" placeholder="Sua resposta" required />
            <button type="submit">Responder</button>
          </form>
          <form action={dismissQuestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={q.id} />
            <button type="submit" className="secondary">Dispensar</button>
          </form>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Sugestões de manual ({suggestions.length})</h2>
      {suggestions.length === 0 && <p className="muted">Nenhuma sugestão pendente.</p>}
      {suggestions.map((s) => (
        <div key={s.id} className="card">
          <div className="muted">{s.section}</div>
          <form action={acceptSuggestionAction}>
            <input type="hidden" name="id" value={s.id} />
            <textarea name="text" defaultValue={s.text} rows={2} />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="submit">Aceitar</button>
            </div>
          </form>
          <form action={rejectSuggestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="secondary">Rejeitar</button>
          </form>
        </div>
      ))}
    </>
  );
}
```

(O textarea já vem preenchido com o texto original — editar o texto e clicar "Aceitar" é o "editar e aceitar" do spec §5; aceitar sem editar usa o texto original.)

**Desvio consciente do spec §4.6:** o spec pede que, ao responder uma pergunta ou aceitar uma sugestão, a UI ofereça "replanejar agora?". Não implementado aqui — desde a decisão de rodar o motor só local (`docs/superpowers/specs/2026-09-22-motor-local-claude-code-design.md`), o site não tem como disparar um replanejamento de jeito nenhum; responder aqui só fica disponível pro motor na próxima vez que ele rodar (ao logar, ou manual via `scripts/run-plan-local.ts`).

- [ ] **Step 3: Atualizar `app/(app)/layout.tsx` com o badge real**

```tsx
import { signOut } from '@/auth';
import { countOpenQuestions } from '@/src/questions/repo';
import { countPendingSuggestions } from '@/src/manual/suggestions-repo';
import { Nav } from './nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [openQuestions, pendingSuggestions] = await Promise.all([countOpenQuestions(), countPendingSuggestions()]);

  const logout = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button type="submit" className="secondary">
        Sair
      </button>
    </form>
  );

  return (
    <>
      <Nav pendingCount={openQuestions + pendingSuggestions} logout={logout} />
      <main className="container">{children}</main>
    </>
  );
}
```

- [ ] **Step 4: Typecheck e verificar no navegador**

Run: `npm run typecheck && npm run dev` → http://localhost:3001/pendencias
Expected: sem erros; tela mostra "Nenhuma pergunta em aberto" e "Nenhuma sugestão pendente" (ainda não rodou o motor); badge da Pendências na nav mostra 0.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/pendencias app/\(app\)/layout.tsx
git commit -m "feat(pendencias): perguntas (responder/dispensar) e sugestões de manual (aceitar/editar/rejeitar) + badge real na nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Verificação de ponta a ponta, ajustes finos, docs

**Files:**
- Create: `docs/superpowers/plans/2026-09-22-plano-3-ESTADO.md`

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm run typecheck && npm test && npm run build`
Expected: sem erros; todos os testes (os do Plano 1+2 + os novos deste plano) passando; build completo. (`npm run build` só valida o site — o motor local não faz parte do build da Vercel.)

- [ ] **Step 2: Rodar o motor manualmente contra o mundo real**

Run: `npx tsx scripts/run-plan-local.ts`
Expected: termina sem erro, imprime `Run #N concluído (trigger=manual)`; `npx drizzle-kit studio` mostra a linha nova em `plan_runs` com `status='ok'`. Se houve algo pra planejar (facts na janela + manual com alguma regra), `plan_blocks` ganha linhas com `gcal_event_id` preenchido — confirme no Google Calendar que o evento apareceu no calendário "Cérebro". Se `plan_blocks` ficar vazia porque o Manual ainda não tem "Regras de planejamento" nenhuma, isso é esperado — o motor não inventa trabalho sem uma base no Manual; adicione uma linha simples ao Manual (ex.: "Provas exigem blocos de revisão de 2h no dia anterior") e rode de novo.

Se falhar com algo relacionado a autenticação, confirme que `CLAUDE_CODE_OAUTH_TOKEN` está preenchido no `.env` (gerado com `claude setup-token`).

- [ ] **Step 3: Verificar a trava de concorrência**

Run: rodar `npx tsx scripts/run-plan-local.ts` duas vezes em paralelo (dois terminais, quase ao mesmo tempo).
Expected: uma das duas falha rápido com "Já existe um replanejamento em andamento." (confirme em `plan_runs` que só uma linha nova de fato virou `status='ok'`).

- [ ] **Step 4: Testar Pendências**

Se o run gerou perguntas ou sugestões, abrir `npm run dev` → http://localhost:3001/pendencias, responder uma pergunta e aceitar uma sugestão. Expected: a pergunta some da lista de abertas; a sugestão aceita aparece como uma nova linha na seção correta do Manual (`/manual`); o badge da nav atualiza.

- [ ] **Step 5: Configurar o Agendador de Tarefas do Windows**

Manual (Arthur):
1. Abrir "Agendador de Tarefas" (Task Scheduler) → Criar Tarefa Básica.
2. Nome: "Segundo Cérebro — Motor". Gatilho: **Ao fazer logon** (não horário fixo — spec do motor local, §3).
3. Ação: Iniciar um programa → Programa/script: `C:\Users\arthu\segundo-cerebro\scripts\run-plan-local.cmd`.
4. Concluir. Testar clicando com o botão direito na tarefa criada → Executar, e conferir `logs\motor.log` dentro do repo.

- [ ] **Step 6: Criar `docs/superpowers/plans/2026-09-22-plano-3-ESTADO.md`**

```markdown
# Plano 3 — Motor — ESTADO

**Atualizado:** <data de hoje>
**Branch:** `master` (ou branch de trabalho), HEAD `<hash>`.
**Testes:** `npm test` → N/N passando · `npm run typecheck` limpo · `npm run build` completo passa.

## Tasks

| # | Task | Estado |
|---|---|---|
| 1 | plan_runs.conflicts + repo de runs | |
| 2 | Repos de apoio | |
| 3 | Escrita no Google Calendar | |
| 4 | Observações | |
| 5 | PlanOutputSchema | |
| 6 | Prompt | |
| 7 | Aplicar PlanOutput | |
| 8 | Motor local via Claude Code | |
| 9 | Semana com blocos | |
| 10 | Pendências + badge | |
| 11 | Verificação e2e | |

## Notas
- Primeiro run real: <resumo do que a Claude planejou, tokens gastos, algum ajuste de prompt feito depois>.
- Custo observado por run: <input/output/cache tokens do plan_runs>.

**Próximo:** ideias registradas no spec §9 (F1 plano de estudo detalhado, F2 executor remoto, F3 Microsoft Graph, F4 busca vetorial, F5 chat, F6 notas) — nenhuma delas é v1.
```

Preencher conforme a execução real.

- [ ] **Step 7: Commit final**

```bash
git add docs/superpowers/plans/2026-09-22-plano-3-ESTADO.md
git commit -m "docs: Plano 3 (Motor) completo — ESTADO

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Critério de pronto do Plano 3

- [ ] `npx tsx scripts/run-plan-local.ts` roda de ponta a ponta usando `CLAUDE_CODE_OAUTH_TOKEN` (sem `ANTHROPIC_API_KEY`, sem custo de API), respeitando a trava de concorrência (3 min)
- [ ] O motor escreve blocos no calendário "Cérebro" de verdade (confirmado no Google Calendar) e em `plan_blocks`
- [ ] Semana mostra blocos coloridos por tipo (study/task/travel/buffer) junto dos facts reais, com feito/não feito — sem botão Replanejar (motor é só local)
- [ ] Conflitos do último run aparecem na Semana; perguntas e sugestões aparecem em Pendências com badge real na nav
- [ ] Inbox processada vira facts/perguntas automaticamente após um run
- [ ] Edição manual do Arthur no Cérebro é detectada como "observação" e respeitada no run seguinte
- [ ] Tarefa no Agendador de Tarefas do Windows criada, disparando `scripts/run-plan-local.cmd` ao logar
- [ ] Testes novos passando (`observations`, `schema`, `prompt`, `claude-cli`) + todos os testes do Plano 1/2 continuam passando

**Próximo:** ideias fora da v1 registradas no spec §9 (plano de estudo detalhado, executor remoto, Microsoft Graph, busca vetorial, chat, notas).
