const SYSTEM_PROMPT = `Você é o "cérebro" de um sistema pessoal de planejamento para o Arthur. Sua função é olhar pra tudo que existe no mundo dele (Google Calendar, Moodle, Outlook, itens da inbox) e decidir os blocos de estudo, tarefa e viagem da semana, escrevendo-os no calendário Google "Cérebro" dele.

Regras de comportamento:
1. Idempotente: sem nada novo, não emita blocks.update nem blocks.delete. Só gere diffs em relação aos blocos atuais recebidos.
2. Passado é imutável: nunca inclua em blocks.update ou blocks.delete um bloco cujo horário de término já passou.
3. Edição do Arthur vence: se as observações indicarem que o Arthur moveu ou editou um bloco, mantenha a versão dele a menos que ela colida com um evento real (fact). Quando notar um padrão repetido, proponha um manual_suggestion sobre isso.
4. Pergunta não bloqueia: planeje com a melhor hipótese possível e registre no reason "assumindo X — pergunta em aberto", em vez de esperar a resposta.
5. Só escreva no Cérebro: nunca proponha alterar um fact vindo de fonte externa (gcal/moodle/outlook) — isso é gerenciado fora do seu controle.
6. Manual é sugestão, não edição: nunca reescreva o manual inteiro; só proponha linhas novas via manual_suggestions.
7. Conflitos explícitos: se a soma de horas necessárias (segundo o manual) não couber na semana, emita um conflict em vez de espremer os blocos silenciosamente.

Seções válidas do manual (use exatamente um destes valores em manual_suggestions.section): Perfil, Faculdade, Trabalho, Pessoas, Regras de planejamento.

Tipos de bloco válidos: study (estudo), task (tarefa), travel (viagem), buffer (respiro/deslocamento).

Todas as datas (inbox.date, inbox.end_date, blocks.*.start, blocks.*.end) devem ser strings ISO 8601 completas com o fuso -03:00 (horário de Brasília), por exemplo "2026-09-25T14:00:00-03:00".`;

export function buildSystemPrompt(): { type: 'text'; text: string; cache_control: { type: 'ephemeral' } }[] {
  return [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];
}

type Fact = { source: string; kind: string; title: string; date: Date };
type Block = { id: number; kind: string; status: string; title: string; start: Date; end: Date };
type InboxItem = { id: number; text: string };
type AnsweredQuestion = { text: string; answer: string | null };
type KnowledgeDoc = { title: string; content: string };

export type UserContentInput = {
  manual: string;
  knowledge: KnowledgeDoc[];
  today: Date;
  weekStart: Date;
  weekEnd: Date;
  facts: Fact[];
  blocks: Block[];
  observations: string[];
  inboxItems: InboxItem[];
  answeredQuestions: AnsweredQuestion[];
};

function fmt(d: Date): string {
  return d.toLocaleString('pt-BR');
}

export function buildUserContent(
  input: UserContentInput,
): [
  { type: 'text'; text: string; cache_control: { type: 'ephemeral' } },
  { type: 'text'; text: string; cache_control?: undefined },
] {
  const stable = [
    `Manual sobre o Arthur:\n${input.manual}`,
    `Conhecimento:\n${input.knowledge.map((k) => `## ${k.title}\n${k.content}`).join('\n\n')}`,
  ].join('\n\n');

  const variable = [
    `Hoje: ${input.today.toLocaleDateString('pt-BR')}`,
    `Semana: ${input.weekStart.toLocaleDateString('pt-BR')} a ${input.weekEnd.toLocaleDateString('pt-BR')}`,
    '',
    'Fatos (próximas semanas):',
    input.facts.map((f) => `- [${f.source}/${f.kind}] ${f.title} — ${fmt(f.date)}`).join('\n') || '(nenhum)',
    '',
    'Blocos atuais no Cérebro:',
    input.blocks.map((b) => `- #${b.id} [${b.kind}/${b.status}] ${b.title} — ${fmt(b.start)} a ${fmt(b.end)}`).join('\n') ||
      '(nenhum)',
    '',
    'Observações (o que o Arthur mudou manualmente):',
    input.observations.join('\n') || '(nenhuma)',
    '',
    'Itens novos na inbox:',
    input.inboxItems.map((i) => `- #${i.id} ${i.text}`).join('\n') || '(nenhum)',
    '',
    'Respostas novas desde o último run:',
    input.answeredQuestions.map((q) => `- Pergunta: ${q.text}\n  Resposta: ${q.answer ?? ''}`).join('\n') || '(nenhuma)',
  ].join('\n');

  return [
    { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: variable },
  ];
}
