import { useState, useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";
import { SearchControls, ConstructorRoster, ConstructorCard } from "../components/EntityListing";
import { LoadingSpinner, Stat, Button, EmptyState } from "../components/UI";
import { CompareModal } from "../components/Compare";
import teamInfo from "../data/teamInfo";
import { getTeamAssets } from "../config/teamAssets";
import "../styles/pages/EntityPages.css";
import "../styles/pages/Comparison.css";
import { API_BASE_URL as API } from "../config/api";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE CONSTRUCTORS — the paddock, not a copy of the Drivers grid. A light
 * Cararra hero (the inverse of the Drivers page's dark one) → a dark
 * championship overview → the team grid. No car photography (none of
 * the available sources are consistent or high-quality enough — see
 * config/teamAssets.js); each card leans on the team's real logo and
 * its actual standings instead. "Compare Teams" next to the search bar
 * opens a compact head-to-head modal in place — no separate comparison
 * page.
 */
function Teams() {
    const [teams, setTeams] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [standings, setStandings] = useState([]);
    const [driverStandings, setDriverStandings] = useState([]);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");
    const [compareOpen, setCompareOpen] = useState(false);
    const loaded = loadedYear === year;

    /* The six metrics the Compare Teams modal shows — reuses this page's
       own already-fetched standings (position/points/wins-this-season)
       plus the shared teamInfo career data (championships/founded).
       Team podiums have no data source anywhere in the app, so that
       metric honestly shows as unavailable rather than a guess. */
    const teamCompareMetrics = (team) => {
        const s = standings.find((s) => s.Constructor.constructorId === team.constructorId);
        const info = teamInfo[team.constructorId];
        return {
            position: s?.position,
            points: s?.points,
            wins: s?.wins,
            podiums: undefined,
            championships: info?.championships,
            debut: info?.founded,
        };
    };

    /* The Compare Teams identity card: team accent colour and logo —
       teams have no racing number, so the card leans entirely on the
       logo (or a three-letter monogram when none resolves). */
    const teamCompareVisual = (team) => {
        const assets = getTeamAssets(team.constructorId);
        return {
            accent: assets.accent,
            number: null,
            imageCandidates: assets.logo ? [assets.logo] : [],
            monogram: team.name.slice(0, 3).toUpperCase(),
        };
    };

    useEffect(() => {
        fetch(`${API}/teams/${year}`)
            .then((res) => res.json())
            .then((data) => {
                setTeams(Array.isArray(data) ? data : []);
                setLoadedYear(year);
            });
    }, [year]);

    useEffect(() => {
        fetch(`${API}/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(Array.isArray(data) ? data : []))
            .catch(() => setStandings([]));
    }, [year]);

    useEffect(() => {
        fetch(`${API}/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, [year]);

    const filtered = teams.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const positionOf = (t) => {
        const s = standings.find((s) => s.Constructor.constructorId === t.constructorId);
        return s ? Number(s.position) : 99;
    };
    const ordered = [...filtered].sort((a, b) => positionOf(a) - positionOf(b));
    const leaderPts = standings[0]?.points;
    const totalPoints = standings.reduce((sum, s) => sum + Number(s.points || 0), 0);

    return (
        <div className="ex">
            <header className="dr-hero dr-hero--on-light">
                <span className="dr-hero-year">{year} CONSTRUCTORS</span>
                <h1 className="dr-hero-title">The Teams</h1>
                <p className="dr-hero-sub">Ten teams. One championship.</p>
            </header>

            <div className="gr-overview gr-overview--dark">
                <div className="gr-overview-inner">
                    <div className="stat-row">
                        <Stat value={loaded ? teams.length : "10"} label="Teams" />
                        <Stat value={standings[0]?.Constructor?.name ?? "—"} label="Current Leader" accent />
                        <Stat value={totalPoints || "—"} label="Total Championship Points" />
                    </div>
                    <SearchControls
                        year={year}
                        years={YEARS}
                        onYearChange={setYear}
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="SEARCH TEAMS"
                        count={`${filtered.length} TEAMS`}
                    >
                        <Button variant="primary" size="sm" onClick={() => setCompareOpen(true)}>
                            <ArrowLeftRight size={14} aria-hidden="true" /> Compare Teams
                        </Button>
                    </SearchControls>
                </div>
            </div>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : ordered.length === 0 ? (
                <main className="ex-main">
                    <EmptyState
                        title="No team matches"
                        description="Adjust the season or search to find who you're looking for."
                    />
                </main>
            ) : (
                <main className="ex-main">
                    <ConstructorRoster>
                        {ordered.map((t) => {
                            const standing = standings.find(
                                (s) => s.Constructor.constructorId === t.constructorId
                            );
                            const drivers = driverStandings.filter(
                                (d) => d.Constructors?.[0]?.constructorId === t.constructorId
                            );
                            return (
                                <ConstructorCard
                                    key={t.constructorId}
                                    team={t}
                                    standing={standing}
                                    drivers={drivers}
                                    year={year}
                                    leaderPts={leaderPts}
                                />
                            );
                        })}
                    </ConstructorRoster>
                </main>
            )}

            <CompareModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                title="Compare Teams"
                entityLabel="Team"
                searchPlaceholder="Search constructors…"
                options={teams}
                getId={(t) => t.constructorId}
                getLabel={(t) => t.name}
                getSubLabel={(t) => t.nationality}
                getMetrics={teamCompareMetrics}
                getVisual={teamCompareVisual}
                debutLabel="First Season"
            />
        </div>
    );
}

export default Teams;
