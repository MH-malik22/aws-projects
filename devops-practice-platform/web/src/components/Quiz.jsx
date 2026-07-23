import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Interactive quiz: fetch questions, collect answers, submit for grading, and
// show per-question explanations. Notifies the parent when progress changes.
export default function Quiz({ slug, onProgress }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getQuiz(slug).then(setQuiz).catch((e) => setError(e.message));
  }, [slug]);

  function choose(qid, value) {
    if (result) return; // locked after submit
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function submit() {
    try {
      const res = await api.submitQuiz(slug, answers);
      setResult(res);
      if (onProgress) onProgress(res.progress);
    } catch (e) {
      setError(e.message);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
  }

  if (error) return <div className="panel error">{error}</div>;
  if (!quiz) return <div className="panel">Loading quiz…</div>;

  const answeredCount = Object.keys(answers).length;
  const resultById = result
    ? Object.fromEntries(result.results.map((r) => [r.id, r]))
    : {};

  return (
    <div className="quiz">
      {result && (
        <div className={`quiz-score ${result.passed ? 'pass' : 'fail'}`}>
          <strong>{result.score}/{result.total}</strong> correct ({result.percentage}%) —{' '}
          {result.passed ? 'Passed! 🎉' : 'Keep practicing (70% to pass)'}
        </div>
      )}

      {quiz.questions.map((q, idx) => {
        const r = resultById[q.id];
        return (
          <div key={q.id} className={`quiz-q ${r ? (r.correct ? 'correct' : 'incorrect') : ''}`}>
            <p className="quiz-q-text">
              <span className="q-num">{idx + 1}</span>
              {q.question}
              <span className={`q-type type-${q.type}`}>{q.type}</span>
            </p>
            <div className="quiz-options">
              {(q.type === 'truefalse' ? [{ label: 'True', value: true }, { label: 'False', value: false }]
                : q.options.map((opt, i) => ({ label: opt, value: i }))
              ).map((opt) => {
                const selected = answers[q.id] === opt.value;
                const isCorrectOpt = r && JSON.stringify(r.correctAnswer) === JSON.stringify(opt.value);
                let cls = 'quiz-option';
                if (selected) cls += ' selected';
                if (r && isCorrectOpt) cls += ' answer-correct';
                if (r && selected && !r.correct) cls += ' answer-wrong';
                return (
                  <label key={String(opt.value)} className={cls}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      onChange={() => choose(q.id, opt.value)}
                      disabled={!!result}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
            {r && <p className="quiz-explanation">{r.explanation}</p>}
          </div>
        );
      })}

      <div className="quiz-actions">
        {!result ? (
          <button className="btn primary" onClick={submit} disabled={answeredCount === 0}>
            Submit ({answeredCount}/{quiz.total} answered)
          </button>
        ) : (
          <button className="btn" onClick={retake}>Retake quiz</button>
        )}
      </div>
    </div>
  );
}
