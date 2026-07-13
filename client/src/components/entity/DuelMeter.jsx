import useInViewOnce from "../../hooks/useInViewOnce";
import AnimatedNumber from "./AnimatedNumber";

function winnerOf(val1, val2, lowerIsBetter) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    if (Number.isNaN(n1) || Number.isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "left" : "right";
    return n1 > n2 ? "left" : "right";
}

/*
 * Head-to-head telemetry meter used by Wheel to Wheel and Constructor
 * Battle. Two segmented bars grow outward from the centre spine toward each
 * side while the values count up; the stronger side carries the accent.
 * Reads like a data channel on a pit wall screen, not a spreadsheet bar.
 */
function DuelMeter({ label, val1, val2, lowerIsBetter = false, accent1, accent2, children }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.5 });

    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    const valid = !Number.isNaN(n1) && !Number.isNaN(n2) && n1 + n2 > 0;
    let share1 = 0.5;
    if (valid) {
        share1 = lowerIsBetter ? n2 / (n1 + n2) : n1 / (n1 + n2);
    }
    const winner = winnerOf(val1, val2, lowerIsBetter);

    return (
        <div ref={ref} className={`ex-duel${inView ? " is-inview" : ""}`}>
            <div className="ex-duel-vals">
                <span className={`ex-duel-val${winner === "left" ? " is-ahead" : ""}${winner === "right" ? " is-behind" : ""}`}>
                    {val1 == null ? "—" : <AnimatedNumber value={val1} play={inView} />}
                </span>
                <span className="ex-duel-label">{children || label}</span>
                <span className={`ex-duel-val ex-duel-val--right${winner === "right" ? " is-ahead" : ""}${winner === "left" ? " is-behind" : ""}`}>
                    {val2 == null ? "—" : <AnimatedNumber value={val2} play={inView} />}
                </span>
            </div>
            <div className="ex-duel-track" aria-hidden="true">
                <span
                    className="ex-duel-fill ex-duel-fill--left"
                    style={{
                        width: inView && valid ? `${share1 * 50}%` : 0,
                        "--duel-accent": accent1,
                    }}
                />
                <span className="ex-duel-spine" />
                <span
                    className="ex-duel-fill ex-duel-fill--right"
                    style={{
                        width: inView && valid ? `${(1 - share1) * 50}%` : 0,
                        "--duel-accent": accent2,
                    }}
                />
            </div>
        </div>
    );
}

export default DuelMeter;
