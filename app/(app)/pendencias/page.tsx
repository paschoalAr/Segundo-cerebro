import { listOpenQuestions } from '@/src/questions/repo';
import { listPendingSuggestions } from '@/src/manual/suggestions-repo';
import {
  acceptSuggestionAction,
  answerQuestionAction,
  dismissQuestionAction,
  rejectSuggestionAction,
} from './actions';

export default async function PendenciasPage() {
  const [questions, suggestions] = await Promise.all([listOpenQuestions(), listPendingSuggestions()]);

  return (
    <>
      <h1>Pendências</h1>

      <h2>Perguntas ({questions.length})</h2>
      {questions.length === 0 && <p className="muted">Nenhuma pergunta em aberto.</p>}
      {questions.map((q) => (
        <div key={q.id} className="card">
          <div>{q.text}</div>
          <span className="muted">{q.askedAt.toLocaleString('pt-BR')}</span>
          <form action={answerQuestionAction} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={q.id} />
            <input type="text" name="answer" placeholder="Sua resposta" required />
            <button type="submit">Responder</button>
          </form>
          <form action={dismissQuestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={q.id} />
            <button type="submit" className="secondary">Dispensar</button>
          </form>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Sugestões de manual ({suggestions.length})</h2>
      {suggestions.length === 0 && <p className="muted">Nenhuma sugestão pendente.</p>}
      {suggestions.map((s) => (
        <div key={s.id} className="card">
          <div className="muted">{s.section}</div>
          <form action={acceptSuggestionAction}>
            <input type="hidden" name="id" value={s.id} />
            <textarea name="text" defaultValue={s.text} rows={2} />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="submit">Aceitar</button>
            </div>
          </form>
          <form action={rejectSuggestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="secondary">Rejeitar</button>
          </form>
        </div>
      ))}
    </>
  );
}
