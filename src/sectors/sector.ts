/**
 * Os seis setores da vida do Arthur. A ordem é a mesma da roda de navegação
 * (`src/nav/items.ts`) e do enum no banco — mexer aqui é mexer nos três.
 */
export const SECTORS = ['estudos', 'carreira', 'financas', 'saude', 'projetos', 'pessoal'] as const;

export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  estudos: 'Estudos',
  carreira: 'Carreira',
  financas: 'Finanças',
  saude: 'Saúde',
  projetos: 'Projetos',
  pessoal: 'Pessoal',
};

export function isSector(value: unknown): value is Sector {
  return typeof value === 'string' && (SECTORS as readonly string[]).includes(value);
}
