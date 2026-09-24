/*
 * Shared input system — a text Input, a Select, and a SearchInput
 * composition (input with a leading search glyph). Consistent height,
 * border, radius and focus ring across search / filters / dictionary /
 * driver & constructor pickers.
 */
export function Input({ label, className = "", ...rest }) {
    const field = <input className={`input${className ? ` ${className}` : ""}`} {...rest} />;
    if (!label) return field;
    return (
        <label className="input-field">
            <span className="input-label">{label}</span>
            {field}
        </label>
    );
}

export function Select({ label, children, className = "", ...rest }) {
    const field = (
        <select className={`select${className ? ` ${className}` : ""}`} {...rest}>
            {children}
        </select>
    );
    if (!label) return field;
    return (
        <label className="input-field">
            <span className="input-label">{label}</span>
            {field}
        </label>
    );
}

function SearchGlyph() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

export function SearchInput({ label, className = "", ...rest }) {
    const field = (
        <div className="input-search">
            <span className="input-search-icon"><SearchGlyph /></span>
            <input type="text" className={`input${className ? ` ${className}` : ""}`} {...rest} />
        </div>
    );
    if (!label) return field;
    return (
        <label className="input-field">
            <span className="input-label">{label}</span>
            {field}
        </label>
    );
}
