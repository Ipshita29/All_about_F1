/*
 * Shared control strip for the Drivers and Constructors index pages —
 * season, search and a count, laid out as one editorial line with
 * underlines instead of boxed form controls.
 */
export default function SearchControls({
    year,
    years,
    onYearChange,
    search,
    onSearchChange,
    searchPlaceholder,
    count,
    onLight = false,
    children,
}) {
    return (
        <div className={`sc${onLight ? " sc--on-light" : ""}`}>
            {years && (
                <label className="sc-field sc-field--year">
                    <span className="sc-label">SEASON</span>
                    <select value={year} onChange={(e) => onYearChange(e.target.value)}>
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </label>
            )}

            <label className="sc-field sc-field--search">
                <span className="sc-label">{searchPlaceholder}</span>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Type to filter…"
                />
            </label>

            <span className="sc-count">{count}</span>

            {children}
        </div>
    );
}
