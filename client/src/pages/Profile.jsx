/*
 * MY GARAGE — the account page as the user's personal corner of the paddock.
 *
 * The hero welcomes the user back under garage lights that switch on as the
 * page loads; below, their identity, favourite driver, favourite constructor,
 * learning telemetry and unlocked milestones are arranged as workstation
 * modules. Same /user/profile endpoint and driver/team links as before —
 * only the presentation changed.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { getProgress } from "../utils/dictionaryHelpers";
import { getTeamColor } from "../utils/landingHelpers";
import "./MyGarage.css";

const API = "http://localhost:3000";

const driverIdMap = {
    "Charles Leclerc": "leclerc",
    "Lewis Hamilton": "hamilton",
    "George Russell": "russell",
    "Kimi Antonelli": "antonelli",
    "Max Verstappen": "max_verstappen",
    "Yuki Tsunoda": "tsunoda",
    "Lando Norris": "norris",
    "Oscar Piastri": "piastri",
    "Fernando Alonso": "alonso",
    "Lance Stroll": "stroll",
    "Pierre Gasly": "gasly",
    "Franco Colapinto": "colapinto",
    "Esteban Ocon": "ocon",
    "Oliver Bearman": "bearman",
    "Liam Lawson": "lawson",
    "Isack Hadjar": "hadjar",
    "Carlos Sainz": "sainz",
    "Alexander Albon": "albon",
    "Nico Hulkenberg": "hulkenberg",
    "Gabriel Bortoleto": "bortoleto",
};

const teamIdMap = {
    "Ferrari": "ferrari",
    "Red Bull": "red_bull",
    "McLaren": "mclaren",
    "Mercedes": "mercedes",
    "Aston Martin": "aston_martin",
    "Alpine": "alpine",
    "Williams": "williams",
    "RB": "rb",
    "Haas": "haas",
    "Sauber": "sauber",
    "Kick Sauber": "sauber",
};

/* a short telemetry trace that draws itself when the garage lights up */
function TelemetryLine() {
    return (
        <svg viewBox="0 0 600 40" className="mg-telemetry" aria-hidden="true" preserveAspectRatio="none">
            <polyline
                className="mg-telemetry-trace"
                points="0,32 60,32 90,10 130,10 150,26 210,26 240,6 300,6 330,30 390,30 420,14 480,14 510,28 600,28"
                fill="none"
                strokeWidth="2"
            />
        </svg>
    );
}

function Milestone({ unlocked, title, detail }) {
    return (
        <li className={`mg-milestone${unlocked ? " mg-milestone--unlocked" : ""}`}>
            <span className="mg-milestone-lamp" aria-hidden="true" />
            <div>
                <span className="mg-milestone-title">{title}</span>
                <span className="mg-milestone-detail mg-mono">{detail}</span>
            </div>
            <span className="mg-milestone-state mg-mono">{unlocked ? "UNLOCKED" : "LOCKED"}</span>
        </li>
    );
}

