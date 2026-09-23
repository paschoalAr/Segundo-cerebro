# Tema preto/amarelo e roda de navegação — etapa 1

Data: 2026-09-23
Maquetes: https://claude.ai/artifact/KogScAHwdpKNWeDjEMs4At

## 1. Objetivo

O app hoje é funcional e feio: CSS branco/cinza, navegação em abas horizontais, e a
tela inicial é a Semana. A ideia é virar isso em algo com identidade — preto e amarelo,
tipo Batman — e trocar o menu de abas por uma **roda no canto superior esquerdo** que
gira com o scroll.

Esta etapa entrega **só o visual e a navegação**. Nenhuma migração de banco.

## 2. Escopo

Dentro:

- Tokens de cor e tipografia novos, aplicados em todas as telas existentes.
- Componente `Wheel` substituindo `app/(app)/nav.tsx`.
- Reorganização de rotas: `/` deixa de ser a Semana e vira o hub de setores.
- Casca da tela de setor (`/setor/[slug]`), sem dados.

Fora (etapas 2–4):

- Coluna `sector` em `facts` / `plan_blocks` — etapa 2.
- Semana em grade de calendário — etapa 3.
- Tabela `tasks` e sugestões de tarefa do motor — etapa 4.

### Trade-off aceito

Nesta etapa os 6 cards de setor no hub e a tela `/setor/[slug]` não têm de onde puxar
dado — a coluna `sector` só existe na etapa 2. Eles renderizam **estado vazio honesto**
("este setor ainda não tem fonte conectada"), nunca número inventado. O hub fica
propositalmente magro até a etapa 2 preenchê-lo.

## 3. Tokens

Em `app/globals.css`, substituindo o bloco `:root` atual.

| Token | Valor | Uso |
| --- | --- | --- |
| `--ink` | `#0A0A0B` | fundo da página |
| `--surface` | `#131416` | cards |
| `--raised` | `#1B1D20` | card sobre card, evento "fato" |
| `--line` | `#2B2E33` | bordas |
| `--line-soft` | `#1A1C1F` | linhas internas da grade |
| `--bat` | `#FFC400` | acento |
| `--bat-hover` | `#FFD84D` | hover de link/acento |
| `--bat-tint` | `rgba(255,196,0,.12)` | fundo de destaque |
| `--alert` | `#FF6B4A` | prova, atrasado, hora atual |
| `--txt` | `#ECECE8` | texto principal — 16:1 sobre ink |
| `--txt-dim` | `#9A9CA1` | texto secundário — 6,4:1 |
| `--txt-faint` | `#6E7075` | legenda, só a partir de 14px |

**Regra de ouro: amarelo é acento, nunca corpo de texto.** Ele entra em estado ativo,
número que importa, anel de foco e na roda. Parágrafo e título ficam em `--txt`.

As cores de categoria do Google Calendar (`--block-work`, `--block-class`, …) saem do
CSS. Elas foram desenhadas para fundo branco, brigam com o tema, e `--block-personal`
é literalmente a mesma cor do acento. `src/plan/categories.ts` continua intocado — os
`colorId` do Calendar são assunto do Calendar, não da interface.

### Tipografia

Carregada com `next/font/google` em `app/layout.tsx`, exposta como CSS variable
(sem `<link>` externo, para não depender da rede em produção):

- **Space Grotesk** 500/700 — títulos, nomes de setor, números grandes.
- **IBM Plex Sans** 400/500/600 — corpo.
- **IBM Plex Mono** 400/500 — horas, datas, valores.

## 4. A roda

### Itens

Dez, nesta ordem:

1. Estudos · 2. Carreira · 3. Finanças · 4. Saúde · 5. Projetos · 6. Pessoal
7. Semana · 8. Inbox · 9. Pendências · 10. Manual

Os seis primeiros são **setores** (peso 700, amarelo quando ativos). Os quatro últimos
são **ferramentas** (peso 500, texto claro com sublinhado amarelo quando ativas). Um
traço amarelo no arco marca a fronteira entre os dois grupos, e o miolo do disco mostra
em qual lado você está: `SETORES` ou `FERRAMENTAS`.

### Geometria

Região de captura: `440x420` ancorada no canto superior esquerdo. Centro da roda em
`(76, 76)` dentro dela.

- Disco amarelo: raio 96, portanto cortado pelas duas bordas da janela.
- Arco dos rótulos: raio 205, cinco posições em 8°, 26°, 45°, 64° e 82°.
- A posição de 45° é a ativa; as de 26°/64° são vizinhas; 8°/82° são distantes.
- Cada rótulo é rotacionado pelo próprio ângulo (`transform-origin: 0 50%`).
- Traços de corte: raio 196, 30px de comprimento, nos ângulos médios entre slots
  (17°, 35,5°, 54,5°, 73°). Cada um acende quando os dois slots que ele separa são de
  grupos diferentes.

### Comportamento

- **Scroll só dentro da região de captura.** `onWheel` com `preventDefault` no
  container de 440x420; o resto da página rola normalmente. `deltaY > 0` avança um
  item, `deltaY < 0` volta.
- **Rolar navega? Não.** Rolar só percorre. Clique ou Enter no rótulo é que navega.
  Disparar navegação a cada tique de scroll refaria o render do servidor a cada passo
  e deixaria o usuário chegando em telas por acidente.
- **Onde você está fica sempre visível.** O item que corresponde à rota atual carrega
  um ponto amarelo, mesmo enquanto você percorre outros. Sem isso, girar a roda perde
  a referência de posição.
