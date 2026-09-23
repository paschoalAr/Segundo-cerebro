# Plano 2 — Fontes: client Google Calendar, coletores Moodle/GCal/Outlook, tela Semana

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tabela `facts` passa a ser um espelho real do mundo do Arthur — eventos do Google Calendar, provas/entregas do Moodle e (se configurado) do Outlook corporativo — atualizável por um botão na tela Semana, que passa a mostrar a semana com eventos de verdade em vez do placeholder.

**Architecture:** Três coletores independentes (`src/sources/{gcal,moodle,outlook}.ts`) produzem `FactInput[]` a partir de cada fonte externa; um sincronizador genérico (`src/facts/repo.ts`) faz upsert/delete em `facts` por `(source, source_ref)`, igual ao padrão já usado no importador de `knowledge` (Plano 1, Task 7). O Google Calendar usa o refresh token já capturado no login (Plano 1, Task 5) — sem novo consentimento. Sem cron ainda: um botão "Atualizar fontes" na Semana dispara a coleta via server action. O motor de planejamento (blocos, perguntas, Claude API) fica para o Plano 3.

**Tech Stack:** o que já existe (Next 16, Drizzle, Neon) + `ical.js` (parse de .ics) novo. Sem `googleapis` — REST direto via `fetch` com o access token, para não trazer uma dependência pesada por pouca coisa (mesmo espírito de `node:crypto` puro no Plano 1).

**Desvio consciente do spec §5:** a Semana nasce aqui como lista de cards por dia (agenda), não como grade horária seg–dom. Uma grade de verdade precisa posicionar itens por hora — o que só faz sentido completo quando os blocos do cérebro (`plan_blocks`, coloridos por tipo) existirem também, no Plano 3. Reescrever a Semana como grade entra no Plano 3 junto com os blocos, pra não fazer o trabalho de layout duas vezes.

**Spec:** `docs/superpowers/specs/2026-09-15-segundo-cerebro-design.md` (§3 `facts`/`sources_cache`, §4.1 Coletar, §5 tela Semana, §6 integrações Google Calendar/Moodle/Outlook).

---

## Estado herdado do Plano 1 (não recriar)

- Todas as 10 tabelas do spec §3 já existem e estão migradas, inclusive `facts`, `sources_cache`, `oauth_tokens` — nenhuma migração nova neste plano.
- `oauth_tokens` já tem uma linha `google` com `refresh_token_enc`, capturada no login com escopo `https://www.googleapis.com/auth/calendar` — o app já pode chamar a API do Calendar sem novo consentimento.
- `.env` já tem `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`TOKEN_ENCRYPTION_KEY` — reaproveitados aqui (o refresh do access token usa `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`; a decifra do refresh token usa `TOKEN_ENCRYPTION_KEY` via `src/crypto/tokens.ts`, já pronto).

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/facts/cache.ts` (+ `.test.ts`) | `isCacheStale` — TTL genérico de 6h para `sources_cache` |
| `src/facts/sync.ts` (+ `.test.ts`) | `planFactSync` — separa upserts/deletes por `sourceRef`, mesmo padrão do `planSync` de knowledge |
| `src/facts/window.ts` (+ `.test.ts`) | `getCollectionWindow` — hoje → +21d |
| `src/facts/week.ts` (+ `.test.ts`) | `getWeekRange`, `addWeeks`, `formatWeekLabel` — semana seg–dom pra tela Semana |
| `src/facts/repo.ts` | `FactInput`, `syncFactsForSource` (upsert+delete em `facts`), `listFactsInRange` |
| `src/google/token.ts` (+ `.test.ts`) | `isExpired`, `getValidAccessToken` — renova o access token do Google via refresh token cifrado |
| `src/google/calendar.ts` (+ `.test.ts`) | Cliente REST do Calendar: `listCalendarList`, `listEvents`, `createCerebroCalendar`, `pickCerebroCalendar`, `mapGcalEventToFact` |
| `src/sources/gcal.ts` | `fetchGcalFacts` — orquestra token + calendários + eventos → `FactInput[]` |
| `src/sources/moodle.ts` (+ `.test.ts`) | Mappers puros (`mapMoodleUpcomingToFacts`, `mapMoodleAssignmentsToFacts`) + `fetchMoodleFacts` (IO, cache 6h) |
| `src/sources/outlook.ts` (+ `.test.ts`) | `mapIcsToFacts` (puro, via `ical.js`) + `fetchOutlookFacts` (IO, cache 6h, opcional) |
| `src/facts/collect.ts` | `collectAll` — roda os 3 coletores, aplica a regra "Outlook nunca derruba o run" |
| `app/(app)/actions.ts` | Server action `refreshFacts` — chama `collectAll`, guarda o resultado em `sources_cache` |
| `app/(app)/page.tsx` | Reescreve a Semana: grade por dia com os `facts` da semana, navegação anterior/próxima, botão Atualizar |

