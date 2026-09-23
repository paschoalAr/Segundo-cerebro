# Plano 3 — Motor — ESTADO

**Atualizado:** 2026-09-23
**Branch:** `master`, HEAD `3a1a284`.
**Testes:** `npm test` → 70/70 passando · `npm run typecheck` limpo · `npm run build` completo passa · `npm run check:lock-race` verde.

## Tasks

| # | Task | Estado |
|---|---|---|
| 1 | plan_runs.conflicts + repo de runs | ✅ |
| 2 | Repos de apoio | ✅ |
| 3 | Escrita no Google Calendar | ✅ |
| 4 | Observações | ✅ |
| 5 | PlanOutputSchema | ✅ |
| 6 | Prompt | ✅ |
| 7 | Aplicar PlanOutput | ✅ |
| 8 | Motor local via Claude Code | ✅ |
| 9 | Semana com blocos | ✅ |
| 10 | Pendências + badge | ✅ |
| 11 | Verificação e2e | ⚠️ parcial — ver abaixo |

## Notas

- Implementado via `superpowers:subagent-driven-development` — um subagent implementador + um subagent revisor (spec-compliance + code quality combinados) por task, dentro de um worktree isolado (`.worktrees/plano-3-motor`, branch `plano-3-motor`).
- Tasks 1–10: todas aprovadas na revisão sem retrabalho — nenhum desvio de spec encontrado além de pequenas adaptações de tipo (ex.: `cache_control?: undefined` no segundo bloco de `buildUserContent`, pra satisfazer o TypeScript sem mudar comportamento).
- `npm run typecheck`, `npm test` (60 testes) e `npm run build` passam limpos no HEAD atual.

### Bugs achados e corrigidos ao rodar contra o mundo real (2026-09-23)

A primeira execução real de `scripts/run-plan-local.ts` (fora de qualquer subagent, contra o `claude.exe` de verdade) revelou dois bugs que só aparecem com dados reais — corrigidos em `3a1a284`:

1. **`spawn ENAMETOOLONG`** — `execFile` monta a linha de comando inteira (system prompt + `--json-schema` + user prompt) e o Windows limita isso a ~32k caracteres via `CreateProcess`. Com manual+knowledge+facts reais, o `userPrompt` sozinho já tinha ~70k chars. Fix: `userPrompt` passa a ir por **stdin** (`claude -p` lê stdin quando o prompt posicional é omitido — confirmado contra o binário `2.1.280`); `systemPrompt`/`jsonSchema` continuam em argv por serem pequenos.
2. **`--json-schema` rejeitado com "no schema with key or ref .../draft/2020-12/schema"** — `z.toJSONSchema()` sempre inclui `$schema`, e o validador do `claude.exe` tenta resolver isso como `$ref` e falha offline. Fix: remove `$schema` do objeto antes de `JSON.stringify` pro argv.

Depois do fix: run real concluiu com `status='ok'`, 18 blocos criados no calendário "Cérebro" de verdade (Google Calendar, `gcalEventId` confirmado), conflitos e 6 perguntas identificados corretamente.

### Task 11 — o que ainda falta

- [x] Rodar `npx tsx scripts/run-plan-local.ts` manualmente e confirmar run `status='ok'` + blocos no calendário "Cérebro" real — feito 2026-09-23 (run #3, 18 blocos).
- [x] Testar a trava de concorrência (dois runs em paralelo) — feito 2026-09-23. **O teste reprovou**: `findRunningRun()` + `createRun()` no engine era check-then-act e dois processos simultâneos criaram os runs #6 e #7. Corrigido pelo plano `2026-09-23-trava-concorrencia-motor.md` — a exclusão mútua virou o índice único parcial `plan_runs_one_running_idx` (uma única linha com `finished_at IS NULL`), com reaper de 15 min pra crash. Regressão coberta por `npm run check:lock-race`.
- [ ] Testar a tela Pendências respondendo uma pergunta / aceitando uma sugestão reais (o run #3 já deixou perguntas e sugestões prontas pra isso).
- [ ] Configurar a tarefa no Agendador de Tarefas do Windows (gatilho "ao fazer logon" → `scripts/run-plan-local.cmd`).

**Próximo:** ideias fora da v1 registradas no spec `docs/superpowers/specs/2026-09-15-segundo-cerebro-design.md` §9 (plano de estudo detalhado, executor remoto, Microsoft Graph, busca vetorial, chat, notas).
