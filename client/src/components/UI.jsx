import { Link } from "react-router-dom";

/*
 * The Phase 1 generic design-system primitives, used across every page:
 * Button, Input/Select/SearchInput, EmptyState, Stat and LoadingSpinner.
 * Grouped in one file since each is small and none is specific to any
 * one feature.
 */

function ArrowGlyph() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}

/* Shared button system — variants: primary / secondary / light / dark /
   icon. Renders a <Link> when given `to`, an <a> when given `href`,
   otherwise a native <button>. Pass `arrow` to add the trailing circular
   arrow badge from the design reference.

     <Button variant="primary" arrow>Enter Race Weekend</Button>
     <Button variant="light" to="/drivers" arrow>View Drivers</Button> */
export function Button({
    variant = "secondary",
    size,
    arrow = false,
    to,
    href,
    className = "",
    children,
    ...rest
}) {
    const classes = `btn btn-${variant}${size ? ` btn-${size}` : ""}${className ? ` ${className}` : ""}`;
    const content = (
        <>
            {children}
            {arrow && (
                <span className="btn-arrow" aria-hidden="true">
                    <ArrowGlyph />
                </span>
            )}
        </>
    );

    if (to) {
        return (
            <Link to={to} className={classes} {...rest}>
                {content}
            </Link>
        );
    }

    if (href) {
        return (
            <a href={href} className={classes} {...rest}>
                {content}
            </a>
        );
    }

    return (
        <button type={rest.type || "button"} className={classes} {...rest}>
            {content}
        </button>
    );
}

/* Shared input system — a text Input, a Select, and a SearchInput
   composition (input with a leading search glyph). Consistent height,
   border, radius and focus ring across search / filters / dictionary /
   driver & constructor pickers. */
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

/* Shared empty state — for pages like Driver/Team Comparison before a
   selection is made. Intentional, not a blank page:

     <EmptyState
       title="Two cars. One straight."
       description="Select two drivers above to line them up."
       action={<Button variant="primary">Select a driver</Button>}
     /> */
function DefaultEmptyIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="12" r="6" />
            <circle cx="15" cy="12" r="6" />
        </svg>
    );
}

export function EmptyState({ icon, title, description, action, onLight = false, className = "" }) {
    return (
        <div className={`empty-state${onLight ? " empty-state--on-light" : ""}${className ? ` ${className}` : ""}`}>
            <span className="empty-state-icon" aria-hidden="true">
                {icon || <DefaultEmptyIcon />}
            </span>
            {title && <h3 className="empty-state-title">{title}</h3>}
            {description && <p className="empty-state-desc">{description}</p>}
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
}

/* Shared statistic display — a prominent mono value over a small
   technical label, e.g.:

     <Stat value={25} label="Winner Points" />
     <Stat value="+4.351" label="Winning Gap" accent />

   `onLight` switches the colour pairing for use inside a light Card. */
export function Stat({ value, label, accent = false, onLight = false, className = "" }) {
    const classes = `stat${accent ? " stat--accent" : ""}${onLight ? " stat--on-light" : ""}${className ? ` ${className}` : ""}`;
    return (
        <div className={classes}>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}

/* Minimal, restrained loading indicator: three dots easing in sequence. */
export function LoadingSpinner({ label = "Loading" }) {
    return (
        <div className="aaf-spinner" role="status" aria-live="polite">
            <span className="aaf-spinner-dots" aria-hidden="true">
                <i /><i /><i />
            </span>
            <p className="aaf-spinner-label">{label}</p>
        </div>
    );
}