function Profile() {
    const [user, setUser] = useState(null);
    const [lit, setLit] = useState(false);
    const [progress] = useState(getProgress());

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API}/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setUser(data));
    }, []);

    /* garage lights switch on once the page has content */
    useEffect(() => {
        if (!user) return undefined;
        const t = setTimeout(() => setLit(true), 150);
        return () => clearTimeout(t);
    }, [user]);

    if (!user) return <div className="mg mg-loading"><LoadingSpinner /></div>;

    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    const firstName = user.name?.split(" ")[0] || "Racer";

    const driverId =
        driverIdMap[user.favoriteDriver] ||
        user.favoriteDriver?.toLowerCase().replaceAll(" ", "_");

    const teamId =
        teamIdMap[user.favoriteTeam] ||
        user.favoriteTeam?.toLowerCase().replaceAll(" ", "_");

    const teamColor = getTeamColor(teamId) || "#7f1d1a";

    const learnedPct = progress.total > 0
        ? Math.min(100, Math.round((progress.visited / progress.total) * 100))
        : 0;

    const hasPicks = Boolean(user.favoriteTeam && user.favoriteDriver);

    return (
        <div className={`mg${lit ? " mg--lit" : ""}`}>
            {/* ── Hero: back into the garage ────────────────────────── */}
            <header className="mg-hero">
                <div className="mg-hero-lights" aria-hidden="true">
                    <span /><span /><span />
                </div>

                <span className="mg-hero-eyebrow mg-mono">PERSONAL PADDOCK · ALL ACCESS</span>
                <h1 className="mg-hero-title">MY GARAGE</h1>
                <p className="mg-hero-sub mg-mono">
                    WELCOME BACK, {firstName.toUpperCase()} — THE LIGHTS ARE ON
                </p>

                <TelemetryLine />
            </header>

            <main className="mg-main">
                <div className="mg-grid">
                    {/* ── Identity plate ────────────────────────────── */}
                    <section className="mg-module mg-module--identity" aria-label="Account">
                        <span className="mg-module-label mg-mono">DRIVER ID PLATE</span>
                        <div className="mg-identity">
                            <span className="mg-avatar" aria-hidden="true">{initials}</span>
                            <div className="mg-identity-copy">
                                <h2 className="mg-identity-name">{user.name}</h2>
                                <p className="mg-identity-mail mg-mono">{user.email}</p>
                            </div>
                        </div>
                        <dl className="mg-idrows">
                            <div className="mg-idrow">
                                <dt className="mg-mono">NAME</dt>
                                <dd>{user.name}</dd>
                            </div>
                            <div className="mg-idrow">
                                <dt className="mg-mono">EMAIL</dt>
                                <dd>{user.email}</dd>
                            </div>
                            <div className="mg-idrow">
                                <dt className="mg-mono">FAVOURITE TEAM</dt>
                                <dd>{user.favoriteTeam || "—"}</dd>
                            </div>
                            <div className="mg-idrow">
                                <dt className="mg-mono">FAVOURITE DRIVER</dt>
                                <dd>{user.favoriteDriver || "—"}</dd>
                            </div>
                        </dl>
                        <Link to="/preferences" className="mg-cta">
                            TUNE YOUR SETUP <span aria-hidden="true">→</span>
                        </Link>
                    </section>

                    {/* ── Favourite driver workstation ──────────────── */}
                    <section className="mg-module mg-module--driver" aria-label="Favourite driver">
                        <span className="mg-module-label mg-mono">WORKSTATION 01 — DRIVER</span>
                        {user.favoriteDriver ? (
                            <>
                                <span className="mg-big-pick">{user.favoriteDriver}</span>
                                <span className="mg-pick-sub mg-mono">YOUR DRIVER OF CHOICE</span>
                                <Link to={`/drivers/2026/${driverId}`} className="mg-cta" viewTransition>
                                    OPEN DRIVER DOSSIER <span aria-hidden="true">→</span>
                                </Link>
                            </>
                        ) : (
                            <>
                                <span className="mg-big-pick mg-big-pick--empty">SEAT OPEN</span>
                                <span className="mg-pick-sub mg-mono">NO DRIVER SELECTED YET</span>
                                <Link to="/preferences" className="mg-cta">
                                    PICK YOUR DRIVER <span aria-hidden="true">→</span>
                                </Link>
                            </>
                        )}
                    </section>

                    {/* ── Favourite constructor bay ─────────────────── */}
                    <section
                        className="mg-module mg-module--team"
                        style={{ "--mg-team": teamColor }}
                        aria-label="Favourite constructor"
                    >
                        <span className="mg-module-label mg-mono">WORKSTATION 02 — CONSTRUCTOR</span>
                        {user.favoriteTeam ? (
                            <>
                                <span className="mg-big-pick">{user.favoriteTeam}</span>
                                <span className="mg-pick-sub mg-mono">YOUR GARAGE COLOURS</span>
                                <Link to={`/teams/2026/${teamId}`} className="mg-cta" viewTransition>
                                    ENTER THE GARAGE <span aria-hidden="true">→</span>
                                </Link>
                            </>
                        ) : (
                            <>
                                <span className="mg-big-pick mg-big-pick--empty">BAY EMPTY</span>
                                <span className="mg-pick-sub mg-mono">NO CONSTRUCTOR SELECTED YET</span>
                                <Link to="/preferences" className="mg-cta">
                                    PICK YOUR TEAM <span aria-hidden="true">→</span>
                                </Link>
                            </>
                        )}
                    </section>

                    {/* ── Learning telemetry ────────────────────────── */}
                    <section className="mg-module mg-module--learning" aria-label="Learning progress">
                        <span className="mg-module-label mg-mono">PIT WALL BRIEFING — TELEMETRY</span>
                        <div className="mg-learn-readout">
                            <span className="mg-learn-count">
                                {progress.visited}
                                <small>/ {progress.total}</small>
                            </span>
                            <span className="mg-pick-sub mg-mono">CONCEPTS STUDIED</span>
                        </div>
                        <div className="mg-progress-track">
                            <div className="mg-progress-fill" style={{ width: `${learnedPct}%` }} />
                        </div>
                        <Link to="/dictionary" className="mg-cta">
                            CONTINUE THE BRIEFING <span aria-hidden="true">→</span>
                        </Link>
                    </section>

                    {/* ── Milestones ────────────────────────────────── */}
                    <section className="mg-module mg-module--milestones" aria-label="Milestones">
                        <span className="mg-module-label mg-mono">CAREER MILESTONES</span>
                        <ul className="mg-milestones">
                            <Milestone
                                unlocked
                                title="Joined The Grid"
                                detail="ACCOUNT CREATED — YOU'RE ON THE TIMING SCREENS"
                            />
                            <Milestone
                                unlocked={hasPicks}
                                title="Picked A Side"
                                detail={hasPicks ? "DRIVER + CONSTRUCTOR CHOSEN" : "CHOOSE A DRIVER AND A CONSTRUCTOR"}
                            />
                            <Milestone
                                unlocked={progress.visited >= 1}
                                title="First Briefing"
                                detail={progress.visited >= 1 ? "FIRST CONCEPT STUDIED" : "OPEN ANY PIT WALL BRIEFING FILE"}
                            />
                            <Milestone
                                unlocked={progress.visited >= 10}
                                title="Student Of The Sport"
                                detail={`${Math.min(progress.visited, 10)} / 10 CONCEPTS STUDIED`}
                            />
                            <Milestone
                                unlocked={progress.visited >= 25}
                                title="Pit Wall Material"
                                detail={`${Math.min(progress.visited, 25)} / 25 CONCEPTS STUDIED`}
                            />
                        </ul>
                    </section>

                    {/* ── Quick access ──────────────────────────────── */}
                    <section className="mg-module mg-module--shortcuts" aria-label="Quick access">
                        <span className="mg-module-label mg-mono">GARAGE EXITS</span>
                        <nav className="mg-shortcuts">
                            <Link to="/grandprixdashboard" className="mg-shortcut">
                                <span className="mg-shortcut-num mg-mono">01</span>
                                <span>Race Weekend</span>
                            </Link>
                            <Link to="/news" className="mg-shortcut">
                                <span className="mg-shortcut-num mg-mono">02</span>
                                <span>From The Paddock</span>
                            </Link>
                            <Link to="/dictionary" className="mg-shortcut">
                                <span className="mg-shortcut-num mg-mono">03</span>
                                <span>Pit Wall Briefing</span>
                            </Link>
                            <Link to="/compare-drivers" className="mg-shortcut">
                                <span className="mg-shortcut-num mg-mono">04</span>
                                <span>Wheel To Wheel</span>
                            </Link>
                        </nav>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default Profile;
