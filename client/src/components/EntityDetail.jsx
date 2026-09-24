import { useEffect, useRef, useState } from "react";
import useInViewOnce from "../hooks/useInViewOnce";
import useReducedMotion from "../hooks/useReducedMotion";

/*
 * Shared building blocks for the Driver/Team/Circuit detail pages and the
 * Comparison pages: an animated number, the editorial section wrapper,
 * a single telemetry readout, and a fallback-walking image. Grouped here
 * because they're always used together on those pages and are small
 * enough that separate files added more navigation cost than clarity.
 */

/* Counts from 0 to `value` with an ease-out curve once `play` becomes
   true. Non-numeric values (e.g. "—") render as-is. Decimals in the
   target are preserved ("54.5" counts in halves' precision). */
export function AnimatedNumber({ value, play = true, duration = 1100 }) {
    const reduced = useReducedMotion();
    const target = parseFloat(value);
    const numeric = !Number.isNaN(target);
    const decimals = numeric && String(value).includes(".")
        ? String(value).split(".")[1].length
        : 0;

    const [display, setDisplay] = useState(numeric ? 0 : value);
    const frame = useRef(0);

    useEffect(() => {
        if (!numeric) return undefined;

        const start = performance.now();
        const tick = (now) => {
            if (!play) { setDisplay(0); return; }
            if (reduced) { setDisplay(target); return; }
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(target * eased);
            if (t < 1) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [numeric, play, reduced, target, duration]);

    if (!numeric) return <>{value ?? "—"}</>;
    return <>{display.toFixed(decimals)}</>;
}

/* Editorial section scaffolding shared by every entity page: a technical
   rule with a red kerb tick, a mono eyebrow, a condensed display title,
   and a one-time rise-in scroll animation. */
export function ExSection({ eyebrow, title, children, className = "", wide = false }) {
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

/* A single telemetry readout: oversized condensed value that counts up
   when scrolled into view, a mono label underneath, and an optional
   kerb-tick meter (`meter` = 0..1) for visual weight. */
export function TelemetryStat({ value, label, sub, meter = null, accent = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });

    return (
        <div ref={ref} className={`ex-stat${accent ? " ex-stat--accent" : ""}`}>
            <span className="ex-stat-value">
                <AnimatedNumber value={value} play={inView} />
            </span>
            <span className="ex-stat-label">{label}</span>
            {sub && <span className="ex-stat-sub">{sub}</span>}
            {meter !== null && (
                <span className="ex-stat-meter" aria-hidden="true">
                    <span
                        className="ex-stat-meter-fill"
                        style={{ width: inView ? `${Math.max(0, Math.min(1, meter)) * 100}%` : 0 }}
                    />
                </span>
            )}
        </div>
    );
}

/* Image that walks an ordered list of candidate sources until one loads.
   Canonical local paths are listed first (they may 404 today), then
   whatever exists in the repo, and finally `fallback` if nothing loads. */
export function LayeredImage({ candidates = [], alt = "", className = "", style, fallback = null, draggable = false }) {
    const [idx, setIdx] = useState(0);

    /* restart the walk when the entity (and so the candidate list)
       changes — state adjustment during render, per the React docs */
    const key = candidates.join("|");
    const [prevKey, setPrevKey] = useState(key);
    if (prevKey !== key) {
        setPrevKey(key);
        setIdx(0);
    }

    if (!candidates.length || idx >= candidates.length) return fallback;

    return (
        <img
            src={candidates[idx]}
            alt={alt}
            className={className}
            style={style}
            draggable={draggable}
            onError={() => setIdx((i) => i + 1)}
        />
    );
}
