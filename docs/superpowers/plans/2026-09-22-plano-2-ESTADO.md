# Plano 2 — Fontes — ESTADO

**Atualizado:** 2026-09-22
**Branch:** `plano-2-fontes`, ainda não mergeada em `master`.
**Testes:** `npm test` → 42/42 passando · `npm run typecheck` limpo · `npm run build` completo passa.
**Deploy:** mesmo projeto Vercel do Plano 1, produção em `https://segundo-cerebro-nu-flax.vercel.app`. Env vars de Moodle (`MOODLE_URL`, `MOODLE_TOKEN`, `MOODLE_USER_ID`) configuradas em produção; `OUTLOOK_ICS_URL` não configurada (fonte opcional, desligada).

## Tasks

| # | Task | Estado | Observações |
|---|---|---|---|
| 1 | Utilitários puros (cache, sync, janelas) | ✅ | Achado: `TZ` é nome reservado na Vercel — corrigido via `instrumentation.ts` (não env var) |
| 2 | Repo de facts | ✅ | Documentado o contrato de `syncFactsForSource` (incoming precisa ser o conjunto completo) |
| 3 | Renovação do access token Google | ✅ | Endurecido: falha alto em env var ausente / resposta de token malformada |
| 4 | Cliente Calendar + coletor gcal | ✅ | Teste reforçado pra checar valor real de `date` em evento de dia inteiro |
| 5 | Coletor Moodle | ✅ | Endurecido: valida corpo de erro do Moodle (HTTP 200 mesmo em falha) antes de usar |
| 6 | Coletor Outlook | ✅ | Endurecido: valida .ics antes de cachear; RRULE (recorrência) documentado como limitação de v1 |
| 7 | Orquestrador + server action | ✅ | Documentado por que gcal+moodle falham juntos (Promise.all proposital) |
| 8 | Tela Semana | ✅ | Trava o offset de `?w=` pra não gerar Invalid Date |
| 9 | Verificação e2e | ✅ | Achado e corrigido um bug real (ver abaixo) |

## Achado importante na verificação (Task 9)

`mod_assign_get_assignments` do Moodle devolve entregas de **todas** as cadeiras já cursadas, sem filtro de data — testando contra o Moodle real da PUCRS, 85 facts de semestres passados (2025/1) foram parar em `facts`. Só o Google Calendar filtrava pela janela de coleta (via `timeMin`/`timeMax` da própria API); Moodle e Outlook não tinham filtro nenhum. Corrigido filtrando por `getCollectionWindow()` depois dos mappers puros (não neles, pra continuarem testáveis). Reaplicado contra o Moodle real: `{deletes: 81, upserts: 4}` — os 4 facts restantes são todos do semestre atual (2026/2).

## Verificação feita

- Login local e em produção testados pelo Arthur — sem erro.
- Botão "Atualizar fontes" testado local e em produção — sem erro.
- Calendário "Cérebro" criado automaticamente na conta Google do Arthur na primeira coleta (id guardado em `sources_cache`, chave `cerebro_calendar`).
- `facts` confirmada com dados reais: 1 evento do Google Calendar, 4 do Moodle (semestre atual, após o fix da janela).
- Outlook não testado (fonte opcional, `OUTLOOK_ICS_URL` não configurada — o Arthur não tem link .ics publicado ainda).
- Navegação de semana (`?w=`) coberta por testes unitários (`week.test.ts`); não testada manualmente no navegador nesta sessão.

## Notas

- Durante a implementação, 3 gaps de infraestrutura foram achados e corrigidos, fora do escopo original de cada task: `TZ` como nome reservado na Vercel (Task 1 → `instrumentation.ts`), vitest não carregava `.env` (Task 3 → `vitest.config.ts`), e o bug da janela de data do Moodle/Outlook (Task 9, acima).
- Melhorias não-bloqueantes registradas nas revisões de qualidade, pra revisitar se incomodarem na prática: expansão de RRULE no Outlook (recorrência), lock contra cliques duplos em "Atualizar fontes", paginação no `listEvents` do Google Calendar (limite de 250 por calendário).

**Próximo:** Plano 3 — Motor (prompt com Manual + knowledge + facts, Claude API monta blocos de estudo/tarefa/viagem, escreve no calendário Cérebro, gera perguntas e sugestões de manual, cron diário 06:00). Ainda não escrito.
