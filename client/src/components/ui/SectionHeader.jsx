/*
 * Shared section header — a small mono eyebrow over an Inter title, with
 * an optional description:
 *
 *   <SectionHeader eyebrow="Race Intelligence" title="What happened at
 *     the last Grand Prix" />
 *
 * `onLight` switches the colour pairing for use inside a light Card.
 */
export default function SectionHeader({ eyebrow, title, description, onLight = false, className = "" }) {
    return (
        <header className={`section-header${onLight ? " section-header--on-light" : ""}${className ? ` ${className}` : ""}`}>
            {eyebrow && <span className="section-header-eyebrow">{eyebrow}</span>}
            {title && <h2 className="section-header-title">{title}</h2>}
            {description && <p className="section-header-desc">{description}</p>}
        </header>
    );
}
