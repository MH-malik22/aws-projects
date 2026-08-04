// Renders a module guide. A section is either a list of numbered steps (a
// walkthrough) or a reference table of commands.
export default function GuideView({ guide }) {
  if (!guide) return null;
  // Continuous step numbering across sections.
  let n = 0;
  return (
    <div className="guide">
      {guide.intro && <p className="guide-intro">{guide.intro}</p>}

      {(guide.sections || []).map((section, si) => (
        <section className="guide-section" key={si}>
          {section.heading && <h3 className="guide-heading"># {section.heading}</h3>}

          {section.commands && (
            <div className="cmd-scroll">
              <table className="ref-table">
                <thead>
                  <tr><th>Command</th><th>What it does</th><th>Real DevOps example</th></tr>
                </thead>
                <tbody>
                  {section.commands.map((c, i) => (
                    <tr key={i}>
                      <td><code>{c.cmd}</code></td>
                      <td>{c.desc}</td>
                      <td className="ref-example">{c.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ol className="guide-steps">
            {(section.steps || []).map((step, i) => {
              n += 1;
              return (
                <li className="guide-step" key={i}>
                  <span className="guide-step-num">{String(n).padStart(2, '0')}</span>
                  <div className="guide-step-body">
                    <p className="guide-step-text">{step.text}</p>
                    {step.image && (
                      <figure className="guide-figure">
                        <img
                          src={step.image}
                          alt={step.caption || step.text}
                          loading="lazy"
                          onError={(e) => {
                            // Fall back to the illustrative diagram until a real
                            // screenshot is dropped in at step.image's path.
                            if (step.fallback && !e.currentTarget.dataset.fb) {
                              e.currentTarget.dataset.fb = '1';
                              e.currentTarget.src = step.fallback;
                            }
                          }}
                        />
                        {step.caption && <figcaption>{step.caption}</figcaption>}
                      </figure>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