---

### Task 1: Utilitários puros de fatos (cache TTL, sync, janelas de data)

**Files:**
- Create: `src/facts/cache.ts`, `src/facts/cache.test.ts`, `src/facts/sync.ts`, `src/facts/sync.test.ts`, `src/facts/window.ts`, `src/facts/window.test.ts`, `src/facts/week.ts`, `src/facts/week.test.ts`

- [ ] **Step 1: Escrever os testes**

`src/facts/cache.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isCacheStale } from './cache';

describe('isCacheStale', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  it('fresco dentro do TTL', () => {
    expect(isCacheStale(new Date('2026-09-22T10:00:00Z'), now, 6 * 60 * 60 * 1000)).toBe(false);
  });

  it('vencido fora do TTL', () => {
    expect(isCacheStale(new Date('2026-09-22T05:00:00Z'), now, 6 * 60 * 60 * 1000)).toBe(true);
  });
});
```

`src/facts/sync.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planFactSync } from './sync';

describe('planFactSync', () => {
  it('separa upserts (tudo que veio) e deletes (o que sumiu)', () => {
    const plan = planFactSync(
      ['a', 'b', 'c'],
      [{ sourceRef: 'a', title: 'A' }, { sourceRef: 'd', title: 'D' }],
    );
    expect(plan.upserts.map((i) => i.sourceRef)).toEqual(['a', 'd']);
    expect(plan.deletes).toEqual(['b', 'c']);
  });

  it('sem nada existente, só upserts', () => {
    const plan = planFactSync([], [{ sourceRef: 'x', title: 'X' }]);
    expect(plan.deletes).toEqual([]);
  });
});
```

`src/facts/window.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getCollectionWindow } from './window';

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('getCollectionWindow', () => {
  it('vai de hoje 00:00 até +21 dias 23:59:59, no horário local', () => {
    const now = new Date(2026, 8, 22, 15, 30); // 22/09/2026 15:30 local
    const { start, end } = getCollectionWindow(now);
    expect(ymd(start)).toBe('2026-9-22');
    expect(start.getHours()).toBe(0);
    expect(ymd(end)).toBe('2026-10-13');
    expect(end.getHours()).toBe(23);
  });
});
```

