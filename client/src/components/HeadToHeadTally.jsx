/*
 * The closing statistical summary — directly counted from round-by-round
 * results, never a subjective "overall winner". Ties are shown as their
 * own real number rather than being forced onto one side.
 */
export default function HeadToHeadTally({ label, unit, a, b, ties }) {
    return (
        <div className="cmp-h2h-row">
            <span className="cmp-h2h-label">{label}</span>
            <div className="cmp-h2h-cols">
                <div className="cmp-h2h-col">
                    <span className="cmp-h2h-name">{a.name}</span>
                    <span className="cmp-h2h-count">{a.count} {unit}</span>
                </div>
                <div className="cmp-h2h-col cmp-h2h-col--b">
                    <span className="cmp-h2h-name">{b.name}</span>
                    <span className="cmp-h2h-count">{b.count} {unit}</span>
                </div>
            </div>
            {ties > 0 && <span className="cmp-h2h-ties">{ties} equal result{ties === 1 ? "" : "s"}</span>}
        </div>
    );
}
