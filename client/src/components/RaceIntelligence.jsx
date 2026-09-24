/*
 * RACE INTELLIGENCE — a data-grounded recap of the last Grand Prix, on a
 * light Chalk surface for an editorial, print-like read.
 *
 * Each stat is LABEL → full driver name → supporting value, stacked
 * vertically so the relationship is unambiguous at a glance — never a
 * value with a "· DRIVER" suffix tacked onto its label.
 *
 * There is no AI/LLM backend wired into this project (no key configured,
 * no route implemented), so rather than fabricate prose and pass it off as
 * an "AI summary", this reads as an editorial brief built entirely from the
 * real classification already returned by /grandprixdashboard/latest:
 * winner, winning margin, fastest lap, and the biggest mover from the grid.
 */
import SectionHeader from "./SectionHeader";
import Button from "./Button";
import { positionsGained } from "../utils/landingHelpers";

function fullName(driver) {
    if (!driver) return "—";
    return `${driver.givenName} ${driver.familyName}`;
}

export default function RaceIntelligence({ race }) {
    if (!race) return null;

    const results = race.Results || [];
    const winner = results[0];
    const second = results[1];
    if (!winner) return null;

    const fastest = results.find((r) => r.FastestLap?.rank === "1");
    const gapText = second
        ? second.Time?.time || second.status || null
        : null;

    const mover = results.reduce((best, r) => {
        const gain = positionsGained(r);
        if (gain === null) return best;
        if (!best || gain > positionsGained(best)) return r;
        return best;
    }, null);
    const moverGain = mover ? positionsGained(mover) : 0;

    const startedText =
        winner.grid === "1" ? "from pole position" : `from P${winner.grid}`;

    /* Every stat is { label, name?, value }. `name` (when present) is the
       driver's full name, always shown on its own line above the value. */
    const stats = [
        { label: "Winner", name: fullName(winner.Driver) },
        gapText && { label: "Winning Gap", value: gapText },
        fastest && { label: "Fastest Lap", name: fullName(fastest.Driver), value: fastest.FastestLap.Time.time },
        mover && moverGain > 0 && { label: "Biggest Mover", name: fullName(mover.Driver), value: `+${moverGain} POSITIONS` },
    ].filter(Boolean);

    return (
        <section className="ri" aria-label="Race intelligence">
            <div className="ri-inner">
                <SectionHeader
                    onLight
                    eyebrow="RACE INTELLIGENCE"
                    title="What happened at the last Grand Prix"
                    className="ri-head"
                />
                <p className="ri-race">{race.raceName?.toUpperCase()} · ROUND {race.round}</p>

                <div className="ri-body">
                    <p className="ri-lede">
                        <b>{fullName(winner.Driver)}</b> won the {race.raceName} {startedText}
                        {gapText ? `, finishing ${gapText} clear of ${fullName(second?.Driver)}` : ""}.
                        {fastest && fastest.Driver.driverId !== winner.Driver.driverId && (
                            <> {fullName(fastest.Driver)} set the race&rsquo;s fastest lap.</>
                        )}
                        {mover && moverGain > 2 && (
                            <> {fullName(mover.Driver)} was the day&rsquo;s biggest mover, gaining {moverGain} places from the grid.</>
                        )}
                    </p>

                    <ul className="ri-stats">
                        {stats.map((s) => (
                            <li key={s.label} className="ri-stat">
                                <span className="ri-stat-label">{s.label}</span>
                                {s.name && <span className="ri-stat-name">{s.name}</span>}
                                {s.value && <span className="ri-stat-value">{s.value}</span>}
                            </li>
                        ))}
                    </ul>

                    <Button variant="dark" to={`/grandprixdashboard/${race.season}/${race.round}`} arrow>
                        Read Full Analysis
                    </Button>
                </div>
            </div>
        </section>
    );
}