`src/facts/week.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addWeeks, formatWeekLabel, getWeekRange } from './week';

describe('getWeekRange', () => {
  it('acha segunda a domingo quando a data é quarta', () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 23)); // quarta 23/09/2026
    expect(start.getDate()).toBe(21);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(27);
    expect(end.getHours()).toBe(23);
  });

  it('quando a data é domingo, a semana já começou na segunda anterior', () => {
    const { start, end } = getWeekRange(new Date(2026, 8, 27)); // domingo 27/09/2026
    expect(start.getDate()).toBe(21);
    expect(end.getDate()).toBe(27);
  });

  it('quando a data é segunda, a semana começa nela mesma', () => {
    const { start } = getWeekRange(new Date(2026, 8, 21)); // segunda 21/09/2026
    expect(start.getDate()).toBe(21);
  });
});

describe('addWeeks', () => {
  it('soma semanas preservando o dia da semana', () => {
    expect(addWeeks(new Date(2026, 8, 23), 1).getDate()).toBe(30);
  });

  it('aceita offset negativo', () => {
    expect(addWeeks(new Date(2026, 8, 23), -1).getDate()).toBe(16);
  });
});

describe('formatWeekLabel', () => {
  it('formata dd/mm – dd/mm', () => {
    expect(formatWeekLabel(new Date(2026, 8, 21), new Date(2026, 8, 27))).toBe('21/09 – 27/09');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/facts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 3: Implementar `src/facts/cache.ts`**

```ts
export function isCacheStale(fetchedAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - fetchedAt.getTime() > ttlMs;
}
```

- [ ] **Step 4: Implementar `src/facts/sync.ts`**

```ts
export function planFactSync<T extends { sourceRef: string }>(existingRefs: string[], incoming: T[]) {
  const seen = new Set(incoming.map((i) => i.sourceRef));
  return {
    upserts: incoming,
    deletes: existingRefs.filter((ref) => !seen.has(ref)),
  };
}
```

- [ ] **Step 5: Implementar `src/facts/window.ts`**

```ts
export function getCollectionWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 21);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
```

- [ ] **Step 6: Implementar `src/facts/week.ts`**

```ts
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0=domingo..6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export function formatWeekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(start)} – ${fmt(end)}`;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- src/facts`
Expected: 11 passed.

- [ ] **Step 8: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/facts/cache.ts src/facts/cache.test.ts src/facts/sync.ts src/facts/sync.test.ts src/facts/window.ts src/facts/window.test.ts src/facts/week.ts src/facts/week.test.ts
git commit -m "feat(facts): utilitários puros — TTL de cache, sync por sourceRef, janelas de data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Repositório de `facts`

**Files:**
- Create: `src/facts/repo.ts`

- [ ] **Step 1: Implementar `src/facts/repo.ts`**

```ts
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

export async function listFactsInRange(start: Date, end: Date) {
  return db
    .select()
    .from(facts)
    .where(and(gte(facts.date, start), lte(facts.date, end)))
    .orderBy(facts.date);
}
```

Sem teste unitário aqui — é IO puro de banco, no mesmo padrão de `src/inbox/repo.ts` e `src/knowledge/repo.ts` do Plano 1 (a lógica de decisão já está testada em `planFactSync`, Task 1). Verificação é manual, na Task 9.

- [ ] **Step 2: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/facts/repo.ts
git commit -m "feat(facts): repo — sync por fonte (upsert+delete) e leitura por intervalo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Renovação do access token do Google

**Files:**
- Create: `src/google/token.ts`, `src/google/token.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/google/token.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isExpired } from './token';

describe('isExpired', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  it('trata null como expirado', () => {
    expect(isExpired(null, now)).toBe(true);
  });

  it('considera expirado dentro da margem de segurança (60s)', () => {
    expect(isExpired(new Date('2026-09-22T12:00:30Z'), now)).toBe(true);
  });

  it('considera válido fora da margem', () => {
    expect(isExpired(new Date('2026-09-22T12:05:00Z'), now)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/google`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/google/token.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { oauthTokens } from '@/src/db/schema';
import { decrypt } from '@/src/crypto/tokens';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EXPIRY_BUFFER_MS = 60_000;

export function isExpired(expiresAt: Date | null, now: Date, bufferMs = EXPIRY_BUFFER_MS): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - bufferMs <= now.getTime();
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export async function getValidAccessToken(): Promise<string> {
  const row = await db.query.oauthTokens.findFirst({ where: eq(oauthTokens.provider, 'google') });
  if (!row) throw new Error('Sem oauth_tokens para o Google — faça login primeiro');

  if (row.accessToken && !isExpired(row.expiresAt, new Date())) return row.accessToken;

  const refreshToken = decrypt(row.refreshTokenEnc);
  const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);

  await db
    .update(oauthTokens)
    .set({ accessToken, expiresAt, updatedAt: new Date() })
    .where(eq(oauthTokens.provider, 'google'));

  return accessToken;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/google`
Expected: 3 passed.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/google/token.ts src/google/token.test.ts
git commit -m "feat(google): renovação do access token a partir do refresh token cifrado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Cliente do Google Calendar + coletor `gcal`

**Files:**
- Create: `src/google/calendar.ts`, `src/google/calendar.test.ts`, `src/sources/gcal.ts`

- [ ] **Step 1: Escrever o teste (só as funções puras)**

`src/google/calendar.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mapGcalEventToFact, pickCerebroCalendar } from './calendar';

