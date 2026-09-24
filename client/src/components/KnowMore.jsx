/*
 * The "know more" glossary popover used across detail pages: a term
 * inline in copy that opens a small modal with its definition. Always
 * used as a pair, so kept in one file.
 */

export function KnowMoreModal({ info, onClose }) {
    if (!info) {
        return null;
    }
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button onClick={onClose}>X</button>

                <h2>{info.title}</h2>

                <h3>Meaning</h3>
                <p>{info.meaning}</p>

                <h3>Why It Matters</h3>
                <p>{info.whyItMatters}</p>

                <h3>Example</h3>
                <p>{info.example}</p>

                <h3>Beginner Tip</h3>
                <p>{info.beginnerTip}</p>
            </div>
        </div>
    );
}

export function KnowMoreTerm({ term, children, setSelectedTerm, knowMoreInfo }) {
    return (
        <span className="know-more" onClick={() => setSelectedTerm(knowMoreInfo[term])}>
            {children}
        </span>
    );
}
