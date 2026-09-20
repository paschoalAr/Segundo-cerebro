import { listKnowledge } from '@/src/knowledge/repo';
import { getManual } from '@/src/manual/repo';
import { listRecentRuns } from '@/src/runs/repo';
import { updateManual } from './actions';

export default async function ManualPage() {
  const [man, docs, runs] = await Promise.all([getManual(), listKnowledge(), listRecentRuns()]);

  return (
    <>
      <h1>Manual</h1>
      <p className="muted">
        Seções fixas: Perfil · Faculdade · Trabalho · Pessoas · Regras de planejamento. O cérebro só
        propõe linhas; quem escreve aqui é você.
      </p>
      <form action={updateManual}>
        <textarea name="content" rows={24} defaultValue={man.content} style={{ fontFamily: 'ui-monospace, monospace' }} />
        <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <span className="muted">Atualizado {man.updatedAt.toLocaleString('pt-BR')}</span>
          <button type="submit">Salvar</button>
        </div>
      </form>

      <h2 style={{ marginTop: 32 }}>Conhecimento ({docs.length})</h2>
      <p className="muted">
        Importado da memória do Claude Code. Para atualizar, rode <code>npm run sync-knowledge</code>{' '}
        na sua máquina.
      </p>
      {docs.map((d) => (
        <div key={d.id} className="card row" style={{ justifyContent: 'space-between' }}>
          <span>{d.title}</span>
          <span className="muted">
            {d.source} · {d.updatedAt.toLocaleDateString('pt-BR')}
          </span>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Planejamentos</h2>
      {runs.length === 0 && <p className="muted">Nenhum ainda — o motor chega no plano 3.</p>}
      {runs.map((r) => (
        <div key={r.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              {r.startedAt.toLocaleString('pt-BR')} · {r.trigger} · {r.status}
            </span>
            <span className="muted">
              {r.inputTokens ?? 0} in / {r.outputTokens ?? 0} out
            </span>
          </div>
          {r.summary && <div>{r.summary}</div>}
          {r.error && <div style={{ color: 'var(--fg)' }}>Erro: {r.error}</div>}
        </div>
      ))}
    </>
  );
}
