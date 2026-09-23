import Link from 'next/link';
import { SECTOR_LABELS } from '@/src/sectors/sector';
import { sectorOverview } from '@/src/sectors/repo';
import { getWeekRange } from '@/src/facts/week';
import { getCollectionWindow } from '@/src/facts/window';

export default async function HubPage() {
  const now = new Date();
  const { start, end } = getWeekRange(now);
  const { end: horizonEnd } = getCollectionWindow(now);
  const summaries = await sectorOverview(start, end, horizonEnd, now);

  return (
    <>
      <h1>Setores</h1>

      <div className="sector-grid">
        {summaries.map((s) => (
          <Link key={s.sector} href={`/setor/${s.sector}`} className="card sector-card">
            <strong className="sector-card-name">{SECTOR_LABELS[s.sector]}</strong>

            {s.blockCount === 0 && s.factCount === 0 ? (
              <p className="muted sector-card-empty">nada deste setor nesta semana</p>
            ) : (
              <>
                <div className="sector-card-count">
                  <span className="sector-card-number">{s.blockCount}</span>
                  <span className="muted">{s.blockCount === 1 ? 'bloco na semana' : 'blocos na semana'}</span>
                </div>
                {s.next ? (
                  <p className="sector-card-next">
                    <span className="muted">próximo: </span>
                    {s.next.title} <span className="mono muted">{s.next.date.toLocaleDateString('pt-BR')}</span>
                  </p>
                ) : (
                  <p className="muted sector-card-next">sem compromisso no horizonte</p>
                )}
              </>
            )}
          </Link>
        ))}
      </div>

      {(summaries.unassigned.blockCount > 0 || summaries.unassigned.factCount > 0) && (
        <p className="muted">
          Sem setor: {summaries.unassigned.factCount} fato(s) e {summaries.unassigned.blockCount} bloco(s). Calendário
          do Google fora do <code>SECTOR_CALENDAR_MAP</code> e item de inbox caem aqui.
        </p>
      )}
    </>
  );
}
