import LoadingSpinner from "./LoadingSpinner";

/*
 * Round-by-round comparison timeline shared by Driver and Team comparison —
 * a vertical, scannable list rather than a wide table, so it collapses
 * cleanly on mobile. Each page supplies its own per-round cell content
 * (a single finishing position for a driver, two for a constructor).
 */
export default function RaceTimeline({ rows, loading, error, labelA, labelB }) {
    if (loading) {
        return (
            <div className="cmp-timeline-loading">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return <p className="cmp-stat-na">DATA NOT AVAILABLE</p>;
    }

    if (!rows.length) {
        return <p className="cmp-stat-na">NO ROUNDS COMPLETED YET THIS SEASON</p>;
    }

    return (
        <ol className="cmp-timeline">
            {rows.map((row) => (
                <li key={row.round} className="cmp-timeline-row">
                    <div className="cmp-timeline-round">
                        <span className="cmp-timeline-num">ROUND {String(row.round).padStart(2, "0")}</span>
                        <span className="cmp-timeline-name">{row.raceName}</span>
                    </div>
                    <div className="cmp-timeline-results">
                        <div className="cmp-timeline-cell">
                            <span className="cmp-timeline-who">{labelA}</span>
                            <span className="cmp-timeline-pos">{row.a}</span>
                        </div>
                        <div className="cmp-timeline-cell cmp-timeline-cell--b">
                            <span className="cmp-timeline-who">{labelB}</span>
                            <span className="cmp-timeline-pos">{row.b}</span>
                        </div>
                    </div>
                </li>
            ))}
        </ol>
    );
}
