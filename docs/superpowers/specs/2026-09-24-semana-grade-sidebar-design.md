# Semana em grade + sidebars — design (Etapa 5)

**Data:** 2026-09-24
**Contexto:** a Etapa 3 (semana em grade) implementou a grade de calendário mas nunca teve
conferência visual ao vivo (registrado em `docs/superpowers/plans/2026-09-23-etapa-3-ESTADO.md`
como pendência — "Arthur disse que verifica depois manualmente"). Ao abrir `/semana` de verdade
pela primeira vez em 2026-09-24, o resultado não bate com a referência que o Arthur desenhou no
Figma: layout errado (painel de tarefas e log acima da grade, sem agrupamento), e a navegação por
roda giratória não é o que ele quer mais.

Este documento cobre a **Etapa 5**: arrumar o layout de `/semana` pra bater com o Figma, e trocar
a navegação de setores (roda giratória) por uma barra lateral colapsável.

## Fora de escopo (etapas futuras, já combinadas)

- **Etapa 6** — telas Dia e Mês de verdade (o toggle já existe nesta etapa, mas só "Semana" fica
  funcional; Dia/Mês ficam desabilitados).
- **Etapa 8** — arrastar uma tarefa da sidebar até um horário da grade (hoje isso já existe como
  formulário "virar bloco" clicando; o drag-and-drop é uma segunda forma de fazer o mesmo).
- Botões "Play"/"download" que aparecem no topo da captura do Figma **não entram no escopo** —
  são a barra de apresentação do próprio Figma (nome do frame + presenter), não elementos do
  design.

## Parte 1 — Barra lateral de setores (substitui a roda giratória)

Remove por completo `app/(app)/wheel.tsx`, `src/nav/wheel.ts` (+ `wheel.test.ts`) e as classes
`.wheel-*` do `app/globals.css`. Não sobra nenhum uso da interação de girar com scroll.

Novo componente `app/(app)/sidebar.tsx` (client component, mesmo papel que `Wheel` tinha em
`AppLayout`):

- Renderiza os mesmos `NAV_ITEMS` (`src/nav/items.ts`), agrupados em duas seções por
  `item.group`: **SETORES** e **FERRAMENTAS**. Nenhuma mudança em `items.ts`.
- **Estado expandido/colapsado**: `useState<boolean>` inicializado por `pathname === '/'`
  (mesma regra que `isHub` usava). Ou seja, abre expandida na home, entra colapsada em
  qualquer outra rota — replica o comportamento atual (disco vs. link "< SETORES"), só troca
  a aparência.
- **Expandida**: coluna fixa à esquerda, ~220px, lista vertical dos itens (link + rótulo),
  item da rota atual com `aria-current="page"` e destaque visual. Botão de colapsar no topo
  da coluna.
- **Colapsada**: faixa fina fixa à esquerda, ~44px, só com um botão (ícone/seta) que alterna
  `expanded` pra `true`. Nenhuma navegação embutida na faixa fina.
- Clicar num link da lista expandida navega (comportamento padrão do `Link`) — não precisa
  colapsar manualmente no clique, porque a etapa seguinte já renderiza `Sidebar` colapsada
  (o `useState` reinicializa com o novo `pathname` porque o componente inteiro remonta a cada
  navegação de Server Component — ver nota de implementação abaixo).
- Layout: `main.container` ganha `margin-left` igual à largura da faixa colapsada (44px) por
  padrão; quando expandida, a barra fica em `position: fixed` sobrepondo o conteúdo (overlay),
  sem empurrar o layout — evita reflow e simplifica o CSS.

**Nota de implementação:** hoje o `Wheel` é `'use client'` com `useState` que só reresseta
via `usePathname()` mudando — como é um client component montado uma vez em `AppLayout`
(compartilhado entre navegações client-side do Next), o estado *não* remonta sozinho ao
navegar. É preciso um `useEffect` que reresseta `expanded` para `pathname === '/'` toda vez
que `pathname` mudar (mesma pegadinha que o `Wheel` atual já tinha resolvido com
`indexOfPath`/`isHub` recalculado a cada render — só que lá não havia estado derivado de
navegação anterior pra resetar).

## Parte 2 — Layout de `/semana`

Estrutura final (desktop ≥900px), de cima pra baixo:

1. `<h1>Semana</h1>` + navegação de semana (`← anterior · 21/09–27/09 · próxima →`, já existe)
   e o toggle **Hoje | Semana | Dia | Mês**: "Hoje" é link pra `?w=0`; "Semana" é o item ativo
   (aceso, aponta pra si mesma); "Dia" e "Mês" renderizam como `<button disabled>` com
   `title="em breve"` — sem rota nova, sem lógica nova.