describe('pickCerebroCalendar', () => {
  it('acha o calendário chamado Cérebro', () => {
    const id = pickCerebroCalendar([
      { id: 'a', summary: 'Pessoal' },
      { id: 'b', summary: 'Cérebro' },
    ]);
    expect(id).toBe('b');
  });

  it('retorna null se não existir', () => {
    expect(pickCerebroCalendar([{ id: 'a', summary: 'Pessoal' }])).toBeNull();
  });
});

describe('mapGcalEventToFact', () => {
  it('mapeia evento com hora', () => {
    const fact = mapGcalEventToFact('cal1', {
      id: 'evt1',
      summary: 'Reunião',
      status: 'confirmed',
      start: { dateTime: '2026-09-25T14:00:00-03:00' },
      end: { dateTime: '2026-09-25T15:00:00-03:00' },
    });
    expect(fact).toMatchObject({
      kind: 'event',
      title: 'Reunião',
      source: 'gcal',
      sourceRef: 'evt1',
      allDay: false,
      meta: { calendarId: 'cal1' },
    });
  });

  it('mapeia evento de dia inteiro e usa título padrão quando falta', () => {
    const fact = mapGcalEventToFact('cal1', {
      id: 'evt2',
      status: 'confirmed',
      start: { date: '2026-09-26' },
      end: { date: '2026-09-27' },
    });
    expect(fact.allDay).toBe(true);
    expect(fact.title).toBe('(sem título)');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/google/calendar`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/google/calendar.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/google/calendar`
Expected: 4 passed.

- [ ] **Step 5: Implementar `src/sources/gcal.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { getValidAccessToken } from '@/src/google/token';
import {
  createCerebroCalendar,
  listCalendarList,
  listEvents,
  mapGcalEventToFact,
  pickCerebroCalendar,
} from '@/src/google/calendar';
import { getCollectionWindow } from '@/src/facts/window';
import type { FactInput } from '@/src/facts/repo';

async function getCerebroCalendarId(accessToken: string): Promise<string> {
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

Nota: `cerebro_calendar` reaproveita `sources_cache` como config-por-chave (mesmo formato `source`/`payload` da tabela, só que sem TTL — o id de um calendário não muda). Evita migração nova só pra guardar um id.

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/google/calendar.ts src/google/calendar.test.ts src/sources/gcal.ts
git commit -m "feat(google): cliente REST do Calendar (calendários, eventos, calendário Cérebro) + coletor gcal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Coletor do Moodle

**Files:**
- Create: `src/sources/moodle.ts`, `src/sources/moodle.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Obter o `MOODLE_TOKEN` (manual, uma vez só)**

O token de web service **não** é a senha — é obtido uma vez e reutilizado. No seu terminal (troque `<SUA_SENHA>` pela sua senha do Moodle; não cole a senha em nenhum arquivo do projeto):

```bash
curl "https://moodle.pucrs.br/login/token.php?username=23102158&password=<SUA_SENHA>&service=moodle_mobile_app"
```

Retorna `{"token":"..."}`. Cole esse valor no `.env` como `MOODLE_TOKEN`. Confirme também seu `userid` (Perfil → Detalhes na URL, `?id=<userid>`; era `289018` da última vez que foi checado) e coloque em `MOODLE_USER_ID`.

- [ ] **Step 2: Adicionar as variáveis no `.env.example`**

```
# Moodle PUCRS (Plano 2) — token de web service obtido uma vez (não é usuário/senha)
MOODLE_URL=https://moodle.pucrs.br
MOODLE_TOKEN=
MOODLE_USER_ID=
```

Preencher os valores reais no `.env` (não no `.env.example`).

- [ ] **Step 3: Escrever o teste dos mappers**

`src/sources/moodle.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mapMoodleAssignmentsToFacts, mapMoodleUpcomingToFacts } from './moodle';

describe('mapMoodleUpcomingToFacts', () => {
  it('mapeia eventos do calendário, incluindo o nome da cadeira no título', () => {
    const facts = mapMoodleUpcomingToFacts([
      { id: 1, name: 'Prova P1', timestart: 1758560400, timeduration: 3600, eventtype: 'due', course: { fullname: 'Redes Avançadas' } },
    ]);
    expect(facts).toEqual([
      {
        kind: 'event',
        title: 'Prova P1 (Redes Avançadas)',
        date: new Date(1758560400 * 1000),
        endDate: new Date((1758560400 + 3600) * 1000),
        allDay: false,
        source: 'moodle',
        sourceRef: 'event-1',
        meta: { eventtype: 'due' },
      },
    ]);
  });

  it('ignora eventos sem timestart', () => {
    expect(mapMoodleUpcomingToFacts([{ id: 2, name: 'x', timestart: 0, timeduration: 0, eventtype: 'other', course: null }])).toEqual([]);
  });
});

describe('mapMoodleAssignmentsToFacts', () => {
  it('mapeia entregas com prazo, ignora as sem prazo (duedate=0)', () => {
    const facts = mapMoodleAssignmentsToFacts({
      courses: [
        {
          id: 10,
          fullname: 'Computação Paralela',
          assignments: [
            { id: 100, name: 'TPP1', duedate: 1758560400 },
            { id: 101, name: 'Sem prazo', duedate: 0 },
          ],
        },
      ],
    });
    expect(facts).toEqual([
      {
        kind: 'deadline',
        title: 'TPP1 (Computação Paralela)',
        date: new Date(1758560400 * 1000),
        endDate: null,
        allDay: false,
        source: 'moodle',
        sourceRef: 'assign-100',
        meta: { courseId: 10 },
      },
    ]);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/sources/moodle`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 5: Implementar `src/sources/moodle.ts`**

```ts
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

function moodleUrl(wsfunction: string, params: Record<string, string>): string {
  const base = process.env.MOODLE_URL ?? 'https://moodle.pucrs.br';
  const token = process.env.MOODLE_TOKEN ?? '';
  const qs = new URLSearchParams({ wstoken: token, moodlewsrestformat: 'json', wsfunction, ...params });
  return `${base}/webservice/rest/server.php?${qs}`;
}

async function fetchMoodleRaw(): Promise<{ upcoming: MoodleUpcomingEvent[]; assignments: MoodleAssignmentsResponse }> {
  const userId = process.env.MOODLE_USER_ID ?? '';

  const coursesRes = await fetch(moodleUrl('core_enrol_get_users_courses', { userid: userId }));
  const courses = (await coursesRes.json()) as MoodleCourse[];

  const upcomingRes = await fetch(
    moodleUrl('core_calendar_get_calendar_upcoming_view', { courseid: '0', categoryid: '0' }),
  );
  const upcomingData = (await upcomingRes.json()) as { events: MoodleUpcomingEvent[] };

  const courseIdParams: Record<string, string> = {};
  courses.forEach((c, i) => {
    courseIdParams[`courseids[${i}]`] = String(c.id);
  });
  const assignRes = await fetch(moodleUrl('mod_assign_get_assignments', courseIdParams));
  const assignments = (await assignRes.json()) as MoodleAssignmentsResponse;

  return { upcoming: upcomingData.events, assignments };
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
```

Se os nomes de campo reais do Moodle PUCRS divergirem um pouco do que está acima (ex.: `course` vs `coursename` em `core_calendar_get_calendar_upcoming_view`), ajuste os tipos e os dois mappers depois de olhar uma resposta real — a Task 9 (verificação manual) é o ponto de checar isso contra o Moodle de verdade.

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/sources/moodle`
Expected: 3 passed.

- [ ] **Step 7: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/sources/moodle.ts src/sources/moodle.test.ts .env.example
git commit -m "feat(moodle): coletor de eventos e entregas via web service, com cache de 6h

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Coletor do Outlook (.ics, opcional)

**Files:**
- Create: `src/sources/outlook.ts`, `src/sources/outlook.test.ts`
- Modify: `package.json`, `.env.example`

- [ ] **Step 1: Instalar `ical.js`**

Run: `npm install ical.js@^2.2.1`
Expected: `package.json` ganha `"ical.js": "^2.2.1"` em `dependencies`.

- [ ] **Step 2: Adicionar a variável no `.env.example`**

```
# Outlook corporativo (Plano 2) — opcional. Vazio desliga a fonte sem quebrar o run.
# Link .ics publicado: Outlook web > Configurações > Calendário > Calendários compartilhados > Publicar
OUTLOOK_ICS_URL=
```

- [ ] **Step 3: Escrever o teste do mapper**

`src/sources/outlook.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mapIcsToFacts } from './outlook';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-123@outlook.com
DTSTAMP:20260920T120000Z
DTSTART:20260925T170000Z
DTEND:20260925T180000Z
SUMMARY:Reunião de time
END:VEVENT
BEGIN:VEVENT
UID:evt-456@outlook.com
DTSTAMP:20260920T120000Z
DTSTART;VALUE=DATE:20260926
DTEND;VALUE=DATE:20260927
SUMMARY:Feriado
END:VEVENT
END:VCALENDAR`;

describe('mapIcsToFacts', () => {
  it('mapeia VEVENTs com hora e de dia inteiro', () => {
    const facts = mapIcsToFacts(ICS);
    expect(facts).toHaveLength(2);

    expect(facts[0]).toMatchObject({ title: 'Reunião de time', source: 'outlook', sourceRef: 'evt-123@outlook.com', allDay: false });
    expect(facts[1]).toMatchObject({ title: 'Feriado', source: 'outlook', sourceRef: 'evt-456@outlook.com', allDay: true });
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/sources/outlook`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 5: Implementar `src/sources/outlook.ts`**

```ts
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
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- src/sources/outlook`
Expected: 1 passed.

- [ ] **Step 7: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/sources/outlook.ts src/sources/outlook.test.ts package.json package-lock.json .env.example
git commit -m "feat(outlook): coletor opcional via .ics publicado, com cache de 6h

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Orquestrador de coleta + server action

**Files:**
- Create: `src/facts/collect.ts`, `app/(app)/actions.ts`

- [ ] **Step 1: Implementar `src/facts/collect.ts`**

```ts
import { syncFactsForSource } from './repo';
import { fetchGcalFacts } from '@/src/sources/gcal';
import { fetchMoodleFacts } from '@/src/sources/moodle';
import { fetchOutlookFacts } from '@/src/sources/outlook';

export type CollectResult = {
  ok: boolean;
  bySource: Partial<Record<'gcal' | 'moodle' | 'outlook', { upserts: number; deletes: number }>>;
  error?: string;
  warning?: string;
};

export async function collectAll(): Promise<CollectResult> {
  const bySource: CollectResult['bySource'] = {};

  try {
    const [gcalFacts, moodleFacts] = await Promise.all([fetchGcalFacts(), fetchMoodleFacts()]);
    bySource.gcal = await syncFactsForSource('gcal', gcalFacts);
    bySource.moodle = await syncFactsForSource('moodle', moodleFacts);
  } catch (e) {
    return { ok: false, bySource, error: e instanceof Error ? e.message : String(e) };
  }

  let warning: string | undefined;
  try {
    const outlookFacts = await fetchOutlookFacts();
    bySource.outlook = await syncFactsForSource('outlook', outlookFacts);
  } catch (e) {
    warning = `Outlook falhou (ignorado): ${e instanceof Error ? e.message : String(e)}`;
  }

  return { ok: true, bySource, warning };
}
```

Isso implementa a regra do spec §4.1: Google Calendar e Moodle são obrigatórios (qualquer erro cancela o resto e é reportado); Outlook nunca derruba a coleta, só vira aviso.

- [ ] **Step 2: Implementar `app/(app)/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { collectAll } from '@/src/facts/collect';

export async function refreshFacts() {
  const result = await collectAll();
  await db
    .insert(sourcesCache)
    .values({ source: 'collect_status', payload: result, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: result, fetchedAt: new Date() } });
  revalidatePath('/');
}
```

O resultado da última coleta fica guardado em `sources_cache` (`source='collect_status'`) pra Semana (Task 8) mostrar sucesso/erro sem precisar de estado em memória entre requests.

- [ ] **Step 3: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/facts/collect.ts app/\(app\)/actions.ts
git commit -m "feat(facts): orquestrador collectAll + server action refreshFacts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Tela Semana com eventos reais

**Files:**
- Modify: `app/(app)/page.tsx`

- [ ] **Step 1: Reescrever `app/(app)/page.tsx`**

```tsx
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { listFactsInRange } from '@/src/facts/repo';
import type { CollectResult } from '@/src/facts/collect';
import { addWeeks, formatWeekLabel, getWeekRange } from '@/src/facts/week';
import { refreshFacts } from './actions';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const offset = w ? Number(w) : 0;
  const base = addWeeks(new Date(), Number.isFinite(offset) ? offset : 0);
  const { start, end } = getWeekRange(base);

  const [items, statusRow] = await Promise.all([
    listFactsInRange(start, end),
    db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'collect_status') }),
  ]);
  const status = statusRow?.payload as CollectResult | undefined;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = dayKey(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Semana</h1>
        <form action={refreshFacts}>
          <button type="submit">Atualizar fontes</button>
        </form>
      </div>

      {status?.error && <p className="card">Último run falhou: {status.error}</p>}
      {status?.warning && <p className="muted">{status.warning}</p>}

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
            {dayItems.map((item) => (
              <div key={item.id} className="row" style={{ gap: 8 }}>
                <span style={{ color: 'var(--block-real)' }}>●</span>
                <span>
                  {item.allDay ? '' : `${item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
                  {item.title}
                </span>
                <span className="muted">({item.source})</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Verificar no navegador**

Run: `npm run dev` → http://localhost:3001
Expected (mesmo sem ter clicado em Atualizar ainda): 7 cards, um por dia da semana atual, todos "Nada." — sem erros no console.

- [ ] **Step 3: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add app/\(app\)/page.tsx
git commit -m "feat(semana): grade por dia com facts reais, navegação de semana e botão Atualizar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação de ponta a ponta, ajustes finos e docs

**Files:**
- Modify: `docs/superpowers/plans/2026-09-18-plano-1-ESTADO.md` → renomear conceito, ou criar `docs/superpowers/plans/2026-09-22-plano-2-ESTADO.md` novo (preferir o novo arquivo, mesmo padrão do Plano 1)

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm run typecheck && npm test`
Expected: sem erros; todos os testes (18 do Plano 1 + os novos deste plano) passando.

- [ ] **Step 2: Clicar em "Atualizar fontes" local e conferir o Google Calendar**

Run: `npm run dev` → http://localhost:3001 → clicar **Atualizar fontes**.
Expected: sem erro na tela; `npx drizzle-kit studio` mostra `sources_cache` com uma linha `cerebro_calendar` (o app criou o calendário "Cérebro" na sua conta Google — confirme em calendar.google.com que ele existe) e uma linha `moodle`; `facts` tem linhas com `source='gcal'` pros seus eventos reais dos próximos 21 dias.

- [ ] **Step 3: Conferir o Moodle**

Se `facts` não tiver nenhuma linha `source='moodle'`, ou se o card de erro aparecer na Semana mencionando Moodle: abra os tipos em `src/sources/moodle.ts` contra uma resposta real (`curl` a mesma URL que `moodleUrl(...)` monta, com seu `MOODLE_TOKEN`) e ajuste os nomes de campo dos mappers (Task 5) — os wsfunctions do Moodle são estáveis, mas confirme contra a instância real da PUCRS.

- [ ] **Step 4: Outlook (se `OUTLOOK_ICS_URL` estiver configurada)**

Confirme que `facts` ganha linhas `source='outlook'`. Se não tiver link publicado ainda, deixe a variável vazia — a Semana deve funcionar normalmente sem avisos de erro (só sem esses eventos).

- [ ] **Step 5: Testar a navegação de semana**

Clicar em "próxima →" e "← anterior" repetidas vezes. Expected: a data no topo muda em blocos de 7 dias; nenhuma segunda-feira falta ao rodar `getWeekRange` pra qualquer dia clicado.

- [ ] **Step 6: Configurar as mesmas env vars em produção**

No dashboard da Vercel → Settings → Environment Variables, adicionar `MOODLE_URL`, `MOODLE_TOKEN`, `MOODLE_USER_ID` e (se tiver) `OUTLOOK_ICS_URL`. Depois: `npx vercel --prod`.

- [ ] **Step 7: Verificar em produção**

Abrir a URL de produção → Semana → Atualizar fontes → mesmos resultados do Step 2–4.

- [ ] **Step 8: Criar `docs/superpowers/plans/2026-09-22-plano-2-ESTADO.md`**

```markdown
# Plano 2 — Fontes — ESTADO

**Atualizado:** <data de hoje>
**Branch:** `master` (ou branch de trabalho, se usado), HEAD `<hash>`.
**Testes:** `npm test` → N/N passando · `npm run typecheck` limpo.

## Tasks

| # | Task | Estado |
|---|---|---|
| 1 | Utilitários puros (cache, sync, janelas) | |
| 2 | Repo de facts | |
| 3 | Renovação do access token Google | |
| 4 | Cliente Calendar + coletor gcal | |
| 5 | Coletor Moodle | |
| 6 | Coletor Outlook | |
| 7 | Orquestrador + server action | |
| 8 | Tela Semana | |
| 9 | Verificação e2e | |

## Notas
- Calendário "Cérebro" criado na conta Google em: <data>.
- Ajustes feitos nos mappers do Moodle em relação ao plano original (se algum campo divergiu).

**Próximo:** Plano 3 — Motor (Claude API monta o plano da semana, escreve blocos no calendário Cérebro, perguntas e sugestões de manual). Ainda não escrito.
```

Preencher a tabela conforme a execução real.

- [ ] **Step 9: Commit final**

```bash
git add docs/superpowers/plans/2026-09-22-plano-2-ESTADO.md
git commit -m "docs: Plano 2 (Fontes) completo — ESTADO

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Critério de pronto do Plano 2

- [ ] `facts` populada com eventos reais de Google Calendar e Moodle (Outlook se configurado), refletindo os próximos 21 dias
- [ ] Botão "Atualizar fontes" na Semana dispara a coleta e atualiza a tela sem reload manual
- [ ] Calendário "Cérebro" existe na conta Google do Arthur (criado automaticamente na primeira coleta)
- [ ] Falha em Moodle ou Google Calendar cancela o run e mostra o erro; falha em Outlook só avisa
- [ ] Navegação anterior/próxima na Semana funciona para qualquer semana
- [ ] Testes novos passando (utilitários puros de `facts`, mappers de `moodle`/`outlook`/`gcal`) + os 18 do Plano 1 continuam passando
- [ ] Mesmas env vars de fontes configuradas em produção (Vercel)

**Próximo:** Plano 3 — Motor (prompt com Manual + knowledge + facts, Claude API monta blocos de estudo/tarefa/viagem, escreve no calendário Cérebro, gera perguntas e sugestões de manual, cron diário).
