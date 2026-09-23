# Etapa 2 — Setores no modelo — ESTADO

**Data:** 2026-09-23
**Branch:** `worktree-etapa-2-setores` (worktree em `.claude/worktrees/etapa-2-setores`)
**HEAD:** `1afabd6` — feat(motor): setor de cada fato e bloco entra no prompt

## Verificação

- `npm test`: 23 arquivos, 126 testes, todos verdes.
- `npm run typecheck`: limpo.
- `npm run build`: limpo (Next 16 / Turbopack, rotas estáticas e dinâmicas geradas sem erro).
- `npm run check:lock-race`: OK — 1 dos 3 processos concorrentes criou o run, 2 foram barrados. A trava não foi tocada nesta etapa e continua íntegra.

## Distribuição de setores no banco (após backfill)

```
facts:  { 'sem setor': 10, estudos: 5 }
blocks: { 'sem setor': 2, estudos: 23 }
```

O que ficou em "sem setor" (inspecionado linha a linha):

- **`gcal` (4 fatos):** nenhum calendário do Google está em `SECTOR_CALENDAR_MAP` (variável vazia no `.env` real) — comportamento esperado, não um bug.
- **`inbox` (6 fatos):** por design, item de inbox nunca tem setor — texto solto não diz de qual área da vida é.
- **Nenhum fato do Moodle ficou sem setor** — os 5 fatos com `estudos` são todos do Moodle, confirmando que a derivação rodou certo no backfill.
- **2 blocos sem setor:** blocos `travel` sem fato ligado (a categoria `travel` mapeia para `null` de propósito).

## Rodada real do motor

`npx tsx scripts/run-plan-local.ts` → run #27, `status: 'ok'`, sem erro. A run só reajustou blocos existentes (nenhum bloco novo foi criado nesta rodada — a semana já estava coberta), então não há bloco novo para inspecionar setor, mas o motor consumiu o prompt com as etiquetas de setor (`{estudos}`, `{sem setor}`, etc.) sem quebrar, e a `applyPlanOutput` que agora deriva `sector` em toda criação de bloco não foi exercitada por criação nova nesta rodada especificamente — está coberta pelos testes automatizados de `src/plan/apply.ts` e pela criação manual/backfill anterior (23 blocos já têm `estudos`).

## Observações fora do escopo desta etapa (não ignoradas, só não resolvidas aqui)

O próprio run #27 apontou, no campo `conflicts`, que não há bloco de saúde na agenda — o que bate exatamente com a limitação documentada no plano: "`financas`, `saude` e `projetos` continuam vazios até existir fonte que caia neles."
