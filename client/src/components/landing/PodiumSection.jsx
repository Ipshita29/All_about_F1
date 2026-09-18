/*
 * The Podium — latest Grand Prix top 3, told through typography and data
 * (position, name, team, points, grid delta), not photography. A custom,
 * keyboard-accessible race selector lets the visitor revisit any completed
 * round of the season.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
    driverInitials,
    getTeamColor,
    isFavouriteDriver,
    isFavouriteTeam,
    positionsGained,
} from "../../utils/landingHelpers";

/* ── Custom accessible race selector (listbox pattern) ── */
function RaceSelector({ options, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);

    const selectedIndex = options.findIndex((o) => o.key === value);
    const selected = options[selectedIndex];

    useEffect(() => {
        if (!open) return undefined;
        const onOutside = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", onOutside);
        return () => document.removeEventListener("pointerdown", onOutside);
    }, [open]);

    const openList = () => {
        setActiveIndex(Math.max(0, selectedIndex));
        setOpen(true);
    };

    const commit = (index) => {
        const opt = options[index];
        if (opt) onChange(opt.key);
        setOpen(false);
        buttonRef.current?.focus();
    };

    const onKeyDown = (e) => {
        if (!open) {
            if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
                e.preventDefault();
                openList();
            }
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "Home") {
            e.preventDefault();
            setActiveIndex(0);
        } else if (e.key === "End") {
            e.preventDefault();
            setActiveIndex(options.length - 1);
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            commit(activeIndex);
        }
    };

    return (
        <div className="lp-raceselect" ref={rootRef} onKeyDown={onKeyDown}>
            <button
                ref={buttonRef}
                type="button"
                className="lp-raceselect-btn"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Select a Grand Prix"
                onClick={() => (open ? setOpen(false) : openList())}
            >
                <span className="lp-raceselect-round">RD {selected?.round ?? "--"}</span>
                <span className="lp-raceselect-name">{selected?.label ?? "SELECT RACE"}</span>
                <ChevronDown size={14} aria-hidden="true" />
            </button>
            {open && (
                <ul
                    className="lp-raceselect-list"
                    role="listbox"
                    aria-label="Completed Grands Prix"
                    aria-activedescendant={`lp-raceopt-${activeIndex}`}
                    tabIndex={-1}
                >
                    {options.map((opt, i) => (
                        <li
                            key={opt.key}
                            id={`lp-raceopt-${i}`}
                            role="option"
                            aria-selected={opt.key === value}
                            className={`lp-raceselect-opt${i === activeIndex ? " is-active" : ""}${
                                opt.key === value ? " is-selected" : ""
                            }`}
                            onPointerEnter={() => setActiveIndex(i)}
                            onClick={() => commit(i)}
                        >
                            <span>RD {opt.round}</span> {opt.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function GainedIndicator({ result }) {
    const delta = positionsGained(result);
    if (delta === null) return null;
    if (delta === 0) return <span className="lp-podium-delta">— HELD POSITION</span>;
    return (
        <span
            className={`lp-podium-delta ${delta > 0 ? "is-up" : "is-down"}`}
            aria-label={`${Math.abs(delta)} positions ${delta > 0 ? "gained" : "lost"} from the starting grid`}
        >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} FROM GRID
        </span>
    );
}

const PODIUM_ORDER = [
    { index: 0, cls: "lp-podium-step--p1" },
    { index: 1, cls: "lp-podium-step--p2" },
    { index: 2, cls: "lp-podium-step--p3" },
];

export default function PodiumSection({ completedRaces, latestRace, favs }) {
    const options = completedRaces.map((race) => ({
        key: `${race.season}-${race.round}`,
        round: race.round,
        season: race.season,
        label: race.raceName,
    }));
    if (
        latestRace &&
        !options.some((o) => o.key === `${latestRace.season}-${latestRace.round}`)
    ) {
        options.unshift({
            key: `${latestRace.season}-${latestRace.round}`,
            round: latestRace.round,
            season: latestRace.season,
            label: latestRace.raceName,
        });
    }

    const latestKey = latestRace ? `${latestRace.season}-${latestRace.round}` : null;
    const defaultKey = latestKey || options[0]?.key || null;

    const [selectedKey, setSelectedKey] = useState(null);
    const [fetched, setFetched] = useState({});

    const activeKey = selectedKey || defaultKey;

    let results = null;
    let status = "loading";
    if (!activeKey) {
        status = "empty";
    } else if (activeKey === latestKey && latestRace?.Results?.length >= 3) {
        results = latestRace.Results;
        status = "ready";
    } else if (fetched[activeKey]) {
        results = fetched[activeKey].data || null;
        status = fetched[activeKey].status;
    }

    useEffect(() => {
        if (!activeKey || status !== "loading") return undefined;
        const [year, round] = activeKey.split("-");
        let cancelled = false;
        fetch(`http://localhost:3000/grandprixdashboard/results/${year}/${round}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                const entry =
                    Array.isArray(data) && data.length >= 3
                        ? { status: "ready", data }
                        : { status: "empty" };
                setFetched((prev) => ({ ...prev, [activeKey]: entry }));
            })
            .catch(() => {
                if (!cancelled) {
                    setFetched((prev) => ({ ...prev, [activeKey]: { status: "error" } }));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [activeKey, status]);

    if (!options.length) return null;

    const selectedOption = options.find((o) => o.key === activeKey);
    const podium = status === "ready" && results ? results.slice(0, 3) : null;

    return (
        <section className="lp-section lp-podium" aria-label="Grand Prix podium">
            <header className="lp-section-head lp-podium-head">
                <div>
                    <span className="lp-section-eyebrow">FINAL CLASSIFICATION — TOP 3</span>
                    <h2 className="lp-section-title">The Podium</h2>
                </div>
                <RaceSelector options={options} value={activeKey} onChange={setSelectedKey} />
            </header>

            {status === "loading" && <p className="lp-inline-state">LOADING CLASSIFICATION…</p>}
            {status === "error" && (
                <p className="lp-inline-state">RESULTS UNAVAILABLE — COULD NOT REACH THE TIMING SERVER</p>
            )}
            {status === "empty" && (
                <p className="lp-inline-state">
                    NO CLASSIFICATION PUBLISHED FOR {selectedOption?.label?.toUpperCase()} YET
                </p>
            )}

            {podium && (
                <div className="lp-podium-steps">
                    {PODIUM_ORDER.map(({ index, cls }) => {
                        const r = podium[index];
                        if (!r) return null;
                        const fav =
                            isFavouriteDriver(favs, r.Driver) ||
                            isFavouriteTeam(favs, r.Constructor);
                        const teamColor = getTeamColor(r.Constructor?.constructorId);
                        return (
                            <article
                                key={r.Driver.driverId}
                                className={`lp-podium-step ${cls}${fav ? " lp-podium-step--fav" : ""}`}
                                style={teamColor ? { "--team-color": teamColor } : undefined}
                            >
                                <span className="lp-podium-pos">{r.position}</span>
                                <span className="lp-podium-monogram" aria-hidden="true">
                                    {driverInitials(r.Driver.givenName, r.Driver.familyName)}
                                </span>
                                <div className="lp-podium-info">
                                    <h3 className="lp-podium-name">
                                        {r.Driver.givenName} <b>{r.Driver.familyName?.toUpperCase()}</b>
                                    </h3>
                                    <p className="lp-podium-teamline">
                                        <i
                                            className="lp-podium-teamstrip"
                                            style={teamColor ? { background: teamColor } : undefined}
                                            aria-hidden="true"
                                        />
                                        {r.Constructor?.name}
                                        <span className="lp-podium-number">
                                            #{r.number || r.Driver.permanentNumber || "--"}
                                        </span>
                                    </p>
                                    <p className="lp-podium-points">+{r.points} PTS</p>
                                    <GainedIndicator result={r} />
                                    {fav && <span className="lp-podium-favtag">YOUR PICK</span>}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
