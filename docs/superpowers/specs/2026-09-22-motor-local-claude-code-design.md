# Motor local via Claude Code (em vez da API paga) — Design

**Data:** 2026-09-22
**Status:** aprovado em conversa, aguardando revisão do arquivo escrito
**Contexto:** revisão da Task 8/9 do `docs/superpowers/plans/2026-09-22-plano-3-motor.md` (Plano 3 — Motor), que originalmente previa chamar a API paga da Anthropic a partir de uma rota da Vercel disparada por cron.

## 1. Motivação

O Arthur já paga uma assinatura Claude (usada neste próprio app desktop) e não quer também pagar por token via `@anthropic-ai/sdk`/`ANTHROPIC_API_KEY` só pra rodar o motor de planejamento uma vez por dia. A alternativa: usar o Claude Code instalado na própria máquina dele — que autentica via a assinatura (OAuth), não API key — como o "cérebro" que gera o `PlanOutput`.

## 2. Decisão

**Trocar só o motor, manter o resto do Plano 3 como já desenhado.** As Tasks 1–7 do Plano 3 (schema do banco, repos de apoio, escrita no Google Calendar, observações, `PlanOutputSchema`, `buildSystemPrompt`/`buildUserContent`, `applyPlanOutput`) continuam exatamente como estão — nenhuma delas sabe ou se importa se quem gerou o `PlanOutput` foi a API ou o Claude Code local. Só a "Task 8" muda: em vez de `new Anthropic().messages.stream(...)`, um script local invoca o binário `claude` como subprocesso, pedindo a mesma saída estruturada.

Isso foi descartado em favor da opção mais simples entre as consideradas:
- ❌ Agente explorando via MCP (ferramentas de leitura/escrita, várias etapas) — mais "nativo" ao produto, mas exige construir um servidor MCP do zero e o comportamento fica menos previsível/testável.
- ❌ Híbrido MCP-pra-ler + ferramenta única pra decidir — meio-termo interessante, mas ainda exige um servidor MCP novo só pra entregar o mesmo contexto que já cabe direto num prompt de texto.
- ✅ **Trocar só o motor**: reaproveita ~90% do que já foi planejado, comportamento idêntico ao desenho original (um prompt, uma resposta JSON validada), sem servidor novo.

## 3. Disparo: ao logar no Windows, sem gatilho remoto

O app fica implantado na Vercel; uma função serverless da Vercel não tem como disparar um processo na máquina do Arthur. Então:

- **Sem cron na Vercel, sem rota `/api/plan`, sem `CRON_SECRET`.**
- **Sem botão "Replanejar" no site** — a Semana (Task 9 do Plano 3) fica só leitura do último run (blocos, conflitos, resumo). Rodar de novo é local.
- Uma tarefa no **Agendador de Tarefas do Windows**, gatilho **"ao fazer logon"** (não horário fixo — se o PC estiver desligado às 6h, roda na próxima vez que o Arthur logar, em vez de simplesmente não rodar naquele dia), executa o script local.
- Pra forçar um replanejamento fora do horário de logon, o Arthur roda o mesmo script na mão (atalho ou o próprio Agendador de Tarefas, "Executar").

## 4. Invocação do Claude Code

Confirmado direto no binário instalado (`claude --help`, versão 2.1.275) — não a partir de suposição:

```
claude -p \
  --output-format json \
  --json-schema '<PlanOutputSchema convertido pra JSON Schema>' \
  --system-prompt '<as mesmas regras de comportamento da Task 6 do Plano 3>' \
  --tools "" \
  --permission-prompts none \
  --no-session-persistence \
  --model opus \
  '<o mesmo bloco de contexto da Task 6: manual + knowledge + facts + blocos + observações + inbox>'
```

Decisões por trás de cada flag:

| Flag | Por quê |
|---|---|
| `-p` | Modo não-interativo — roda um turno e sai, dá pra chamar como subprocesso. |
| `--output-format json` + `--json-schema` | O mesmo papel do `output_config.format` da API: força saída estruturada validada, em vez de confiar que o texto livre vem em JSON limpo. |
| `--system-prompt` (não `--append-system-prompt`) | Substitui completamente o prompt padrão do Claude Code — sem a persona de "assistente de código", só as regras de comportamento do motor. |
| `--tools ""` | Desliga todas as ferramentas — essa tarefa é 100% texto-entra/JSON-sai, não precisa (nem deve) explorar arquivos ou rodar comandos. |
| `--permission-prompts none` | Garante que nada tenta abrir um prompt de confirmação e trava o processo desatendido. |
| `--no-session-persistence` | Não deixa sessão salva em disco pra uma automação que roda todo dia. |
| `--model opus` | Equivalente ao `PLANNER_MODEL` do desenho original — trocável pra `sonnet` se o custo/latência incomodar (mesma decisão que já estava registrada no spec do produto). |
| **Sem `--bare`** | `--bare` parecia a escolha óbvia pra isolar de configurações do projeto, mas a doc é explícita: em modo `--bare` a autenticação "é estritamente `ANTHROPIC_API_KEY` ou `apiKeyHelper`... OAuth e keychain nunca são lidos". Isso quebraria exatamente o ponto de usar a assinatura em vez da API paga. Em vez disso, o subprocesso roda com `cwd` numa pasta neutra sem `CLAUDE.md`/`.claude/settings.json`, pra não herdar contexto do projeto sem sacrificar a autenticação OAuth. |

## 5. Resolução do caminho do `claude.exe`

O binário vive dentro de uma pasta versionada do app desktop (ex.: `...\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude-code\2.1.275\claude.exe`) — o número de versão muda a cada atualização do app. O script local **não pode fixar esse caminho**; precisa localizar a pasta `claude-code\*` e escolher a versão mais recente a cada execução (glob + ordenação por número de versão ou por data de modificação).

## 6. O que sai do Plano 3 original

- `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, `PLANNER_MODEL` como env var da Vercel, `CRON_SECRET`, `vercel.json` → `crons`, `app/api/plan/route.ts`.
- O botão/`server action` "Replanejar" em `app/(app)/actions.ts` e `app/(app)/page.tsx`.

## 7. O que fica igual

- Tasks 1–7 do Plano 3, sem nenhuma mudança de código.
- `plan_runs` continua guardando `inputTokens`/`cacheReadTokens`/`outputTokens` (ficam `null` em runs locais — a assinatura não expõe contagem de tokens por chamada do jeito que a API expõe; se o envelope JSON do CLI trouxer `total_cost_usd`, isso pode ser registrado à parte, a confirmar na verificação).
- `PlanOutputSchema`, `buildSystemPrompt`/`buildUserContent`, `applyPlanOutput` — reaproveitados sem alteração, só trocando quem os chama.

## 8. Riscos conhecidos

- **PC desligado/sem internet no logon**: o run simplesmente não acontece naquele dia; sem fallback automático além de rodar na mão.
- **Atualização do Claude Code muda o caminho do binário ou as flags**: a resolução dinâmica de versão (§5) cobre o primeiro caso; uma mudança de flag exigiria ajuste manual no script — risco aceito, baixa frequência esperada.
- **Cota da assinatura**: mesmo sem custo por token, o Claude Code tem limites de uso por sessão/semana dependendo do plano do Arthur — um run diário consumindo ~20k tokens de contexto é pequeno frente a isso, mas vale observar na prática.
