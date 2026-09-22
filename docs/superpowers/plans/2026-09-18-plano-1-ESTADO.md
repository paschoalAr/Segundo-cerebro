# Plano 1 — Fundação — ESTADO

**Atualizado:** 2026-09-22
**Branch:** `plano-1-fundacao` (HEAD `9801384`), pushada em `origin` (https://github.com/paschoalAr/Segundo-cerebro), ainda não mergeada em `main`.
**Método:** superpowers:subagent-driven-development (implementador → revisão de spec → revisão de qualidade por task).
**Testes:** `npm test` → 18/18 passando · `npm run typecheck` limpo · `npm run build` completo passa (com `.env` real).
**Neon:** projeto `holy-lab-38634353` criado por fora (dashboard), connection string no `.env` local. Migração aplicada, `knowledge` populada (22 docs).
**Deploy:** Vercel projeto `segundo-cerebro` (`arthurpaschoal500gmailcoms-projects`), produção em `https://segundo-cerebro-nu-flax.vercel.app`. `.vercelignore` criado (22/09) pra excluir `.env` do bundle de deploy — 1º deploy tinha empacotado o `.env` local por engano, corrigido e redeployado.

## Tasks

| # | Task | Estado | Commit | Observações |
|---|---|---|---|---|
| 1 | Scaffold | ✅ | `4182408` | 2 revisões limpas |
| 2 | Schema do banco | ✅ | `b03e860`, `6487929` | Revisão adicionou índice único parcial em `plan_blocks.gcal_event_id`. Migração aplicada no Neon real em 20/09 (`npm run db:migrate` ok, 10 tabelas + 10 enums) |
| 3 | Cifra AES-GCM | ✅ | `b801a1c`, `6ab6f16` | Revisão adicionou `authTagLength: 16` + teste de tag truncada (5 testes) |
| 4 | Allowlist de e-mail | ✅ | `a8d227a` | 3 testes |
| 6 | Domínio do Manual | ✅ | `6d23d7c`, `2522b7a` | Revisão: achatar `\n` na linha, CRLF→LF em `saveManual`, `onConflictDoNothing` no seed (6 testes) |
| 7 | Importador knowledge | ✅ | `e8e931d` | Revisão de spec + qualidade feitas em 20/09 (aprovado, sem issues). `npm run sync-knowledge` rodado contra o banco real em 20/09: 22 docs importados, idempotente (rodado 2x, mesmo resultado). Achou e corrigiu 1 bug real: frontmatter YAML sem aspas em `emissor_nf_kay_estado.md` (description com `:` no meio do texto) quebrava o parser — corrigido na memória |
| 5 | Login Google (Auth.js) | ✅ código e revisão · ⏳ teste manual OAuth | `7643264` | Revisão de spec + qualidade feitas em 20/09 (aprovado). Reviewer sugeriu (não bloqueante): try/catch + log em volta de `saveGoogleRefreshToken` no callback `signIn`, e logar quando `account.refresh_token` vier ausente. Testado no navegador em 20/09: `/`, `/inbox`, `/manual` redirecionam certo pra `/login?next=...` sem sessão; `/login?error=AccessDenied` mostra a mensagem certa. **Falta só:** testar o fluxo OAuth completo (precisa de `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` no `.env`) |
| 8 | Layout + nav 4 telas | ✅ | `49287db` | Revisão de spec + qualidade feitas em 20/09 (aprovado) |
| 9 | Tela Inbox | ✅ | `b0b8479` | Revisão de spec + qualidade feitas em 20/09 (aprovado) |
| 10 | Tela Manual | ✅ | `479403a` | Revisão de spec + qualidade feitas em 20/09 (aprovado). Reviewer notou (não bloqueante, sem impacto hoje pois `planRuns` está vazia): cor do erro em `page.tsx` usa `var(--fg)` em vez de uma cor de erro de verdade; sem estado "salvando..." no botão Salvar |
| 11 | Deploy Vercel | ✅ | `9801384` | OAuth client criado no Google Cloud (22/09), login testado local e em produção. Deploy em `https://segundo-cerebro-nu-flax.vercel.app`, repo `paschoalAr/Segundo-cerebro` no GitHub |

**Plano 1 completo: código escrito, testado, migrado, deployado em produção e no GitHub.** Falta só a revisão final do branch e o merge em `main`.

## Bloqueios (passos manuais do Arthur)

Todos resolvidos. ~~Neon~~ ✅ 20/09. ~~Google Cloud OAuth client~~ ✅ 22/09 (projeto `segundo-cerebro` no Google Cloud, tela de consentimento Externa, Arthur como usuário de teste, credencial Web com redirects `localhost:3001` e produção Vercel). ~~`.env`~~ ✅ completo.

## Próximos passos, em ordem

1. Revisão final do branch → superpowers:finishing-a-development-branch → merge em `main`.
2. Depois de tudo pronto: Plano 2 — Fontes (client Google Calendar com refresh, calendário "Cérebro", coletores Moodle/GCal/Outlook → `facts`, tela Semana com eventos reais).

## Notas

- Coautoria nos commits: os subagentes usaram `Claude Sonnet 5` em vez de `Claude Opus 5` em alguns commits; irrelevante, não corrigir.
- Spec §3 vs schema (diferenças intencionais do plano, atualizar spec no fim): `run_status` tem `'running'`; `oauth_tokens.refresh_token_enc` + `updated_at`; `manual_suggestions.created_at`; `knowledge.embedding` fora da v1.
- Nome do projeto continua em aberto.
- Melhorias não-bloqueantes sugeridas pelos revisores, para revisitar quando o motor (Plano 3) existir: log/try-catch em volta da captura do refresh token (Task 5); cor de erro real e estado "salvando..." na tela Manual (Task 10).
