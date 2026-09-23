import { SECTORS, type Sector } from './sector';

export type BlockRow = { sector: Sector | null; start: Date };
export type FactRow = { sector: Sector | null; title: string; date: Date };

export type SectorSummary = {
  sector: Sector;
  blockCount: number;
  factCount: number;
  next: { title: string; date: Date } | null;
};

export type SectorSummaries = SectorSummary[] & {
  unassigned: { blockCount: number; factCount: number };
};

/**
 * Agrupa blocos da semana e fatos do horizonte por setor. Devolve **sempre** os seis,
 * inclusive zerados — o hub mostra setor vazio como vazio, nunca escondido.
 * A contagem de linhas sem setor vem junto em `unassigned`, pra tela poder dizer
 * quantas coisas ainda não foram classificadas em vez de fingir que não existem.
 */
export function summarizeSectors(blocks: BlockRow[], facts: FactRow[]): SectorSummaries {
  const out = SECTORS.map((sector): SectorSummary => {
    const sectorFacts = facts.filter((f) => f.sector === sector);
    let next: SectorSummary['next'] = null;
    for (const f of sectorFacts) {
      if (next === null || f.date.getTime() < next.date.getTime()) next = { title: f.title, date: f.date };
    }
    return {
      sector,
      blockCount: blocks.filter((b) => b.sector === sector).length,
      factCount: sectorFacts.length,
      next,
    };
  }) as SectorSummaries;

  out.unassigned = {
    blockCount: blocks.filter((b) => b.sector === null).length,
    factCount: facts.filter((f) => f.sector === null).length,
  };

  return out;
}
