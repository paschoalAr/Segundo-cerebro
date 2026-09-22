# Plano 3 — Motor — ESTADO

**Atualizado:** 2026-09-22
**Branch:** `plano-3-motor` (worktree `.worktrees/plano-3-motor`), HEAD `a88444d`.
**Testes:** `npm test` → 60/60 passando · `npm run typecheck` limpo · `npm run build` completo passa.

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

### Task 11 — o que falta (ação manual do Arthur)

Os passos abaixo do Critério de Pronto exigem rodar contra o mundo real (Google Calendar de verdade, o `claude.exe` instalado localmente consumindo a assinatura, e o Agendador de Tarefas do Windows) — não foram executados durante a implementação automatizada por serem efeitos colaterais reais fora do escopo seguro de um subagent:

- [ ] Rodar `npx tsx scripts/run-plan-local.ts` manualmente (fora do worktree, no checkout real `C:\Users\arthu\segundo-cerebro`, com `CLAUDE_CODE_OAUTH_TOKEN` no `.env`) e confirmar que cria um run `status='ok'` em `plan_runs`, e blocos aparecem no calendário "Cérebro" de verdade.
- [ ] Testar a trava de concorrência (dois runs em paralelo).
- [ ] Testar a tela Pendências respondendo uma pergunta / aceitando uma sugestão reais.
- [ ] Configurar a tarefa no Agendador de Tarefas do Windows (gatilho "ao fazer logon" → `scripts/run-plan-local.cmd`).

**Próximo:** ideias fora da v1 registradas no spec `docs/superpowers/specs/2026-09-15-segundo-cerebro-design.md` §9 (plano de estudo detalhado, executor remoto, Microsoft Graph, busca vetorial, chat, notas).
