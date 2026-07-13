import useInViewOnce from "../../hooks/useInViewOnce";

/*
 * Editorial section scaffolding shared by every entity page: a technical
 * rule with a red kerb tick, a mono eyebrow, a condensed display title, and
 * a one-time rise-in scroll animation. Mirrors the landing page's section
 * grammar so the whole site reads as one system.
 */
function ExSection({ eyebrow, title, children, className = "", wide = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.12 });

    return (
        <section
            ref={ref}
            className={`ex-section${wide ? " ex-section--wide" : ""}${inView ? " is-inview" : ""} ${className}`}
        >
            {(eyebrow || title) && (
                <header className="ex-section-head">
                    {eyebrow && <span className="ex-eyebrow">{eyebrow}</span>}
                    {title && <h2 className="ex-section-title">{title}</h2>}
                </header>
            )}
            {children}
        </section>
    );
}

export default ExSection;
