# Plano 1 — Fundação: scaffold, banco, login, Inbox, Manual, importador de memória

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site no ar, acessível de qualquer dispositivo, onde só o Arthur entra (Google), despeja texto na Inbox, edita o Manual e vê a memória do Claude importada — com o banco completo já criado para os planos 2 (fontes) e 3 (motor).

**Architecture:** Next.js 16 (App Router, server actions) na Vercel; Postgres (Neon) via Drizzle; Auth.js v5 com provider Google restrito a um e-mail, capturando o refresh token do Calendar já no primeiro login (cifrado em `oauth_tokens`). Domínio puro em `src/` com testes Vitest; telas em `app/`. Semana e Pendências nascem como placeholders — ganham conteúdo nos planos 2 e 3.

**Tech Stack:** Next 16.3, React 19, TypeScript 5, next-auth 5.0.0-beta.32, drizzle-orm 0.45 + drizzle-kit 0.31, @neondatabase/serverless 1.1, zod 4, gray-matter 4, vitest 5, tsx.

**Spec:** `docs/superpowers/specs/2026-09-15-segundo-cerebro-design.md` (§2 arquitetura, §3 modelo de dados, §5 telas Inbox/Manual, §6 importador, §7 segurança).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`, `.gitignore` | Configuração |
| `src/db/schema.ts` | Todas as tabelas do spec §3 (Drizzle) |
| `src/db/index.ts` | Conexão Neon + instância `db` |
| `drizzle/` | Migrações geradas pelo drizzle-kit |
| `src/crypto/tokens.ts` (+ `.test.ts`) | `encrypt`/`decrypt` AES-256-GCM para refresh tokens |
| `src/auth/allowlist.ts` (+ `.test.ts`) | `isAllowedEmail` |
| `auth.ts` | Config do Auth.js (Google, allowlist, captura do refresh token) |
| `app/api/auth/[...nextauth]/route.ts` | Handlers do Auth.js |
| `proxy.ts` | Bloqueia tudo sem sessão, exceto `/login` e `/api/auth/*` |
| `src/manual/sections.ts` (+ `.test.ts`) | Seções fixas, conteúdo inicial, `appendToSection` |
| `src/manual/repo.ts` | Ler/salvar o manual (linha única `id=1`) |
| `src/inbox/repo.ts` | Criar/listar/apagar `inbox_items` |
| `src/knowledge/parse.ts` (+ `.test.ts`) | Arquivo de memória → `{slug,title,content}`; `planSync` (upserts/deletes) |
| `src/knowledge/repo.ts` | Upsert/listar/apagar `knowledge` |
| `scripts/sync-knowledge.ts` | Importador CLI da memória do Claude Code |
| `app/globals.css`, `app/layout.tsx` | Paleta monocromática + tokens de cor por tipo de bloco |
| `app/login/page.tsx` | Botão "Entrar com Google" |
| `app/(app)/layout.tsx` | Nav de 4 telas + logout |
| `app/(app)/page.tsx` | Semana (placeholder) |
| `app/(app)/pendencias/page.tsx` | Pendências (placeholder) |
| `app/(app)/inbox/page.tsx`, `app/(app)/inbox/actions.ts` | Tela + server actions da Inbox |
| `app/(app)/manual/page.tsx`, `app/(app)/manual/actions.ts` | Tela + server action do Manual, lista de knowledge |

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "segundo-cerebro",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "sync-knowledge": "tsx scripts/sync-knowledge.ts"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "drizzle-orm": "^0.45.2",
    "gray-matter": "^4.0.3",
    "next": "^16.3.5",
    "next-auth": "5.0.0-beta.32",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.5",
    "dotenv": "^16.4.5",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^5.0.1"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "jsx": "react-jsx",
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["src", "app", "scripts", "auth.ts", "proxy.ts", "next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "drizzle"]
}
```

- [ ] **Step 3: Criar `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Criar `vitest.config.ts`**

`vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
```

- [ ] **Step 5: Criar `.gitignore` e `.env.example`**

`.gitignore`:
```
node_modules
.next
.env
.env.local
.vercel
tsconfig.tsbuildinfo
```

`.env.example`:
```
# Postgres (Neon ou qualquer Postgres)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Auth.js — gere com: openssl rand -base64 32
AUTH_SECRET=
# OAuth do Google Cloud (Task 5)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# Único e-mail que pode entrar
ALLOWED_EMAIL=arthurpaschoal500@gmail.com

# 32 bytes em base64 para cifrar refresh tokens — gere com: openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=

# Pasta da memória do Claude Code (importador)
CLAUDE_MEMORY_DIR=C:\Users\arthu\.claude\projects\C--Users-arthu\memory
```

- [ ] **Step 6: Criar `app/globals.css` com a paleta monocromática**

```css
:root {
  --bg: #ffffff;
  --fg: #111111;
  --muted: #6b6b6b;
  --line: #d9d9d9;
  --soft: #f3f3f3;

  /* Cor só nos blocos (spec §5) */
  --block-real: #3a3a3a;
  --block-study: #2f6fed;
  --block-task: #e8862a;
  --block-travel: #7d4fd1;
  --block-buffer: #bdbdbd;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}

