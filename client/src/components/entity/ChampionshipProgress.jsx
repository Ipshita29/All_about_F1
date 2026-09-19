/*
 * Thin horizontal bar, proportional to real points — no invented
 * percentages. `value` / `max` are both already-real standings numbers.
 */
export default function ChampionshipProgress({ value, max }) {
    const numeric = Number(value);
    const leaderPts = Number(max);
    if (!leaderPts || Number.isNaN(numeric)) return null;
    const pct = Math.max(2, Math.min(100, (numeric / leaderPts) * 100));

    return (
        <span className="cprog" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
        </span>
    );
}
