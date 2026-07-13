import useInViewOnce from "../../hooks/useInViewOnce";
import AnimatedNumber from "./AnimatedNumber";

/*
 * A single telemetry readout: oversized condensed value that counts up when
 * scrolled into view, a mono label underneath, and an optional kerb-tick
 * meter (`meter` = 0..1) for visual weight. Used across detail pages.
 */
function TelemetryStat({ value, label, sub, meter = null, accent = false }) {
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

export default TelemetryStat;
