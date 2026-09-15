# `<nome>` — Segundo cérebro pessoal — Design v1

**Data:** 2026-09-15
**Status:** aprovado em conversa, aguardando revisão do spec escrito
**Nome do projeto:** em aberto (candidatos: Regente, Bússola, Cortex, Sherpa, Pauta). Pasta provisória `segundo-cerebro/`.

## 1. Objetivo

Um sistema que junta faculdade, trabalho e vida pessoal numa única visão, **infere consequências** a partir de fatos (prova terça → horas de estudo antes) e **pergunta quando não sabe** (aniversário da mãe → vai viajar?), guardando cada resposta como regra para os próximos planejamentos. Acessível de qualquer dispositivo via web.

**v1 = "Semana planejada":** lê Moodle + Google Calendar + Outlook (.ics) + o que o Arthur despeja numa inbox de texto livre → monta a semana em blocos de estudo/tarefa/viagem → escreve os blocos num calendário "Cérebro" do Google Calendar → aponta conflitos → faz perguntas → propõe linhas para um "manual sobre o Arthur" que o Arthur aprova e edita.

**Usuário:** só o Arthur. Sem multiusuário.

### Fora da v1 (registrado em §9 Futuro)

Chat com contexto, plano de estudo detalhado por bloco, executor remoto no PC, Microsoft Graph, busca vetorial, notificações push, arrastar blocos na grade, temas.

## 2. Arquitetura

```
┌─────────────────────── <nome> (Next.js @ Vercel) ───────────────────────────────┐
│                                                                                 │
│  UI (mobile-first, monocromática)         Cron diário 06:00 (Vercel Cron)       │
│  ├─ Semana        (plano + conflitos)      └─► POST /api/plan                    │
│  ├─ Inbox         (texto livre)                  1. coletar fontes → facts       │
│  ├─ Pendências    (perguntas + sugestões)        2. montar prompt (manual,       │
│  └─ Manual        (regras + knowledge + runs)       knowledge, facts, inbox…)    │
│                                                  3. Claude API → plano JSON      │
│  Postgres (Neon) via Drizzle                     4. diff vs. plan_blocks         │
│  inbox_items · facts · plan_blocks · questions   5. escrever no GCal "Cérebro"   │
│  manual · manual_suggestions · knowledge         6. salvar perguntas/sugestões   │
│  plan_runs · sources_cache · oauth_tokens                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
      │ leitura          │ leitura            │ leitura           │ escrita
      ▼                  ▼                    ▼                   ▼
 Moodle PUCRS       Google Calendar       Outlook (.ics)     Google Calendar
 (token WS)         (calendários do       (link publicado)   (calendário "Cérebro")
                     Arthur)
```

### Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde o plano "mora" | Google Calendar, num calendário separado chamado **Cérebro** | Celular já mostra e notifica; o site vira painel de controle, não precisa construir calendário. O app só cria/edita/apaga eventos nesse calendário — nunca toca nos eventos reais |
| Canal de entrada e de perguntas | Só o site | Menos infra. Perguntas viram uma seção "Pendências" com badge |
| Planejamento | Job (cron + botão), não chat | Custo previsível, comportamento reproduzível, fácil de logar |
| Memória curada | **Manual**: um documento markdown, seções fixas | Cabe sempre no prompt, transparente, o Arthur edita direto |
| Memória ampla | **knowledge**: tabela de documentos markdown, importados da memória do Claude Code | Contexto de vida sem precisar re-explicar. Na v1 entra inteira no prompt; vetorial só quando crescer (§9 F4) |
| Login | Google OAuth, allowlist de um e-mail | Um consentimento resolve auth + Calendar |
| Stack | Next.js (App Router) + TypeScript + Postgres (Neon) + Drizzle + `@anthropic-ai/sdk` + Vercel | O Arthur já faz deploy na Vercel; sem fila/worker |
| Edição do Arthur no GCal | **Não trava, só aprende**: vira observação no próximo run; o prompt instrui a manter a versão do Arthur salvo conflito real | Evita cabo-de-guerra e ainda gera regra pro manual |
| Visual | Preto/branco/cinzas em toda a UI; **cor só nos blocos**, uma por tipo | Cor significa algo, não decora |

## 3. Modelo de dados