a { color: inherit; }

button, input, textarea {
  font: inherit;
  color: inherit;
}

button {
  background: var(--fg);
  color: var(--bg);
  border: 1px solid var(--fg);
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
}

button.secondary {
  background: var(--bg);
  color: var(--fg);
}

textarea, input[type="text"] {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

.nav {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  padding: 8px 16px;
  position: sticky;
  top: 0;
  background: var(--bg);
  overflow-x: auto;
}

.nav a {
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  white-space: nowrap;
}

.nav a[aria-current="page"] {
  background: var(--fg);
  color: var(--bg);
}

.nav .spacer { flex: 1; }

.muted { color: var(--muted); }

.card {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
```

- [ ] **Step 7: Criar `app/layout.tsx` e `app/page.tsx` provisório**

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Segundo cérebro',
  description: 'Faculdade, trabalho e vida pessoal numa semana só.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx` (será movido para `app/(app)/page.tsx` na Task 8):
```tsx
export default function Home() {
  return <main className="container">ok</main>;
}
```

- [ ] **Step 8: Instalar e verificar build**

Run: `cd C:\Users\arthu\segundo-cerebro && npm install && npm run typecheck && npm run build`
Expected: instalação sem erros; typecheck sem erros; build termina com a rota `/` listada.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + vitest + paleta base

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Schema do banco (todas as tabelas do spec §3)

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Criar `src/db/schema.ts`**

```ts
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const inboxStatus = pgEnum('inbox_status', ['new', 'processed', 'ignored']);
export const factKind = pgEnum('fact_kind', ['event', 'deadline', 'task', 'info']);
export const factSource = pgEnum('fact_source', ['moodle', 'gcal', 'outlook', 'inbox']);
export const blockKind = pgEnum('block_kind', ['study', 'task', 'travel', 'buffer']);
export const blockStatus = pgEnum('block_status', ['planned', 'done', 'skipped']);
export const questionStatus = pgEnum('question_status', ['open', 'answered', 'dismissed']);
export const suggestionStatus = pgEnum('suggestion_status', ['pending', 'accepted', 'rejected']);
export const knowledgeSource = pgEnum('knowledge_source', ['claude-memory', 'note']);
export const runTrigger = pgEnum('run_trigger', ['cron', 'manual']);
export const runStatus = pgEnum('run_status', ['running', 'ok', 'error']);

export const planRuns = pgTable('plan_runs', {
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
});

export const inboxItems = pgTable('inbox_items', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  status: inboxStatus('status').notNull().default('new'),
  processedInto: jsonb('processed_into').$type<{ factIds?: number[]; questionIds?: number[]; why?: string }>(),
});

export const facts = pgTable(
  'facts',
  {
    id: serial('id').primaryKey(),
    kind: factKind('kind').notNull(),
    title: text('title').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    allDay: boolean('all_day').notNull().default(false),
    source: factSource('source').notNull(),
    sourceRef: text('source_ref').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('facts_source_ref_idx').on(t.source, t.sourceRef)],
);

export const planBlocks = pgTable('plan_blocks', {
  id: serial('id').primaryKey(),
  factId: integer('fact_id').references(() => facts.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  start: timestamp('start', { withTimezone: true }).notNull(),
  end: timestamp('end', { withTimezone: true }).notNull(),
  kind: blockKind('kind').notNull(),
  gcalEventId: text('gcal_event_id'),
  status: blockStatus('status').notNull().default('planned'),
  reason: text('reason').notNull(),
  prep: jsonb('prep').$type<Record<string, unknown>>(),
  createdRunId: integer('created_run_id').references(() => planRuns.id),
  updatedRunId: integer('updated_run_id').references(() => planRuns.id),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
  askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
  answer: text('answer'),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  status: questionStatus('status').notNull().default('open'),
  runId: integer('run_id').references(() => planRuns.id),
});

export const manual = pgTable('manual', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const manualSuggestions = pgTable('manual_suggestions', {
  id: serial('id').primaryKey(),
  section: text('section').notNull(),
  text: text('text').notNull(),
  fromQuestionId: integer('from_question_id').references(() => questions.id, { onDelete: 'set null' }),
  status: suggestionStatus('status').notNull().default('pending'),
  runId: integer('run_id').references(() => planRuns.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const knowledge = pgTable('knowledge', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: knowledgeSource('source').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // `embedding vector` entra quando o pgvector for ligado (spec §9 F4).
});

export const sourcesCache = pgTable('sources_cache', {
  source: text('source').primaryKey(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb('payload').$type<unknown>().notNull(),
});

export const oauthTokens = pgTable('oauth_tokens', {
  provider: text('provider').primaryKey(),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Nota: o spec §3 lista `embedding vector null` em `knowledge`. A coluna fica de fora da v1 porque exige a extensão pgvector; adicionar depois é uma migração de uma linha (`ALTER TABLE knowledge ADD COLUMN embedding vector(1024)`), sem impacto no código.

- [ ] **Step 2: Criar `src/db/index.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Só servidor: server components, server actions, rotas de API e scripts.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');

export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
```

- [ ] **Step 3: Criar `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: Criar o banco no Neon e o `.env`**

Manual:
1. https://console.neon.tech → New project → nome `segundo-cerebro`, região `aws-sa-east-1` (São Paulo) se disponível, senão `us-east-1`.
2. Copiar a connection string (pooled) e colar em `.env` como `DATABASE_URL=...`.
3. Preencher também `AUTH_SECRET` e `TOKEN_ENCRYPTION_KEY` com `openssl rand -base64 32` (dois valores diferentes) e `ALLOWED_EMAIL`.

- [ ] **Step 5: Gerar e aplicar a migração**

Run: `npm run db:generate && npm run db:migrate`
Expected: `drizzle/0000_*.sql` criado com as 10 tabelas e 10 enums; migrate termina sem erro.

Verificar: `npx drizzle-kit studio` abre e lista as tabelas (fechar com Ctrl+C).

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add -A
git commit -m "feat(db): schema completo do spec §3 + migração inicial

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Cifra de tokens (AES-256-GCM)

**Files:**
- Create: `src/crypto/tokens.ts`, `src/crypto/tokens.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/crypto/tokens.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './tokens';

const key = Buffer.alloc(32, 7).toString('base64');

describe('tokens', () => {
  it('cifra e decifra de volta ao original', () => {
    const enc = encrypt('1//refresh-token-xyz', key);
    expect(enc).not.toContain('refresh-token');
    expect(decrypt(enc, key)).toBe('1//refresh-token-xyz');
  });

  it('gera saídas diferentes para o mesmo texto (IV aleatório)', () => {
    expect(encrypt('a', key)).not.toBe(encrypt('a', key));
  });

  it('rejeita chave com tamanho errado', () => {
    expect(() => encrypt('a', Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('rejeita texto cifrado adulterado', () => {
    const enc = encrypt('segredo', key);
    const [iv, tag, data] = enc.split(':');
    expect(() => decrypt(`${iv}:${tag}:${data.slice(0, -2)}AA`, key)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/crypto`
Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 3: Implementar `src/crypto/tokens.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY precisa ter 32 bytes em base64');
  return key;
}

/** Saída: `iv:tag:dados`, tudo em base64. */
export function encrypt(plain: string, keyB64 = process.env.TOKEN_ENCRYPTION_KEY ?? ''): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
}

export function decrypt(payload: string, keyB64 = process.env.TOKEN_ENCRYPTION_KEY ?? ''): string {
  const key = loadKey(keyB64);
  const [iv, tag, data] = payload.split(':').map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/crypto`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/crypto
git commit -m "feat(crypto): cifra AES-256-GCM para refresh tokens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Allowlist de e-mail

**Files:**
- Create: `src/auth/allowlist.ts`, `src/auth/allowlist.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/auth/allowlist.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAllowedEmail } from './allowlist';

describe('isAllowedEmail', () => {
  it('aceita o e-mail permitido, ignorando caixa e espaços', () => {
    expect(isAllowedEmail(' Arthur@Gmail.com ', 'arthur@gmail.com')).toBe(true);
  });

  it('rejeita qualquer outro', () => {
    expect(isAllowedEmail('outro@gmail.com', 'arthur@gmail.com')).toBe(false);
  });

  it('rejeita vazio/indefinido', () => {
    expect(isAllowedEmail(undefined, 'arthur@gmail.com')).toBe(false);
    expect(isAllowedEmail('arthur@gmail.com', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/auth`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/auth/allowlist.ts`**

```ts
export function isAllowedEmail(
  email: string | null | undefined,
  allowed = process.env.ALLOWED_EMAIL ?? '',
): boolean {
  const a = allowed.trim().toLowerCase();
  const e = (email ?? '').trim().toLowerCase();
  return a !== '' && e === a;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/auth`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/auth
git commit -m "feat(auth): allowlist de um e-mail

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Login Google com Auth.js (captura do refresh token do Calendar)

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `proxy.ts`, `app/login/page.tsx`, `src/auth/tokens-repo.ts`

- [ ] **Step 1: Criar o OAuth client no Google Cloud (manual)**

1. https://console.cloud.google.com → novo projeto `segundo-cerebro`.
2. **APIs e serviços → Biblioteca** → ativar **Google Calendar API**.
3. **Tela de consentimento OAuth** → tipo *Externo* → nome do app, e-mail de suporte → **Usuários de teste**: adicionar `ALLOWED_EMAIL`. (Ficar em "teste" é suficiente: só o Arthur usa.)
4. **Credenciais → Criar credenciais → ID do cliente OAuth** → *Aplicativo da Web*:
   - URIs de redirecionamento: `http://localhost:3000/api/auth/callback/google` (produção entra na Task 10).
5. Copiar Client ID e Secret para `.env`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

- [ ] **Step 2: Criar `src/auth/tokens-repo.ts`**

```ts
import { db } from '@/src/db';
import { oauthTokens } from '@/src/db/schema';
import { encrypt } from '@/src/crypto/tokens';

export async function saveGoogleRefreshToken(refreshToken: string) {
  const enc = encrypt(refreshToken);
  await db
    .insert(oauthTokens)
    .values({ provider: 'google', refreshTokenEnc: enc, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { refreshTokenEnc: enc, updatedAt: new Date() },
    });
}
```

- [ ] **Step 3: Criar `auth.ts` na raiz**

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAllowedEmail } from '@/src/auth/allowlist';
import { saveGoogleRefreshToken } from '@/src/auth/tokens-repo';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          // offline + consent: é o único jeito de o Google devolver refresh_token.
          access_type: 'offline',
          prompt: 'consent',
          scope: `openid email profile ${CALENDAR_SCOPE}`,
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ profile, account }) {
      if (!isAllowedEmail(profile?.email)) return false;
      if (account?.refresh_token) await saveGoogleRefreshToken(account.refresh_token);
      return true;
    },
  },
});
```

- [ ] **Step 4: Criar `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Criar `proxy.ts` na raiz**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

