/**
 * Categorias de bloco e a cor que cada uma recebe no Google Calendar.
 *
 * Os ids de cor são os do Calendar API (`events.colorId`), não hex:
 * 4 Flamingo (rosa), 6 Tangerine (laranja), 7 Peacock (azul),
 * 8 Graphite (cinza), 10 Basil (verde), 11 Tomato (vermelho), 5 Banana (amarelo).
 */
export const BLOCK_KINDS = ['work', 'class', 'exam', 'assignment', 'study', 'personal', 'travel'] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

const GCAL_COLOR: Record<BlockKind, string> = {
  work: '7',
  class: '10',
  exam: '11',
  assignment: '6',
  study: '4',
  personal: '5',
  travel: '8',
};

export function gcalColorId(kind: BlockKind): string {
  return GCAL_COLOR[kind];
}