| Tabela | Campos | Uso |
|---|---|---|
| `inbox_items` | `id, text, created_at, status ('new'\|'processed'\|'ignored'), processed_into jsonb` | Texto bruto despejado pelo Arthur. `processed_into` guarda o que virou (fact ids, question ids) |
| `facts` | `id, kind ('event'\|'deadline'\|'task'\|'info'), title, date, end_date?, all_day bool, source ('moodle'\|'gcal'\|'outlook'\|'inbox'), source_ref, meta jsonb, first_seen, last_seen` | Snapshot unificado do mundo. Fontes externas fazem upsert por `(source, source_ref)`; itens que sumiram da fonte são apagados. Facts de `inbox` persistem até o Arthur apagar |
| `plan_blocks` | `id, fact_id?, title, start, end, kind ('study'\|'task'\|'travel'\|'buffer'), gcal_event_id, status ('planned'\|'done'\|'skipped'), reason text, prep jsonb null, created_run_id, updated_run_id` | Blocos criados pelo cérebro. `reason` = justificativa legível. `prep` fica vazio na v1 (reservado para §9 F1/F2) |
| `questions` | `id, text, context jsonb, asked_at, answer text?, answered_at?, status ('open'\|'answered'\|'dismissed'), run_id` | Perguntas do cérebro |
| `manual` | `id=1, content text (markdown), updated_at` | O manual. Seções fixas: Perfil · Faculdade · Trabalho · Pessoas · Regras de planejamento |
| `manual_suggestions` | `id, section, text, from_question_id?, status ('pending'\|'accepted'\|'rejected'), run_id` | Linhas que o cérebro quer adicionar. Aceitar = append na seção do manual |
| `knowledge` | `id, slug unique, title, content text, source ('claude-memory'\|'note'), updated_at, embedding vector null` | Memória ampla. `embedding` nulo na v1 |
| `plan_runs` | `id, started_at, finished_at?, trigger ('cron'\|'manual'), status ('ok'\|'error'), input_tokens, cache_read_tokens, output_tokens, summary text?, error text?` | Log de cada planejamento |
| `sources_cache` | `source, fetched_at, payload jsonb` | Última resposta de cada fonte (TTL 6h para Moodle e Outlook) |
| `oauth_tokens` | `provider='google', refresh_token (cifrado), access_token, expires_at` | Tokens do Google |

## 4. Fluxo de planejamento (`POST /api/plan`)

### 4.1 Coletar

| Fonte | Como | Janela | Vira |
|---|---|---|---|
| Moodle | Web services com token existente: `core_calendar_get_calendar_upcoming_view` + `mod_assign_get_assignments`. Cache 6h | hoje → +21d | `facts(source=moodle)` |
| Google Calendar | `events.list` em cada calendário do Arthur (exceto "Cérebro") | hoje → +21d | `facts(source=gcal)` |
| Outlook | Download do link .ics publicado, parse com `ical.js`. Cache 6h | hoje → +21d | `facts(source=outlook)` |
| Calendário "Cérebro" | `events.list`; casa com `plan_blocks` por `extendedProperties.private.block_id` | −7d → +21d | Estado atual dos blocos + **observações** (bloco cujo `start/end/summary` no GCal difere do `plan_blocks` = "Arthur moveu X de A para B"; bloco apagado no GCal = "Arthur removeu X") |
| Inbox | `inbox_items` com `status='new'` | — | Brutos, vão direto pro prompt |
| Perguntas | `questions` respondidas desde o último run | — | Vão pro prompt como "respostas novas" |

Qualquer fonte falhando (exceto Outlook, que é opcional e só gera aviso) **cancela o run** com `status='error'`. Não planeja com metade do mundo.

### 4.2 Montar prompt

```
system  (estável, cache_control):
  papel do cérebro · regras de comportamento (§4.4) · formato de saída
user:
  [bloco estável, cache_control]  Manual · knowledge (todos os docs)
  [bloco variável]                hoje=<data> · semana=<seg..dom>
                                  facts (janela) · plan_blocks atuais (com status)
                                  observações · inbox brutos · respostas novas
```

Estimativa: ~20k tokens de entrada (manual 3k + knowledge 12k + resto 5k), ~3k de saída.

### 4.3 Chamar Claude

- Modelo `claude-opus-5`, thinking adaptativo, `output_config.effort: "high"`, `max_tokens: 16000`.
- **Structured outputs** (`output_config.format`) com o schema Zod abaixo — sem parse frágil.
- Prompt caching nos dois blocos estáveis. O cron diário não aproveita (TTL 5 min), mas replanejamentos manuais seguidos sim.
- Modelo trocável por env `PLANNER_MODEL` (Sonnet 5 para cortar custo, decisão do Arthur).