// Next 16: `proxy.ts` é o antigo `middleware.ts`.
const PUBLIC = ['/login'];
const PUBLIC_PREFIXES = ['/api/auth/'];

function isPublic(pathname: string) {
  return PUBLIC.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await auth();
  if (session?.user) return NextResponse.next();

  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Se `auth()` sem argumentos reclamar de contexto fora de request no proxy, trocar por `export const proxy = auth((req) => { ... })` usando `req.auth` e `req.nextUrl` — é a forma documentada do Auth.js v5 para middleware; o nome do export continua `proxy`.

- [ ] **Step 6: Criar `app/login/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  const { next, error } = await searchParams;
  if (session?.user) redirect(next ?? '/');

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>Segundo cérebro</h1>
      <p className="muted">Só uma pessoa entra aqui.</p>
      {error === 'AccessDenied' && <p>Esse e-mail não é o permitido.</p>}
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: next ?? '/' });
        }}
      >
        <button type="submit">Entrar com Google</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Rodar e testar o fluxo à mão**

Run: `npm run dev`
1. Abrir http://localhost:3000 → deve redirecionar para `/login?next=/`.
2. Entrar com Google usando o e-mail permitido → consentimento pede acesso ao Calendar → volta para `/` com "ok".
3. `npx drizzle-kit studio` → tabela `oauth_tokens` tem uma linha `google` com `refresh_token_enc` no formato `xxx:yyy:zzz`.
4. Abrir janela anônima, entrar com outro e-mail → volta para `/login?error=AccessDenied` com a mensagem.

Expected: os 4 passos como descrito.

- [ ] **Step 8: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add -A
git commit -m "feat(auth): login Google restrito + captura do refresh token do Calendar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Domínio do Manual (seções fixas)

**Files:**
- Create: `src/manual/sections.ts`, `src/manual/sections.test.ts`, `src/manual/repo.ts`

- [ ] **Step 1: Escrever o teste**

`src/manual/sections.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_MANUAL, MANUAL_SECTIONS, appendToSection } from './sections';

