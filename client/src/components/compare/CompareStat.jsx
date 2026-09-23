import useInViewOnce from "../../hooks/useInViewOnce";
import AnimatedNumber from "../entity/AnimatedNumber";

function better(a, b, lowerIsBetter) {
    const n1 = parseFloat(a);
    const n2 = parseFloat(b);
    if (Number.isNaN(n1) || Number.isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "a" : "b";
    return n1 > n2 ? "a" : "b";
}

/*
 * Neutral side-by-side reading of one metric — for values where a
 * proportional bar would mislead (championship position, average
 * finish/qualifying position: a smaller number is stronger, not a
 * shorter bar). No colour, no "winner" label — only a subtle weight
 * shift on the stronger figure, exactly the underlying value either way.
 */
export default function CompareStat({ label, prefix = "", valueA, valueB, lowerIsBetter = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const lead = better(valueA, valueB, lowerIsBetter);
    const hasA = valueA !== null && valueA !== undefined;
    const hasB = valueB !== null && valueB !== undefined;

    return (
        <div ref={ref} className="cmp-stat">
            <span className="cmp-stat-label">{label}</span>
            <div className="cmp-stat-row">
                <span className={`cmp-stat-val${lead === "a" ? " is-lead" : ""}`}>
                    {hasA ? <>{prefix}<AnimatedNumber value={valueA} play={inView} /></> : "—"}
                </span>
                <span className="cmp-stat-rule" aria-hidden="true" />
                <span className={`cmp-stat-val cmp-stat-val--right${lead === "b" ? " is-lead" : ""}`}>
                    {hasB ? <>{prefix}<AnimatedNumber value={valueB} play={inView} /></> : "—"}
                </span>
            </div>
            {!hasA && !hasB && <span className="cmp-stat-na">DATA NOT AVAILABLE</span>}
        </div>
    );
}