```ts
const PlanOutput = z.object({
  inbox: z.array(z.object({
    id: z.number(),
    interpretation: z.discriminatedUnion("type", [
      z.object({ type: z.literal("fact"), kind, title, date, end_date: z.string().nullable(), all_day: z.boolean() }),
      z.object({ type: z.literal("question"), text: z.string() }),
      z.object({ type: z.literal("ignore"), why: z.string() }),
    ]),
  })),
  blocks: z.object({
    create: z.array(z.object({ title, start, end, kind, fact_id: z.number().nullable(), reason })),
    update: z.array(z.object({ id, title, start, end, reason })),
    delete: z.array(z.object({ id, reason })),
  }),
  conflicts: z.array(z.object({ text: z.string(), severity: z.enum(["info","warn"]) })),
  questions: z.array(z.object({ text: z.string(), context: z.record(z.unknown()) })),
  manual_suggestions: z.array(z.object({ section, text, from_question_id: z.number().nullable() })),
  summary: z.string(),
});
```

### 4.4 Regras de comportamento (no system prompt)

1. **Idempotente**: sem nada novo, não emite `update`/`delete`. Só diffs em relação aos `plan_blocks` recebidos.
2. **Passado é imutável**: blocos com `end < agora` nunca aparecem em `update`/`delete`; entram só como histórico (`done`/`skipped`).
3. **Edição do Arthur vence**: bloco com observação mantém a versão do Arthur, a menos que colida com evento real. Quando notar padrão, propõe `manual_suggestion`.
4. **Pergunta não bloqueia**: planeja com a melhor hipótese e escreve no `reason` "assumindo X — pergunta aberta".
5. **Só escreve no Cérebro**: nunca propõe alterar `facts` de fontes externas.
6. **Manual é sugestão, não edição**: nunca reescreve o manual; só propõe linhas.
7. **Conflitos explícitos**: quando a soma de horas necessárias (segundo o manual) não cabe, emite `conflict` em vez de espremer silenciosamente.

### 4.5 Aplicar

1. `inbox` → cria `facts(source=inbox)` / `questions`; marca item `processed` com `processed_into`. `ignore` → `status='ignored'`.
2. `blocks.create` → `events.insert` no Cérebro com `extendedProperties.private.block_id`; salva `plan_blocks` com `gcal_event_id`.
   `blocks.update` → `events.patch`; `blocks.delete` → `events.delete` + apaga linha.
   Ordem: deletes → updates → creates, cada uma tolerante a 404 (evento já apagado pelo Arthur → só apaga a linha).
3. `questions` → `status='open'`. `manual_suggestions` → `status='pending'`. `conflicts` → guardados no `plan_runs.summary` e exibidos na Semana.
4. `plan_runs` → tokens, resumo, status.

Se Claude falhar (rate limit esgotado após retries do SDK, 5xx, schema inválido), `plan_runs.status='error'` com a mensagem; nada é aplicado.

### 4.6 Gatilhos

- Cron 06:00 (`vercel.json` crons → `POST /api/plan` com header `Authorization: Bearer $CRON_SECRET`).
- Botão **Replanejar** no site (sessão do Arthur), trava de 1 run a cada 5 min (checa `plan_runs.started_at`).
- Ao responder pergunta ou aceitar sugestão, a UI oferece "replanejar agora?".
- Runs são serializados: se há um `plan_runs` sem `finished_at` há menos de 3 min, retorna 409.

## 5. Interface

Mobile-first. Paleta: preto, branco e 3 cinzas. Cor **só** em blocos/eventos:

| Tipo | Cor |
|---|---|
| Evento real (gcal/outlook/moodle) | cinza escuro |
| `study` | azul |
| `task` | laranja |
| `travel` | roxo |
| `buffer` | cinza claro tracejado |

### Telas

**Semana** (home)
- Grade seg–dom, semana atual, seta para próxima/anterior. Eventos reais + blocos do cérebro.
- Clique no bloco → `reason`, botões *feito* / *não feito*.
- Barra de conflitos no topo quando o último run trouxe `conflicts`.
- Botão Replanejar + "último run: <hora> · <summary>". Se o último run deu erro, mostra o erro aqui.

**Inbox**
- Textarea + enviar. Lista dos itens com `status` e o que viraram. Sem formulário estruturado.

**Pendências**
- Perguntas abertas com contexto e campo de resposta livre; *responder* / *dispensar*.
- Sugestões de manual pendentes: *aceitar* / *editar e aceitar* / *rejeitar*.
- Badge com contagem no menu.

**Manual**
- Editor markdown do manual (textarea simples + salvar; sem editor rico).
- Lista de `knowledge` (título, fonte, atualizado em), só leitura, com botão *Sincronizar memória*.
- Histórico de `plan_runs` (data, gatilho, tokens, resumo/erro), últimos 30.

Autenticação: Auth.js com provider Google; middleware bloqueia qualquer e-mail fora de `ALLOWED_EMAIL`.

## 6. Integrações