describe('manual', () => {
  it('conteúdo inicial tem todas as seções, vazias', () => {
    for (const s of MANUAL_SECTIONS) expect(DEFAULT_MANUAL).toContain(`## ${s}`);
  });

  it('appendToSection adiciona bullet no fim da seção certa', () => {
    const out = appendToSection(DEFAULT_MANUAL, 'Pessoas', 'Aniversário da mãe: 20/09, costumo viajar');
    const pessoas = out.split('## Pessoas')[1].split('## Regras de planejamento')[0];
    expect(pessoas).toContain('- Aniversário da mãe: 20/09, costumo viajar');
    expect(out.split('## Faculdade')[1].split('## Trabalho')[0]).not.toContain('Aniversário');
  });

  it('appendToSection preserva bullets existentes e ordem', () => {
    const base = appendToSection(DEFAULT_MANUAL, 'Faculdade', 'Prova de Redes = 6h');
    const out = appendToSection(base, 'Faculdade', 'Prova de Comp. Paralela = 4h');
    const fac = out.split('## Faculdade')[1].split('## Trabalho')[0];
    expect(fac.indexOf('Redes')).toBeLessThan(fac.indexOf('Paralela'));
  });

  it('appendToSection cria a seção no fim se ela sumiu do texto', () => {
    const out = appendToSection('# Manual\n\n## Perfil\n', 'Trabalho', 'Home office às sextas');
    expect(out).toContain('## Trabalho\n\n- Home office às sextas');
  });

  it('rejeita seção desconhecida', () => {
    expect(() => appendToSection(DEFAULT_MANUAL, 'Hobbies', 'x')).toThrow(/seção/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/manual`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/manual/sections.ts`**

```ts
export const MANUAL_SECTIONS = [
  'Perfil',
  'Faculdade',
  'Trabalho',
  'Pessoas',
  'Regras de planejamento',
] as const;

export type ManualSection = (typeof MANUAL_SECTIONS)[number];

export const DEFAULT_MANUAL =
  '# Manual sobre o Arthur\n\n' + MANUAL_SECTIONS.map((s) => `## ${s}\n`).join('\n') + '\n';

function isSection(s: string): s is ManualSection {
  return (MANUAL_SECTIONS as readonly string[]).includes(s);
}

/** Adiciona `- line` no fim da seção `## section`. Cria a seção no fim se não existir. */
export function appendToSection(content: string, section: string, line: string): string {
  if (!isSection(section)) throw new Error(`Seção desconhecida: ${section}`);

  const header = `## ${section}`;
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === header);

  if (start === -1) {
    return content.replace(/\s*$/, '') + `\n\n${header}\n\n- ${line}\n`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  // Recua para antes das linhas em branco que separam da próxima seção.
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === '') insertAt--;

  const hasBody = insertAt > start + 1;
  const bullet = hasBody ? [`- ${line}`] : ['', `- ${line}`];
  lines.splice(insertAt, 0, ...bullet);

  return lines.join('\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/manual`
Expected: 5 passed.

- [ ] **Step 5: Criar `src/manual/repo.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { manual } from '@/src/db/schema';
import { DEFAULT_MANUAL } from './sections';

export async function getManual(): Promise<{ content: string; updatedAt: Date }> {
  const row = await db.query.manual.findFirst({ where: eq(manual.id, 1) });
  if (row) return { content: row.content, updatedAt: row.updatedAt };
  await db.insert(manual).values({ id: 1, content: DEFAULT_MANUAL });
  return { content: DEFAULT_MANUAL, updatedAt: new Date() };
}

export async function saveManual(content: string): Promise<void> {
  await db
    .insert(manual)
    .values({ id: 1, content, updatedAt: new Date() })
    .onConflictDoUpdate({ target: manual.id, set: { content, updatedAt: new Date() } });
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/manual
git commit -m "feat(manual): seções fixas, conteúdo inicial e appendToSection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Importador da memória do Claude Code (knowledge)

**Files:**
- Create: `src/knowledge/parse.ts`, `src/knowledge/parse.test.ts`, `src/knowledge/repo.ts`, `scripts/sync-knowledge.ts`

- [ ] **Step 1: Escrever o teste**

`src/knowledge/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseMemoryFile, planSync } from './parse';

const raw = `---
name: tcc-estado
description: Estado do TCC
metadata:
  type: project
---

# TCC

Texto do corpo.
`;

describe('parseMemoryFile', () => {
  it('extrai slug do frontmatter, título do description e corpo sem frontmatter', () => {
    const doc = parseMemoryFile('tcc_estado.md', raw);
    expect(doc).toEqual({
      slug: 'tcc-estado',
      title: 'Estado do TCC',
      content: '# TCC\n\nTexto do corpo.',
    });
  });

  it('usa o nome do arquivo quando não há frontmatter', () => {
    const doc = parseMemoryFile('user_profile.md', 'Só texto.');
    expect(doc.slug).toBe('user_profile');
    expect(doc.title).toBe('user_profile');
    expect(doc.content).toBe('Só texto.');
  });

  it('retorna null para MEMORY.md (índice, não conhecimento)', () => {
    expect(parseMemoryFile('MEMORY.md', '# Index')).toBeNull();
  });
});

describe('planSync', () => {
  it('separa upserts e deletes', () => {
    const plan = planSync(['a', 'b', 'c'], [{ slug: 'a', title: 'A', content: 'x' }, { slug: 'd', title: 'D', content: 'y' }]);
    expect(plan.upserts.map((d) => d.slug)).toEqual(['a', 'd']);
    expect(plan.deletes).toEqual(['b', 'c']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/knowledge`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/knowledge/parse.ts`**

```ts
import matter from 'gray-matter';

export type KnowledgeDoc = { slug: string; title: string; content: string };

export function parseMemoryFile(filename: string, raw: string): KnowledgeDoc | null {
  if (filename === 'MEMORY.md') return null;

  const { data, content } = matter(raw);
  const base = filename.replace(/\.md$/, '');
  const slug = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : base;
  const title =
    typeof data.description === 'string' && data.description.trim() ? data.description.trim() : slug;

  return { slug, title, content: content.trim() };
}

export function planSync(existingSlugs: string[], docs: KnowledgeDoc[]) {
  const incoming = new Set(docs.map((d) => d.slug));
  return {
    upserts: docs,
    deletes: existingSlugs.filter((s) => !incoming.has(s)),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/knowledge`
Expected: 4 passed.

- [ ] **Step 5: Criar `src/knowledge/repo.ts`**

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db';
import { knowledge } from '@/src/db/schema';
import type { KnowledgeDoc } from './parse';

export async function listKnowledge() {
  return db
    .select({
      id: knowledge.id,
      slug: knowledge.slug,
      title: knowledge.title,
      source: knowledge.source,
      updatedAt: knowledge.updatedAt,
    })
    .from(knowledge)
    .orderBy(knowledge.title);
}

export async function listClaudeMemorySlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: knowledge.slug })
    .from(knowledge)
    .where(eq(knowledge.source, 'claude-memory'));
  return rows.map((r) => r.slug);
}

export async function upsertClaudeMemory(doc: KnowledgeDoc) {
  await db
    .insert(knowledge)
    .values({ ...doc, source: 'claude-memory', updatedAt: new Date() })
    .onConflictDoUpdate({
      target: knowledge.slug,
      set: { title: doc.title, content: doc.content, updatedAt: new Date() },
    });
}

export async function deleteClaudeMemory(slugs: string[]) {
  if (slugs.length === 0) return;
  await db
    .delete(knowledge)
    .where(and(eq(knowledge.source, 'claude-memory'), inArray(knowledge.slug, slugs)));
}
```

- [ ] **Step 6: Criar `scripts/sync-knowledge.ts`**

```ts
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseMemoryFile, planSync, type KnowledgeDoc } from '../src/knowledge/parse';
import {
  deleteClaudeMemory,
  listClaudeMemorySlugs,
  upsertClaudeMemory,
} from '../src/knowledge/repo';

async function main() {
  const dir = process.env.CLAUDE_MEMORY_DIR;
  if (!dir) throw new Error('CLAUDE_MEMORY_DIR não definida');

  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const docs: KnowledgeDoc[] = [];
  for (const f of files) {
    const doc = parseMemoryFile(f, await readFile(join(dir, f), 'utf8'));
    if (doc) docs.push(doc);
  }

  const plan = planSync(await listClaudeMemorySlugs(), docs);
  for (const doc of plan.upserts) await upsertClaudeMemory(doc);
  await deleteClaudeMemory(plan.deletes);

  console.log(`knowledge: ${plan.upserts.length} upserts, ${plan.deletes.length} removidos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Os módulos de `src/` não importam `server-only` justamente para este script rodar no Node puro via `tsx`. O que impede uso indevido no cliente é o próprio bundler: `@neondatabase/serverless` e `node:crypto` não entram em client components.

- [ ] **Step 7: Rodar o importador**

Run: `npm run sync-knowledge`
Expected: `knowledge: N upserts, 0 removidos` com N ≈ 20. Confirmar em `npx drizzle-kit studio` que `knowledge` tem as linhas com `source = claude-memory`.

Rodar de novo: mesmos upserts, 0 removidos (idempotente).

- [ ] **Step 8: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/knowledge scripts
git commit -m "feat(knowledge): importador da memória do Claude Code

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Layout autenticado com navegação (4 telas)

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/nav.tsx`, `app/(app)/page.tsx`, `app/(app)/pendencias/page.tsx`
- Delete: `app/page.tsx`

- [ ] **Step 1: Criar `app/(app)/nav.tsx` (client, marca a aba atual)**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Semana' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/pendencias', label: 'Pendências' },
  { href: '/manual', label: 'Manual' },
];

export function Nav({ pendingCount, logout }: { pendingCount: number; logout: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => {
        const current = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
        const badge = it.href === '/pendencias' && pendingCount > 0 ? ` (${pendingCount})` : '';
        return (
          <Link key={it.href} href={it.href} aria-current={current ? 'page' : undefined}>
            {it.label}
            {badge}
          </Link>
        );
      })}
      <span className="spacer" />
      {logout}
    </nav>
  );
}
```

- [ ] **Step 2: Criar `app/(app)/layout.tsx`**

```tsx
import { signOut } from '@/auth';
import { Nav } from './nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // pendingCount vira consulta real no plano 3 (perguntas + sugestões abertas).
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
      <Nav pendingCount={0} logout={logout} />
      <main className="container">{children}</main>
    </>
  );
}
```

- [ ] **Step 3: Criar os placeholders e apagar `app/page.tsx`**

`app/(app)/page.tsx`:
```tsx
export default function SemanaPage() {
  return (
    <>
      <h1>Semana</h1>
      <p className="muted">A semana planejada aparece aqui a partir do plano 2 (eventos) e 3 (blocos).</p>
    </>
  );
}
```

`app/(app)/pendencias/page.tsx`:
```tsx
export default function PendenciasPage() {
  return (
    <>
      <h1>Pendências</h1>
      <p className="muted">Perguntas e sugestões do cérebro aparecem aqui a partir do plano 3.</p>
    </>
  );
}
```

Run: `git rm app/page.tsx`

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev` → http://localhost:3000
Expected: nav com Semana / Inbox / Pendências / Manual + Sair; Semana marcada; Sair volta para `/login`. Inbox e Manual dão 404 por enquanto.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): layout autenticado com navegação de 4 telas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Tela Inbox

**Files:**
- Create: `src/inbox/repo.ts`, `app/(app)/inbox/actions.ts`, `app/(app)/inbox/page.tsx`

- [ ] **Step 1: Criar `src/inbox/repo.ts`**

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { inboxItems } from '@/src/db/schema';

export async function addInboxItem(text: string) {
  const clean = text.trim();
  if (!clean) return;
  await db.insert(inboxItems).values({ text: clean });
}

export async function listInboxItems(limit = 50) {
  return db.select().from(inboxItems).orderBy(desc(inboxItems.createdAt)).limit(limit);
}

export async function deleteInboxItem(id: number) {
  await db.delete(inboxItems).where(eq(inboxItems.id, id));
}
```

- [ ] **Step 2: Criar `app/(app)/inbox/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { addInboxItem, deleteInboxItem } from '@/src/inbox/repo';

export async function sendToInbox(formData: FormData) {
  await addInboxItem(String(formData.get('text') ?? ''));
  revalidatePath('/inbox');
}

export async function removeFromInbox(formData: FormData) {
  await deleteInboxItem(Number(formData.get('id')));
  revalidatePath('/inbox');
}
```

- [ ] **Step 3: Criar `app/(app)/inbox/page.tsx`**

```tsx
import { listInboxItems } from '@/src/inbox/repo';
import { removeFromInbox, sendToInbox } from './actions';

const STATUS_LABEL = { new: 'aguardando o cérebro', processed: 'processado', ignored: 'ignorado' } as const;

function describe(item: Awaited<ReturnType<typeof listInboxItems>>[number]) {
  const p = item.processedInto;
  if (!p) return STATUS_LABEL[item.status];
  const parts: string[] = [];
  if (p.factIds?.length) parts.push(`→ ${p.factIds.length} fato(s)`);
  if (p.questionIds?.length) parts.push(`→ ${p.questionIds.length} pergunta(s)`);
  if (p.why) parts.push(p.why);
  return parts.join(' · ') || STATUS_LABEL[item.status];
}

export default async function InboxPage() {
  const items = await listInboxItems();

  return (
    <>
      <h1>Inbox</h1>
      <form action={sendToInbox}>
        <textarea
          name="text"
          rows={4}
          placeholder="prova de Redes terça 22/09 · niver da mãe 20/09 · reunião com o Pedro sexta 15h"
          required
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="submit">Enviar</button>
        </div>
      </form>

      <h2 style={{ marginTop: 24 }}>Itens</h2>
      {items.length === 0 && <p className="muted">Nada ainda.</p>}
      {items.map((item) => (
        <div key={item.id} className="card">
          <div>{item.text}</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">
              {item.createdAt.toLocaleString('pt-BR')} · {describe(item)}
            </span>
            <form action={removeFromInbox}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="secondary">
                Apagar
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev` → http://localhost:3000/inbox
Expected: enviar "prova de Redes terça 22/09" → aparece na lista com "aguardando o cérebro"; Apagar remove. Enviar texto vazio não cria item.

- [ ] **Step 5: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/inbox app/\(app\)/inbox
git commit -m "feat(inbox): despejar texto livre e listar itens

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Tela Manual (editor + knowledge + runs)

**Files:**
- Create: `app/(app)/manual/actions.ts`, `app/(app)/manual/page.tsx`, `src/runs/repo.ts`

- [ ] **Step 1: Criar `src/runs/repo.ts`**

```ts
import { desc } from 'drizzle-orm';
import { db } from '@/src/db';
import { planRuns } from '@/src/db/schema';

export async function listRecentRuns(limit = 30) {
  return db.select().from(planRuns).orderBy(desc(planRuns.startedAt)).limit(limit);
}
```

- [ ] **Step 2: Criar `app/(app)/manual/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { saveManual } from '@/src/manual/repo';

export async function updateManual(formData: FormData) {
  await saveManual(String(formData.get('content') ?? ''));
  revalidatePath('/manual');
}
```

- [ ] **Step 3: Criar `app/(app)/manual/page.tsx`**

```tsx
import { listKnowledge } from '@/src/knowledge/repo';
import { getManual } from '@/src/manual/repo';
import { listRecentRuns } from '@/src/runs/repo';
import { updateManual } from './actions';

export default async function ManualPage() {
  const [man, docs, runs] = await Promise.all([getManual(), listKnowledge(), listRecentRuns()]);

  return (
    <>
      <h1>Manual</h1>
      <p className="muted">
        Seções fixas: Perfil · Faculdade · Trabalho · Pessoas · Regras de planejamento. O cérebro só
        propõe linhas; quem escreve aqui é você.
      </p>
      <form action={updateManual}>
        <textarea name="content" rows={24} defaultValue={man.content} style={{ fontFamily: 'ui-monospace, monospace' }} />
        <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <span className="muted">Atualizado {man.updatedAt.toLocaleString('pt-BR')}</span>
          <button type="submit">Salvar</button>
        </div>
      </form>

      <h2 style={{ marginTop: 32 }}>Conhecimento ({docs.length})</h2>
      <p className="muted">
        Importado da memória do Claude Code. Para atualizar, rode <code>npm run sync-knowledge</code>{' '}
        na sua máquina.
      </p>
      {docs.map((d) => (
        <div key={d.id} className="card row" style={{ justifyContent: 'space-between' }}>
          <span>{d.title}</span>
          <span className="muted">
            {d.source} · {d.updatedAt.toLocaleDateString('pt-BR')}
          </span>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Planejamentos</h2>
      {runs.length === 0 && <p className="muted">Nenhum ainda — o motor chega no plano 3.</p>}
      {runs.map((r) => (
        <div key={r.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              {r.startedAt.toLocaleString('pt-BR')} · {r.trigger} · {r.status}
            </span>
            <span className="muted">
              {r.inputTokens ?? 0} in / {r.outputTokens ?? 0} out
            </span>
          </div>
          {r.summary && <div>{r.summary}</div>}
          {r.error && <div style={{ color: 'var(--fg)' }}>Erro: {r.error}</div>}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev` → http://localhost:3000/manual
Expected: textarea com o manual inicial (5 seções); adicionar "- Prova de Redes = 6h de estudo" em Faculdade e salvar → recarregar mantém; lista "Conhecimento" mostra os ~20 docs importados; "Planejamentos" mostra "Nenhum ainda".

- [ ] **Step 5: Typecheck, testes e commit**

Run: `npm run typecheck && npm test`
Expected: sem erros; 16 testes passando.

```bash
git add -A
git commit -m "feat(manual): editor do manual, lista de conhecimento e histórico de runs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Deploy na Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Criar `vercel.json`**

```json
{
  "framework": "nextjs",
  "regions": ["gru1"]
}
```

(`gru1` = São Paulo. O cron entra aqui no plano 3.)

- [ ] **Step 2: Criar o projeto e configurar env vars (manual)**

1. `npx vercel link` na pasta → criar projeto `segundo-cerebro`.
2. No dashboard da Vercel → Settings → Environment Variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `TOKEN_ENCRYPTION_KEY` (mesmos valores do `.env`; `CLAUDE_MEMORY_DIR` não precisa — o importador roda só local).
3. Google Cloud → Credenciais → adicionar URI de redirecionamento `https://<projeto>.vercel.app/api/auth/callback/google`.

- [ ] **Step 3: Deploy**

Run: `npx vercel --prod`
Expected: build ok, URL `https://segundo-cerebro-*.vercel.app`.

- [ ] **Step 4: Verificar em produção (do celular)**

1. Abrir a URL → `/login` → entrar com Google → Semana.
2. Inbox: enviar um item → aparece.
3. Manual: conteúdo salvo local está lá (mesmo banco).
4. Sair → volta para login.

- [ ] **Step 5: Commit e push**

```bash
git add vercel.json
git commit -m "chore: config Vercel (região gru1)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Criar repositório no GitHub (privado) e `git remote add origin ... && git push -u origin main`.

---

## Critério de pronto do Plano 1

- [ ] Login Google só com o e-mail permitido, em produção
- [ ] `oauth_tokens` tem o refresh token cifrado (base para o plano 2)
- [ ] Inbox recebe e lista texto livre
- [ ] Manual editável com as 5 seções; `appendToSection` testado (base para o plano 3)
- [ ] `knowledge` populado com a memória do Claude Code via `npm run sync-knowledge`
- [ ] 16 testes Vitest passando; `npm run typecheck` limpo
- [ ] Todas as 10 tabelas do spec §3 migradas

**Próximo:** Plano 2 — Fontes (client Google Calendar com refresh, calendário "Cérebro", coletores Moodle/GCal/Outlook → `facts`, observações, tela Semana com eventos reais).
