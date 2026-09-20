# Plano 1 — Fundação — ESTADO

**Atualizado:** 2026-09-20 11:00
**Branch:** `plano-1-fundacao` (HEAD `479403a`), ainda não mergeada em `main`, sem remote.
**Método:** superpowers:subagent-driven-development (implementador → revisão de spec → revisão de qualidade por task).
**Testes:** `npm test` → 18/18 passando · `npm run typecheck` limpo.

## Tasks

| # | Task | Estado | Commit | Observações |
|---|---|---|---|---|
| 1 | Scaffold | ✅ | `4182408` | 2 revisões limpas |
| 2 | Schema do banco | ✅ código · ⏳ migração | `b03e860`, `6487929` | Revisão adicionou índice único parcial em `plan_blocks.gcal_event_id`. **Falta:** `npm run db:migrate` (precisa do Neon — ver "Bloqueios") |
| 3 | Cifra AES-GCM | ✅ | `b801a1c`, `6ab6f16` | Revisão adicionou `authTagLength: 16` + teste de tag truncada (5 testes) |
| 4 | Allowlist de e-mail | ✅ | `a8d227a` | 3 testes |
| 6 | Domínio do Manual | ✅ | `6d23d7c`, `2522b7a` | Revisão: achatar `\n` na linha, CRLF→LF em `saveManual`, `onConflictDoNothing` no seed (6 testes) |
| 7 | Importador knowledge | ✅ código e revisão · ⏳ execução | `e8e931d` | Revisão de spec + qualidade feitas em 20/09 (aprovado, sem issues). Falta rodar `npm run sync-knowledge` contra o banco real (bloqueado por Neon) |
| 5 | Login Google (Auth.js) | ✅ código e revisão · ⏳ teste manual | `7643264` | Revisão de spec + qualidade feitas em 20/09 (aprovado). Reviewer sugeriu (não bloqueante): try/catch + log em volta de `saveGoogleRefreshToken` no callback `signIn`, e logar quando `account.refresh_token` vier ausente. Falta teste manual do fluxo OAuth (precisa do `.env`) |
| 8 | Layout + nav 4 telas | ✅ | `49287db` | Revisão de spec + qualidade feitas em 20/09 (aprovado) |
| 9 | Tela Inbox | ✅ | `b0b8479` | Revisão de spec + qualidade feitas em 20/09 (aprovado) |
| 10 | Tela Manual | ✅ | `479403a` | Revisão de spec + qualidade feitas em 20/09 (aprovado). Reviewer notou (não bloqueante, sem impacto hoje pois `planRuns` está vazia): cor do erro em `page.tsx` usa `var(--fg)` em vez de uma cor de erro de verdade; sem estado "salvando..." no botão Salvar |
| 11 | Deploy Vercel | ⬜ | — | Bloqueado: precisa do Neon + `.env` local primeiro (Tasks 2/5/7 de "execução"/"teste manual"), depois projeto Vercel |

**Todo o código do Plano 1 está escrito.** As únicas pendências são passos manuais do Arthur (Neon, Google Cloud, `.env`) e o que depende deles (migração, sync-knowledge, teste manual de login, deploy).

## Bloqueios (passos manuais do Arthur)

1. **Neon:** criar projeto `segundo-cerebro` em https://console.neon.tech, copiar connection string *pooled*.
2. **Google Cloud:** projeto `segundo-cerebro` → ativar Google Calendar API → tela de consentimento (Externo, Arthur como usuário de teste) → credencial OAuth tipo Web com redirect `http://localhost:3000/api/auth/callback/google` → Client ID + Secret.
3. Criar `C:\Users\arthu\segundo-cerebro\.env` a partir de `.env.example` com `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. `AUTH_SECRET` e `TOKEN_ENCRYPTION_KEY`: gerar com `openssl rand -base64 32` (dois valores distintos).

## Próximos passos, em ordem

1. **Arthur resolve os 3 bloqueios acima** (Neon, Google Cloud, `.env`) — nada mais de código pode avançar sem isso.
2. Com `.env` pronto: `npm run db:migrate`, `npm run sync-knowledge`, `npm run dev` e os testes manuais das Tasks 5 (login Google), 8 (nav), 9 (Inbox), 10 (Manual) — todos no navegador local.
3. Task 11 (Vercel: `npx vercel link`, env vars no dashboard, redirect de produção no Google, `vercel --prod`, criar repo GitHub privado + push).
4. Revisão final do branch → superpowers:finishing-a-development-branch → merge em `main`.
5. Depois de tudo pronto: Plano 2 — Fontes (client Google Calendar com refresh, calendário "Cérebro", coletores Moodle/GCal/Outlook → `facts`, tela Semana com eventos reais).

## Notas

- Coautoria nos commits: os subagentes usaram `Claude Sonnet 5` em vez de `Claude Opus 5` em alguns commits; irrelevante, não corrigir.
- Spec §3 vs schema (diferenças intencionais do plano, atualizar spec no fim): `run_status` tem `'running'`; `oauth_tokens.refresh_token_enc` + `updated_at`; `manual_suggestions.created_at`; `knowledge.embedding` fora da v1.
- Nome do projeto continua em aberto.
- Melhorias não-bloqueantes sugeridas pelos revisores, para revisitar quando o motor (Plano 3) existir: log/try-catch em volta da captura do refresh token (Task 5); cor de erro real e estado "salvando..." na tela Manual (Task 10).
