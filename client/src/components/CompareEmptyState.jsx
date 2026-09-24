/*
 * The pre-selection state for both comparison pages. Rather than a blank
 * canvas, it pre-renders the shape of the analysis to come — a rail per
 * metric category that mirrors CompareBar/CompareStat's own layout — so
 * the page reads as designed before anything is picked.
 */
export default function CompareEmptyState({ eyebrow, title, description, metrics }) {
    return (
        <div className="cmp-empty">
            <div className="cmp-empty-copy">
                <span className="cmp-empty-eyebrow">{eyebrow}</span>
                <h2 className="cmp-empty-title">{title}</h2>
                <p className="cmp-empty-desc">{description}</p>
            </div>
            <ul className="cmp-empty-rails" aria-hidden="true">
                {metrics.map((m) => (
                    <li key={m} className="cmp-empty-rail">
                        <span className="cmp-empty-rail-label">{m}</span>
                        <span className="cmp-empty-rail-track">
                            <span className="cmp-empty-rail-fill" />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
