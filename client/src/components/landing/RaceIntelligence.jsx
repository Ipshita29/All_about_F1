/*
 * RACE INTELLIGENCE — a data-grounded recap of the last Grand Prix.
 *
 * There is no AI/LLM backend wired into this project (no key configured,
 * no route implemented), so rather than fabricate prose and pass it off as
 * an "AI summary", this reads as an editorial brief built entirely from the
 * real classification already returned by /grandprixdashboard/latest:
 * winning margin, fastest lap, and the biggest mover from the grid.
 */
import { Link } from "react-router-dom";
import { positionsGained } from "../../utils/landingHelpers";

function familyName(driver) {
    return driver?.familyName || "—";
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

    return (
        <section className="ri" aria-label="Race intelligence">
            <header className="ri-head">
                <span className="ri-eyebrow">RACE INTELLIGENCE</span>
                <h2 className="ri-title">What happened at the last Grand Prix</h2>
                <p className="ri-race">
                    {race.raceName?.toUpperCase()} · ROUND {race.round}
                </p>
            </header>

            <div className="ri-body">
                <p className="ri-lede">
                    <b>{familyName(winner.Driver)}</b> won the {race.raceName} {startedText}
                    {gapText ? `, finishing ${gapText} clear of ${familyName(second?.Driver)}` : ""}.
                    {fastest && fastest.Driver.driverId !== winner.Driver.driverId && (
                        <> {familyName(fastest.Driver)} set the race's fastest lap.</>
                    )}
                    {mover && moverGain > 2 && (
                        <> {familyName(mover.Driver)} was the day's biggest mover, gaining {moverGain} places from the grid.</>
                    )}
                </p>

                <div className="ri-numbers">
                    <div>
                        <b>{winner.points}</b>
                        <small>WINNER POINTS</small>
                    </div>
                    {gapText && (
                        <div>
                            <b>{gapText}</b>
                            <small>WINNING GAP</small>
                        </div>
                    )}
                    {fastest && (
                        <div>
                            <b>{fastest.FastestLap.Time.time}</b>
                            <small>FASTEST LAP · {familyName(fastest.Driver).toUpperCase()}</small>
                        </div>
                    )}
                    {mover && moverGain > 0 && (
                        <div>
                            <b>+{moverGain}</b>
                            <small>BIGGEST MOVER · {familyName(mover.Driver).toUpperCase()}</small>
                        </div>
                    )}
                </div>

                <Link
                    to={`/grandprixdashboard/${race.season}/${race.round}`}
                    className="lp-cta"
                >
                    READ FULL ANALYSIS <span aria-hidden="true">→</span>
                </Link>
            </div>
        </section>
    );
}
