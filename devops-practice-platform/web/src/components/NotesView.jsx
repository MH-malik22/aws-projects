// Structured notes: definitions, commands, best practices, pitfalls, cheat
// sheet. The command table scrolls horizontally inside its own container so
// the page never scrolls sideways on mobile.
export default function NotesView({ notes }) {
  if (!notes) return null;
  return (
    <div className="notes">
      {notes.definitions?.length > 0 && (
        <section className="note-block">
          <h3># key definitions</h3>
          <dl className="def-list">
            {notes.definitions.map((d, i) => (
              <div key={i} className="def-row">
                <dt>{d.term}</dt>
                <dd>{d.def}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {notes.commands?.length > 0 && (
        <section className="note-block">
          <h3># important commands</h3>
          <div className="cmd-scroll">
            <table className="cmd-table">
              <tbody>
                {notes.commands.map((c, i) => (
                  <tr key={i}>
                    <td><code>{c.cmd}</code></td>
                    <td>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="note-columns">
        {notes.bestPractices?.length > 0 && (
          <section className="note-block good">
            <h3># best practices</h3>
            <ul>{notes.bestPractices.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </section>
        )}
        {notes.pitfalls?.length > 0 && (
          <section className="note-block bad">
            <h3># common pitfalls</h3>
            <ul>{notes.pitfalls.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </section>
        )}
      </div>

      {notes.cheatSheet?.length > 0 && (
        <section className="note-block cheat">
          <h3># cheat sheet</h3>
          <ul className="cheat-list">
            {notes.cheatSheet.map((c, i) => <li key={i}><code>{c}</code></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
