/*
 * Latest Grand Prix podium (P3 — P1 — P2) with a custom, keyboard-accessible
 * race selector to revisit any completed round of the season.
 *
 * Portraits support a second, aligned helmet/race-suit image
 * (/drivers/helmets/<file>, see ASSETS_REQUIRED.md). On desktop hover only a
 * soft circular area around the cursor reveals the helmet layer (CSS mask
 * driven by --px/--py custom properties). On touch, tapping the portrait
 * toggles the full alternate image. If the helmet asset is missing the
 * portrait silently falls back to a plain image with a rim-light hover.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
    driverInitials,
    getHelmetPortrait,
    getLocalDriverPortrait,
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
                <span className="lp-raceselect-round lp-mono">
                    RD {selected?.round ?? "--"}
                </span>
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
                            <span className="lp-mono">RD {opt.round}</span> {opt.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ── Dual-image portrait with cursor mask reveal ── */
function PodiumPortrait({ result }) {
    const fullName = `${result.Driver.givenName} ${result.Driver.familyName}`;
    const portrait = getLocalDriverPortrait(fullName);
    const helmetSrc = portrait ? getHelmetPortrait(fullName) : null;
    const [helmetOk, setHelmetOk] = useState(false);
    const [swapped, setSwapped] = useState(false);
    const wrapRef = useRef(null);
    const frameRef = useRef(0);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    const onMove = (e) => {
        if (!helmetOk || !wrapRef.current || (e.pointerType && e.pointerType !== "mouse")) return;
        const rect = wrapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() => {
            wrapRef.current?.style.setProperty("--px", `${x.toFixed(2)}%`);
            wrapRef.current?.style.setProperty("--py", `${y.toFixed(2)}%`);
        });
    };

    const onTap = (e) => {
        if (!helmetOk || (e.pointerType && e.pointerType === "mouse")) return;
        setSwapped((s) => !s);
    };

    if (!portrait) {
        return (
            <div className="lp-podium-portrait lp-podium-portrait--fallback" aria-hidden="true">
                <span className="lp-podium-monogram">
                    {driverInitials(result.Driver.givenName, result.Driver.familyName)}
                </span>
            </div>
        );
    }

    return (
        <div
            ref={wrapRef}
            className={`lp-podium-portrait${helmetOk ? " has-helmet" : ""}${
                swapped ? " is-swapped" : ""
            }`}
            onPointerMove={onMove}
            onPointerUp={onTap}
        >
            <img className="lp-podium-img" src={portrait} alt={fullName} loading="lazy" />
            {helmetSrc && (
                <img
                    className="lp-podium-img lp-podium-img--helmet"
                    src={helmetSrc}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    onLoad={() => setHelmetOk(true)}
                    onError={(e) => {
                        setHelmetOk(false);
                        e.target.style.display = "none";
                    }}
                />
            )}
        </div>
    );
}

function GainedIndicator({ result }) {
    const delta = positionsGained(result);
    if (delta === null) return null;
    if (delta === 0) return <span className="lp-podium-delta lp-mono">— HELD POSITION</span>;
    return (
        <span
            className={`lp-podium-delta lp-mono ${delta > 0 ? "is-up" : "is-down"}`}
            aria-label={`${Math.abs(delta)} positions ${delta > 0 ? "gained" : "lost"} from the starting grid`}
        >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} FROM GRID
        </span>
    );
}

const PODIUM_ORDER = [
    { index: 2, cls: "lp-podium-step--p3" },
    { index: 0, cls: "lp-podium-step--p1" },
    { index: 1, cls: "lp-podium-step--p2" },
];

export default function PodiumSection({ completedRaces, latestRace, favs }) {
    const options = completedRaces.map((race) => ({
        key: `${race.season}-${race.round}`,
        round: race.round,
        season: race.season,
        label: race.raceName,
    }));
    /* If the newest finished race isn't in this season's list (e.g. season
       rollover), still offer it. */
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
    /* fetched races live in state so results are derived, not synced:
       { [key]: { status: "ready" | "empty" | "error", data?: Results[] } } */
    const [fetched, setFetched] = useState({});

    const activeKey = selectedKey || defaultKey;

    /* results for the active key, derived synchronously */
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
                    <h2 className="lp-section-title">THE PODIUM</h2>
                </div>
                <RaceSelector options={options} value={activeKey} onChange={setSelectedKey} />
            </header>

            {status === "loading" && (
                <p className="lp-inline-state lp-mono">LOADING CLASSIFICATION…</p>
            )}
            {status === "error" && (
                <p className="lp-inline-state lp-mono">
                    RESULTS UNAVAILABLE — COULD NOT REACH THE TIMING SERVER
                </p>
            )}
            {status === "empty" && (
                <p className="lp-inline-state lp-mono">
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
                                <span className="lp-podium-pos" aria-hidden="true">
                                    {r.position}
                                </span>
                                <PodiumPortrait result={r} />
                                <div className="lp-podium-info">
                                    <span className="lp-podium-p lp-mono">P{r.position}</span>
                                    <h3 className="lp-podium-name">
                                        {r.Driver.givenName}{" "}
                                        <b>{r.Driver.familyName?.toUpperCase()}</b>
                                    </h3>
                                    <p className="lp-podium-teamline">
                                        <i
                                            className="lp-podium-teamstrip"
                                            style={teamColor ? { background: teamColor } : undefined}
                                            aria-hidden="true"
                                        />
                                        {r.Constructor?.name}
                                        <span className="lp-podium-number lp-mono">
                                            #{r.number || r.Driver.permanentNumber || "--"}
                                        </span>
                                    </p>
                                    <p className="lp-podium-points lp-mono">+{r.points} PTS</p>
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
