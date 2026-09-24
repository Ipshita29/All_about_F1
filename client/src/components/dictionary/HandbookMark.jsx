/*
 * The Dictionary's one recurring visual motif — a technical racing-line
 * annotation, not F1 photography. A single dashed line, a couple of
 * engineering tick marks and a reticle, all at low opacity so it reads as
 * a blueprint accent rather than decoration. Reused wherever the page
 * wants to say "engineering knowledge" without another photo or icon grid.
 */
export default function HandbookMark({ className = "" }) {
    return (
        <svg
            className={`fd-mark${className ? ` ${className}` : ""}`}
            viewBox="0 0 220 220"
            fill="none"
            aria-hidden="true"
        >
            <path
                className="fd-mark-line"
                d="M8 170 Q40 60 96 52 Q140 46 150 90 Q158 126 200 118"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="5 6"
            />
            <circle cx="96" cy="52" r="3" fill="currentColor" />
            <circle cx="150" cy="90" r="3" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1">
                <circle cx="200" cy="118" r="14" />
                <line x1="186" y1="118" x2="214" y2="118" />
                <line x1="200" y1="104" x2="200" y2="132" />
            </g>
            <text x="100" y="42" className="fd-mark-tag">APEX</text>
            <text x="154" y="112" className="fd-mark-tag">T2</text>
        </svg>
    );
}
