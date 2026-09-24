/*
 * Shared statistic display — a prominent mono value over a small
 * technical label, e.g.:
 *
 *   <Stat value={25} label="Winner Points" />
 *   <Stat value="+4.351" label="Winning Gap" accent />
 *
 * `onLight` switches the colour pairing for use inside a light Card.
 */
export default function Stat({ value, label, accent = false, onLight = false, className = "" }) {
    const classes = `stat${accent ? " stat--accent" : ""}${onLight ? " stat--on-light" : ""}${className ? ` ${className}` : ""}`;
    return (
        <div className={classes}>
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}
