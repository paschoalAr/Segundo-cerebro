import { listInboxItems } from '@/src/inbox/repo';
import { removeFromInbox, sendToInbox } from './actions';

const STATUS_LABEL = { new: 'aguardando o cérebro', processed: 'processado', ignored: 'ignorado' } as const;

function describe(item: Awaited<ReturnType<typeof listInboxItems>>[number]) {
  const p = item.processedInto;
  if (!p) return STATUS_LABEL[item.status];
  const parts: string[] = [];
  if (p.factIds?.length) parts.push(`→ ${p.factIds.length} fato(s)`);
  if (p.questionIds?.length) parts.push(`→ ${p.questionIds.length} pergunta(s)`);
  if (p.why) parts.push(p.why);
  return parts.join(' · ') || STATUS_LABEL[item.status];
}

export default async function InboxPage() {
  const items = await listInboxItems();

  return (
    <>
      <h1>Inbox</h1>
      <form action={sendToInbox}>
        <textarea
          name="text"
          rows={4}
          placeholder="prova de Redes terça 22/09 · niver da mãe 20/09 · reunião com o Pedro sexta 15h"
          required
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="submit">Enviar</button>
        </div>
      </form>

      <h2 style={{ marginTop: 24 }}>Itens</h2>
      {items.length === 0 && <p className="muted">Nada ainda.</p>}
      {items.map((item) => (
        <div key={item.id} className="card">
          <div>{item.text}</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">
              {item.createdAt.toLocaleString('pt-BR')} · {describe(item)}
            </span>
            <form action={removeFromInbox}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="secondary">
                Apagar
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
