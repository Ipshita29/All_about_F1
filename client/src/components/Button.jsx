import { Link } from "react-router-dom";

/*
 * Shared button system — variants: primary / secondary / light / dark /
 * icon. Renders a <Link> when given `to`, an <a> when given `href`,
 * otherwise a native <button>. Pass `arrow` to add the trailing circular
 * arrow badge from the design reference.
 *
 *   <Button variant="primary" arrow>Enter Race Weekend</Button>
 *   <Button variant="light" to="/drivers" arrow>View Drivers</Button>
 */
function ArrowGlyph() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}

export default function Button({
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
