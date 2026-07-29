import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Interactive quiz. Grading is server-side; results show correctness as text +
// icon (not colour alone), and the verdict is announced via role="status".
export default function Quiz({ slug, onProgress }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getQuiz(slug).then(setQuiz).catch((e) => setError(e.message));
  }, [slug]);

  function choose(qid, value) {
    if (result) return;
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function submit() {
    try {
      const res = await api.submitQuiz(slug, answers);
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (onProgress) onProgress(res.progress);
    } catch (e) { setError(e.message); }
  }

  function retake() { setAnswers({}); setResult(null); }

  if (error) return <div className="panel-msg error">! {error}</div>;
  if (!quiz) return <div className="panel-msg">loading quiz…</div>;

  const answered = Object.keys(answers).length;
  const byId = result ? Object.fromEntries(result.results.map((r) => [r.id, r])) : {};
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  return (
    <div className="quiz">
      {!result && (
        <div className="quiz-progress">
          <span>{answered}/{quiz.total} answered</span>
          <span className="qp-track"><span className="qp-fill" style={{ width: `${(answered / quiz.total) * 100}%` }} /></span>
        </div>
      )}

      {result && (
        <div className={`score-banner ${result.passed ? 'pass' : 'fail'}`} role="status" aria-live="polite">
          <span className="verdict">{result.passed ? 'PASS' : 'FAIL'}</span>
          <span>{result.score}/{result.total} · {result.percentage}%</span>
          <span className="exit">{result.passed ? 'exit 0 · +40%' : 'exit 1 · 70% to pass'}</span>
        </div>
      )}

      {quiz.questions.map((q, idx) => {
        const r = byId[q.id];
        const options = q.type === 'truefalse'
          ? [{ label: 'True', value: true }, { label: 'False', value: false }]
          : q.options.map((opt, i) => ({ label: opt, value: i }));
        return (
          <div key={q.id} className={`quiz-q ${r ? (r.correct ? 'correct' : 'incorrect') : ''}`}>
            <div className="quiz-q-head">
              <span className="q-num">{String(idx + 1).padStart(2, '0')}</span>
              <p className="q-text">{q.question}</p>
              {r
                ? <span className={`q-mark ${r.correct ? 'ok' : 'no'}`}>{r.correct ? '✓ correct' : '✗ wrong'}</span>
                : <span className="q-type">{q.type}</span>}
            </div>
            <div className="opts">
              {options.map((opt) => {
                const selected = eq(answers[q.id], opt.value);
                const isCorrect = r && eq(r.correctAnswer, opt.value);
                const isWrongPick = r && selected && !r.correct;
                let cls = 'opt';
                if (!r && selected) cls += ' selected';
                if (isCorrect) cls += ' correct';
                else if (isWrongPick) cls += ' wrong';
                return (
                  <label key={String(opt.value)} className={cls}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      onChange={() => choose(q.id, opt.value)}
                      disabled={!!result}
                    />
                    <span className="opt-label">{opt.label}</span>
                    {isCorrect && <span className={`opt-tag ${r.correct ? 'ok' : 'miss'}`}>{r.correct ? '✓ correct' : 'correct answer'}</span>}
                    {isWrongPick && <span className="opt-tag no">✗ your answer</span>}
                  </label>
                );
              })}
            </div>
            {r && <p className="explain">{r.explanation}</p>}
          </div>
        );
      })}

      <div className="quiz-actions">
        {!result
          ? <button className="btn primary" onClick={submit} disabled={answered === 0}>submit {answered}/{quiz.total} ▸</button>
          : <button className="btn" onClick={retake}>↺ retake</button>}
      </div>
    </div>
  );
}
