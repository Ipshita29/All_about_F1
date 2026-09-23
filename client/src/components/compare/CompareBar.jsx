import useInViewOnce from "../../hooks/useInViewOnce";
import AnimatedNumber from "../entity/AnimatedNumber";

/*
 * Proportional two-row bar for count-style metrics (points, wins, podiums,
 * poles) — bar length reads as "how much", which only makes sense when
 * more genuinely means more. Neither bar is tinted by rank; Milano Red is
 * reserved for the page's own accents, not for implying a winner here.
 */
export default function CompareBar({ label, a, b }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const n1 = parseFloat(a.value);
    const n2 = parseFloat(b.value);
    const hasA = !Number.isNaN(n1);
    const hasB = !Number.isNaN(n2);
    const max = Math.max(hasA ? n1 : 0, hasB ? n2 : 0, 1);

    return (
        <div ref={ref} className="cmp-bar-group">
            <span className="cmp-bar-label">{label}</span>

            <div className="cmp-bar-row">
                <span className="cmp-bar-name">{a.name}</span>
                <span className="cmp-bar-track" aria-hidden="true">
                    <span
                        className="cmp-bar-fill cmp-bar-fill--a"
                        style={{ width: inView && hasA ? `${(n1 / max) * 100}%` : 0 }}
                    />
                </span>
                <span className="cmp-bar-val">{hasA ? <AnimatedNumber value={a.value} play={inView} /> : "—"}</span>
            </div>

            <div className="cmp-bar-row">
                <span className="cmp-bar-name">{b.name}</span>
                <span className="cmp-bar-track" aria-hidden="true">
                    <span
                        className="cmp-bar-fill cmp-bar-fill--b"
                        style={{ width: inView && hasB ? `${(n2 / max) * 100}%` : 0 }}
                    />
                </span>
                <span className="cmp-bar-val">{hasB ? <AnimatedNumber value={b.value} play={inView} /> : "—"}</span>
            </div>

            {!hasA && !hasB && <span className="cmp-stat-na">DATA NOT AVAILABLE</span>}
        </div>
    );
}