2. Duas colunas lado a lado (`display: flex` ou `grid`, `.wk-layout`):
   - **Grade** (`WeekGrid`, ~75% da largura) — sem mudança de lógica, só de contêiner.
   - **Sidebar de Tarefas** (`TasksPanel`, ~25%) — ver Parte 3 pro agrupamento.
3. Rodapé de legenda estático abaixo das duas colunas: quatro itens — "bloco do motor"
   (cor `--bat`), "fato real (Moodle, Calendar)" (cor padrão), "prova / entrega" (cor
   `--alert`), "feito" (opacidade reduzida, riscado) — reaproveita as variáveis de cor que já
   existem em `.wk-ev[data-kind]/[data-alert]/[data-status]`, é só uma legenda visual, sem
   novo estado.
4. `<details>` recolhido por padrão, "Diagnóstico do motor" — dentro dele vai o que hoje está
   solto no topo da página: aviso de coleta (`status.error`/`status.warning`), linha "Último
   planejamento: ...", e os cards de conflito (`conflicts.map`). Nada de lógica muda, só a
   posição (sai do topo, vira `<details><summary>Diagnóstico do motor</summary>...</details>`
   depois da legenda).

Mobile (<900px): mantém a lista "Detalhes do dia" como fallback, mas hoje ela tem um bug —
a regra de CSS que esconde/mostra grade vs. lista está com a mesma direção nas duas
(`@media (max-width: 899px) { .wk { display:none } }` e a mesma faixa pra `.wk-list-title`),
então a lista sempre renderiza, redundante com a grade em telas largas. Fix: envolver o bloco
inteiro "Detalhes do dia" (heading + `days.map(...)`) num `<div className="wk-mobile-list">` e
trocar a regra pra `@media (min-width: 900px) { .wk-mobile-list { display: none; } }` — grade
exclusiva no desktop, lista exclusiva no mobile.

## Parte 3 — Agrupamento de tarefas (`TasksPanel`)

Hoje `TasksPanel` (`app/(app)/_tasks/panel.tsx`) renderiza `sortTasks(tasks, now)` como lista
única. Novo agrupamento em três seções, usando `taskUrgency` (`src/tasks/task.ts`) que já
existe e não muda:

- **Atrasadas** — `taskUrgency === 'overdue'`
- **Esta semana** — `taskUrgency` em `'today' | 'soon' | 'later'` (qualquer tarefa com prazo
  que não está atrasada). Decisão consciente: uma tarefa com prazo daqui a 2 semanas também
  cai aqui em vez de virar uma 4ª categoria — o Figma só tem três grupos.
- **Sem prazo** — `taskUrgency === 'none'` (sem `due`).

Cada seção só renderiza se tiver pelo menos uma tarefa (seção vazia some, não mostra
"nenhuma"). Dentro de cada seção, mantém a ordenação que `sortTasks` já faz. O formulário de
criar tarefa e o card de cada tarefa (`completeTaskAction`, `dropTaskAction`,
`taskToBlockAction`, `details` de virar bloco) não mudam — é refatorar o `.map` em três
`.map`s filtrados, não reescrever o card.

Nova função pura testável em `src/tasks/task.ts`: `groupTasksByUrgencyBucket(tasks, now)` →
`{ atrasadas: T[], estaSemana: T[], semPrazo: T[] }`, coberta por testes unitários (tarefa
overdue/today/soon/later/none cai no grupo certo; ordenação dentro do grupo preservada).

## Testes e verificação

- `npm test` — testes novos para `groupTasksByUrgencyBucket`; testes existentes de
  `sortTasks`/`taskUrgency` inalterados; remover `src/nav/wheel.test.ts` junto com o código
  que ele testa.
- `npm run typecheck` / `npm run build` — como sempre.
- **Conferência visual ao vivo é obrigatória desta vez** (foi isso que faltou na Etapa 3): abrir
  `/semana` logado, em viewport ≥900px, e comparar com o Figma — 3 colunas visíveis
  (sidebar colapsada | grade | tarefas agrupadas), legenda no rodapé, diagnóstico recolhido,
  toggle Hoje/Semana/Dia/Mês com Dia/Mês desabilitados. Depois redimensionar <900px e conferir
  que vira lista (sidebar de setores continua faixa fina, grade some, "Detalhes do dia"
  aparece).

## Fora de escopo — lembrete

Dia/Mês de verdade, drag-and-drop, e qualquer botão de "Play"/exportar ficam para depois (ver
seção "Fora de escopo" acima). Este documento cobre só a Etapa 5.
