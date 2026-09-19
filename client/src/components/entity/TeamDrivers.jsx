import { Link } from "react-router-dom";

/* The two drivers currently seated for a constructor, by number — the
 * explicit link back into the Drivers roster the brief for both pages
 * asked for. */
export default function TeamDrivers({ drivers, year }) {
    if (!drivers?.length) return <span className="td-empty">—</span>;
    return (
        <div className="td">
            {drivers.map((d) => (
                <Link
                    key={d.Driver.driverId}
                    to={`/drivers/${year}/${d.Driver.driverId}`}
                    className="td-item"
                >
                    <span className="td-num">{d.Driver.permanentNumber ?? "—"}</span>
                    <span className="td-name">{d.Driver.familyName}</span>
                </Link>
            ))}
        </div>
    );
}