### Google Calendar
- OAuth 2.0 via Auth.js, escopos `calendar.readonly` + `calendar.events`, `access_type=offline` para refresh token. Refresh token cifrado (AES-GCM com `TOKEN_ENCRYPTION_KEY`) em `oauth_tokens`.
- Na primeira coleta, procura calendário chamado "Cérebro"; cria se não existir; guarda id em env/config.
- Escrita usa `extendedProperties.private.block_id` para ligar evento ↔ bloco.

### Moodle PUCRS
- Token de web service existente (env `MOODLE_TOKEN`, `MOODLE_URL`). Funções: `core_calendar_get_calendar_upcoming_view`, `mod_assign_get_assignments`.
- Cache 6h em `sources_cache`.

### Outlook (trabalho, conta corporativa)
- Link .ics publicado pelo Outlook (env `OUTLOOK_ICS_URL`). Parse com `ical.js`. Feed atualiza a cada 1–3h do lado da Microsoft; cache 6h do nosso lado.
- Se a TI bloquear publicação: plano B é encaminhar convites pro Gmail (viram eventos no GCal) e deixar `OUTLOOK_ICS_URL` vazio — a fonte fica desligada e o run não falha por isso.

### Claude API
- `@anthropic-ai/sdk`, chave em `ANTHROPIC_API_KEY`. Retries do SDK (padrão 2). Timeout 120s.
- Custo estimado com Opus 5: ~US$ 0,18/run → ~US$ 5–6/mês com 1 run/dia. Sonnet 5 ≈ US$ 2,5/mês.

### Importador de memória
- Script `scripts/sync-knowledge.ts` rodado localmente: lê `~/.claude/projects/C--Users-arthu/memory/*.md` (exceto `MEMORY.md`), extrai `name`/`description` do frontmatter, faz upsert em `knowledge` por `slug`. Remove do banco docs `source='claude-memory'` cujo arquivo sumiu.
- O botão *Sincronizar memória* no site só funciona quando o app roda local (tem acesso ao disco); em produção mostra "rode `npm run sync-knowledge`".

## 7. Segurança

- Todas as rotas `/api/*` exigem sessão do Arthur, exceto `/api/plan` chamada pelo cron com `CRON_SECRET`.
- Segredos só em env vars da Vercel: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `MOODLE_TOKEN`, `MOODLE_URL`, `OUTLOOK_ICS_URL`, `DATABASE_URL`, `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ALLOWED_EMAIL`, `PLANNER_MODEL`.
- Nada de chave no cliente. Sem CORS aberto.

## 8. Testes

- **Unit** (Vitest): parsers Moodle/GCal/ICS → `facts`; diff `plan_blocks` ↔ eventos do Cérebro → observações; validação do `PlanOutput`; etapa APLICAR contra um banco de teste (Neon branch ou Postgres local).
- **Fixtures**: pares (prompt real, resposta real) gravados uma vez com a API e salvos em `tests/fixtures/`; a etapa APLICAR é testada com eles sem gastar tokens.
- **Integração live** (`npm run test:live`, manual): um run completo contra um calendário "Cérebro-test" separado e a API real.
- Sem mock do Google: calendário de teste dedicado.

## 9. Futuro (fora da v1, registrado para não perder)

| # | Ideia | Implicação já absorvida na v1 |
|---|---|---|
| F1 | **Plano de estudo detalhado**: "estudar pra prova X" gera, além dos blocos, um roteiro por bloco (unidade, resumo, bateria) no estilo já usado com o Claude | `plan_blocks.prep jsonb` reservado |
| F2 | **Executor remoto**: botão no site → Wake-on-LAN no PC → API local recebe o `prep` e dispara o Claude Code, deixando material pronto antes do Arthur chegar. Serve também para trabalhos | `prep` é o payload; nada mais |
| F3 | **Microsoft Graph**: e-mails e To Do do trabalho. Depende de aprovação do admin do tenant corporativo | `facts.source` é enum extensível |
| F4 | **Busca vetorial**: quando `knowledge` passar de ~40–50k tokens, ligar pgvector no Neon, preencher `embedding`, trocar "todos os docs" por top-k | coluna `embedding` já existe |
| F5 | **Chat com contexto** sobre a vida inteira | usa manual + knowledge + F4 |
| F6 | Notas escritas no site alimentando `knowledge` | `source='note'` já no enum |

## 10. Riscos conhecidos

- **Planejador burro no início.** Esperado: fica bom depois de 2–3 semanas de respostas e ajustes no manual.
- **Publicação .ics bloqueada pela TI.** Plano B em §6.
- **Cache de prompt não pega no cron diário.** Aceito; custo já estimado sem cache.
- **Arthur edita o manual em paralelo com uma sugestão sendo aceita.** Última escrita vence; o manual é pequeno e só o Arthur edita.
