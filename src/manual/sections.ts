export const MANUAL_SECTIONS = [
  'Perfil',
  'Faculdade',
  'Trabalho',
  'Pessoas',
  'Regras de planejamento',
] as const;

export type ManualSection = (typeof MANUAL_SECTIONS)[number];

export const DEFAULT_MANUAL =
  '# Manual sobre o Arthur\n\n' + MANUAL_SECTIONS.map((s) => `## ${s}\n`).join('\n') + '\n';

function isSection(s: string): s is ManualSection {
  return (MANUAL_SECTIONS as readonly string[]).includes(s);
}

/** Adiciona `- line` no fim da seção `## section`. Cria a seção no fim se não existir. */
export function appendToSection(content: string, section: string, line: string): string {
  if (!isSection(section)) throw new Error(`Seção desconhecida: ${section}`);

  const header = `## ${section}`;
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === header);

  if (start === -1) {
    return content.replace(/\s*$/, '') + `\n\n${header}\n\n- ${line}\n`;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  // Recua para antes das linhas em branco que separam da próxima seção.
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === '') insertAt--;

  const hasBody = insertAt > start + 1;
  const bullet = hasBody ? [`- ${line}`] : ['', `- ${line}`];
  lines.splice(insertAt, 0, ...bullet);

  return lines.join('\n');
}
