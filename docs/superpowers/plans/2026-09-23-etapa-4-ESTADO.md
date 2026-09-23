# Etapa 4 (Tarefas) — ESTADO

**Data:** 2026-09-23
**Branch:** `worktree-etapa-4-tarefas` (worktree em `.claude/worktrees/etapa-4-tarefas`, criado a partir da `master` local — que já tinha etapas 2 e 3 mescladas)
**HEAD:** `848bf9b` — "fix(tarefas): remove bloco orfao se a criacao do evento no calendario falhar"

## Execução

Plano executado com `superpowers:subagent-driven-development`: subagente implementador por task, seguido de revisão de spec e revisão de qualidade, ambas em subagentes frescos.

| Task | Commit | Status |
|---|---|---|
| 1. Regras puras de tarefa | `1f71cc8` | ✅ aprovado (spec + qualidade) |
| 2. As tabelas (migration aplicada em produção, com autorização do Arthur) | `d7aee0b` | ✅ aprovado |
| 3. Repositórios de tarefa | `aaa21aa` | ✅ aprovado |
| 4. Contrato de saída do motor | `ec03646` | ✅ aprovado |
| 5. Tarefas no prompt | `b3b9f95` | ✅ aprovado |
| 6. Aplicar sugestões de tarefa | `c1b7ead` | ✅ aprovado |
| 7. Sugestões de tarefa em Pendências | `1748d08` | ✅ aprovado |
| 8+9+10. Painel, telas, virar bloco | `8849dd8` | ⚠️ revisão de qualidade encontrou bug crítico (ver abaixo) |
| 10 (fix) | `848bf9b` | ✅ corrigido e reverificado |
| 11. Verificação de ponta a ponta | (este documento) | ⚠️ parcial — ver abaixo |

## Bug encontrado e corrigido durante a revisão

Na revisão de qualidade das Tasks 8+9+10, o revisor achou um problema real que o plano não previa:
`taskToBlockAction` gravava o `plan_block` no Postgres (`insertBlockDraft`) e só depois criava o evento no Google Calendar (`insertEvent`). Se a chamada ao Calendar falhasse (token expirado, erro de API), o bloco ficava órfão no banco — visível na grade da Semana, mas sem evento real por trás, e sem nenhum aviso pro Arthur.

Corrigido em `848bf9b`: as chamadas ao Calendar agora ficam num `try/catch`; se falharem, o bloco recém-criado é apagado (`deleteBlockRow`) e o erro é relançado, em vez de deixar o registro órfão em silêncio.

## Task 11 — o que foi feito e o que ficou pendente

**Step 1 (suíte completa):** ✅ feito. `npm test` (189/189), `npm run typecheck`, `npm run build` e `npm run check:lock-race` — todos verdes.

**Step 2 (rodar o motor de verdade) e Step 3 (caminho completo da sugestão em `/pendencias`):** ⚠️ **não executados** — o Arthur optou explicitamente por não autorizar, nesta sessão, rodar o motor de planejamento real contra o Postgres de produção (ele já havia autorizado a migration da Task 2, mas não o run completo do motor, que também pode criar eventos reais no Google Calendar). Ficam pendentes pra serem rodados manualmente quando ele quiser:

```bash
npx tsx scripts/run-plan-local.ts
```

Depois disso, conferir em `/pendencias` se alguma `task_suggestion` apareceu, aceitar uma (editando o título) e rejeitar outra, confirmando que a aceita vira tarefa em `/semana` marcada "do motor" e que aceitar duas vezes a mesma sugestão não duplica (guarda `status !== 'pending'` em `acceptTaskSuggestion`).

**Step 4 (vínculo bloco↔tarefa no banco):** `scripts/report-tasks.ts` foi criado e testado — roda limpo, mas mostra listas vazias (`tarefas: []`, `blocos ligados a tarefa: []`) porque nenhuma tarefa real foi criada ainda (Step 2/3 não rodaram). Vale rodar de novo depois de testar manualmente "virar bloco" numa tarefa.

## Quais das cinco decisões de design sobreviveram

Como o motor real não rodou nesta sessão, não há ainda evidência de uso real contra as cinco decisões do topo do plano. O que dá pra afirmar pela implementação (não pelo uso):

1. **"O motor propõe, não cria"** — mantida: `applyPlanOutput` só grava em `task_suggestions`, nunca em `tasks` diretamente (Task 6).
2. **Prazo opcional, não hora de compromisso** — mantida: `due` é `timestamp` nullable em `tasks`/`task_suggestions`, sem relação com o Google Calendar.
3. **`origin` distingue manual de motor** — mantida: `tasks.origin` (`manual`/`motor`), setado em `createTaskSuggestion`→`acceptTaskSuggestion` como `'motor'` e no formulário do painel como `'manual'`.
4. **"Virar bloco" pede hora e duração na mão** — mantida: `parseBlockRange` exige `datetime-local` + minutos do formulário, sem qualquer chamada à IA.
5. **Tarefa concluída não some** — mantida: `completeTask` seta `status='done'` e `doneAt`, nunca deleta a linha.

Nenhuma das cinco foi contestada durante a implementação — mas isso ainda precisa de confirmação com uso real (Step 2/3 pendentes).

## Próximos passos sugeridos

1. Rodar `npx tsx scripts/run-plan-local.ts` manualmente quando o Arthur quiser validar o motor de ponta a ponta.
2. Testar "virar bloco" manualmente numa tarefa real e conferir o evento no calendário "Cérebro".
3. Fazer merge deste branch/worktree na `master` quando a validação manual acima estiver satisfeita.
