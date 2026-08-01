// Renders a module walkthrough guide: an intro, then numbered steps grouped
// into sections, each step with optional illustrative image + caption.
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
                        <img src={step.image} alt={step.caption || step.text} loading="lazy" />
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