- Nenhum "snap-back" por timer: se você girou e não clicou, a roda fica onde parou.

### Acessibilidade

Isto é inegociável: um menu que só responde a scroll é inutilizável no teclado.

- Cada rótulo é um `<a href>` real, alcançável por Tab, com `outline` amarelo de 2px
  no `:focus-visible`.
- O container tem `role="navigation"` e `aria-label="Setores e ferramentas"`.
- O rótulo da rota atual leva `aria-current="page"`.
- Texto rotacionado continua sendo texto: nada de imagem, nada de `aria-hidden`.
- `@media (prefers-reduced-motion: reduce)` desliga a transição de rotação.

### Estado recolhido

Nas telas internas a roda vira um quarto de disco de raio 52 no canto, com a legenda
`< SETORES`, e é um link para `/`. Não gira.

### Abaixo de 900px

Não existe evento de scroll do mouse. Abaixo de 900px a roda não renderiza: no lugar
dela vai uma barra horizontal rolável no topo com os mesmos 10 itens, mesmo separador
entre os grupos. Mesma lista, mesmos links, layout diferente.

## 5. Rotas

| Antes | Depois |
| --- | --- |
| `/` — Semana | `/` — hub de setores |
| — | `/semana` — Semana |
| — | `/setor/[slug]` — casca do setor |
| `/inbox` | `/inbox` |
| `/pendencias` | `/pendencias` |
| `/manual` | `/manual` |

`app/(app)/page.tsx` (a Semana atual) move para `app/(app)/semana/page.tsx` sem mudar a
lógica — só a pintura. O `page.tsx` novo na raiz é o hub. Slugs de setor:
`estudos`, `carreira`, `financas`, `saude`, `projetos`, `pessoal` (sem acento, sem
cedilha, para não ter URL escapada).

`/setor/[slug]` valida o slug contra a lista e responde `notFound()` para qualquer outro.

## 6. Arquivos

| Arquivo | O que acontece |
| --- | --- |
| `src/nav/items.ts` | **novo** — a lista dos 10 itens, slug, rótulo, grupo |
| `src/nav/wheel.ts` | **novo** — matemática pura da roda (ver §7) |
| `app/(app)/wheel.tsx` | **novo** — client component, substitui `nav.tsx` |
| `app/(app)/nav.tsx` | removido |
| `app/(app)/layout.tsx` | passa a montar `Wheel` |
| `app/(app)/page.tsx` | vira o hub |
| `app/(app)/semana/page.tsx` | recebe a Semana de hoje, repintada |
| `app/(app)/setor/[slug]/page.tsx` | **novo** — casca |
| `app/globals.css` | tokens novos + estilos da roda |
| `app/layout.tsx` | fontes via `next/font/google` |

`src/nav/wheel.ts` existe separado do componente de propósito: a matemática é testável
sem DOM, e o componente fica só com marcação e eventos.

## 7. Funções puras e testes

`src/nav/wheel.ts`:

- `wrapIndex(i, n)` — índice circular, aceita negativo.
- `slotsAround(i)` — devolve os cinco slots (offsets -2..+2) com item e ênfase.
- `cutFlags(i)` — quatro booleanos, um por vão entre slots, ligado quando os dois
  lados são de grupos diferentes.
- `indexOfPath(pathname)` — qual item corresponde à rota atual, ou `null`.

Testes em `src/nav/wheel.test.ts` (vitest, que já está no projeto):

- `wrapIndex` fecha o círculo nos dois sentidos, inclusive com offset negativo maior
  que `n`.
- `slotsAround(0)` traz Pessoal e Manual nas pontas — a volta completa funciona.
- `cutFlags` acende **nas duas** fronteiras: entre Pessoal e Semana, e entre Manual e
  Estudos. É o erro fácil de cometer: tratar só a primeira.
- `indexOfPath('/semana')` acha Semana; `/setor/estudos` acha Estudos; `/` devolve
  `null`; `/pendencias?x=1` continua achando Pendências.

Nada de teste de snapshot visual. O que importa aqui é a matemática do índice.

## 8. Riscos

- **A rotação dos rótulos custa legibilidade.** Foi escolha explícita do Arthur sobre
  a variante de rótulos retos. Se depois de uma semana de uso incomodar, a correção é
  trocar o `transform` de cinco elementos — não é uma decisão difícil de desfazer.
- **Mover `/` é a única mudança irreversível desta etapa.** Qualquer link salvo para a
  Semana quebra. Como o app tem um usuário e roda atrás de login, isso é aceitável.
- **O hub nasce magro.** Seis cards vazios até a etapa 2. Alternativa seria adiar o hub,
  mas aí a roda entregaria itens que não levam a lugar nenhum, o que é pior.

## 9. As próximas etapas, em uma linha cada

2. **Setores no modelo** — enum `sector`, coluna em `facts` e `plan_blocks`, regra de
   derivação a partir de `block_kind` e da fonte, hub e tela de setor com dado real.
3. **Semana em grade** — 7 colunas por horas, faixa "dia todo" para prova e entrega,
   linha da hora atual, evento posicionado por horário.
4. **Tarefas** — tabela `tasks` (sem hora, com setor, prazo opcional), tabela
   `task_suggestions` espelhando `manual_suggestions`, painel na Semana e no setor,
   "virar bloco", e as tarefas abertas entrando no prompt do motor.
