import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "../components/UI";
import { getProgress } from "../utils/dictionaryHelpers";
import { getTeamColor, DRIVER_ID_MAP, FAV_TEAM_TO_CONSTRUCTOR_ID } from "../utils/landingHelpers";
import "../styles/pages/MyGarage.css";
import { API_BASE_URL as API } from "../config/api";


const DRIVERS = Object.keys(DRIVER_ID_MAP).filter((name) => name !== "Andrea Kimi Antonelli");

const TEAMS = [
    ["Ferrari", "Scuderia Ferrari HP"],
    ["Mercedes", "Mercedes-AMG PETRONAS F1 Team"],
    ["Red Bull", "Oracle Red Bull Racing"],
    ["McLaren", "McLaren Formula 1 Team"],
    ["Aston Martin", "Aston Martin Aramco Formula One Team"],
    ["Alpine", "BWT Alpine Formula One Team"],
    ["Haas", "MoneyGram Haas F1 Team"],
    ["Racing Bulls", "Visa Cash App Racing Bulls F1 Team"],
    ["Williams", "Atlassian Williams Racing"],
    ["Sauber", "Stake F1 Team Kick Sauber"],
    ["Cadillac", "Cadillac Formula 1 Team"],
];

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

    const [editingIdentity, setEditingIdentity] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [identityError, setIdentityError] = useState("");
    const [savingIdentity, setSavingIdentity] = useState(false);

    const [editingDriver, setEditingDriver] = useState(false);
    const [driverInput, setDriverInput] = useState("");
    const [savingDriver, setSavingDriver] = useState(false);

    const [editingTeam, setEditingTeam] = useState(false);
    const [teamInput, setTeamInput] = useState("");
    const [savingTeam, setSavingTeam] = useState(false);

    const loadProfile = () => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API}/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setUser(data));
    };

    useEffect(loadProfile, []);

    /* garage lights switch on once the page has content */
    useEffect(() => {
        if (!user) return undefined;
        const t = setTimeout(() => setLit(true), 150);
        return () => clearTimeout(t);
    }, [user]);

    if (!user) return <div className="mg mg-loading"><LoadingSpinner /></div>;

    const savePatch = async (patch) => {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/user/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Could not save. Try again.");
        }
        setUser(data);
        return data;
    };

    const startEditIdentity = () => {
        setNameInput(user.name || "");
        setEmailInput(user.email || "");
        setIdentityError("");
        setEditingIdentity(true);
    };

    const saveIdentity = async () => {
        setIdentityError("");
        setSavingIdentity(true);
        try {
            await savePatch({ name: nameInput, email: emailInput });
            setEditingIdentity(false);
        } catch (e) {
            setIdentityError(e.message);
        } finally {
            setSavingIdentity(false);
        }
    };

    const startEditDriver = () => {
        setDriverInput(user.favoriteDriver || "");
        setEditingDriver(true);
    };

    const saveDriver = async () => {
        setSavingDriver(true);
        try {
            await savePatch({ favoriteDriver: driverInput });
            setEditingDriver(false);
        } finally {
            setSavingDriver(false);
        }
    };

    const startEditTeam = () => {
        setTeamInput(user.favoriteTeam || "");
        setEditingTeam(true);
    };

    const saveTeam = async () => {
        setSavingTeam(true);
        try {
            await savePatch({ favoriteTeam: teamInput });
            setEditingTeam(false);
        } finally {
            setSavingTeam(false);
        }
    };

    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    const firstName = user.name?.split(" ")[0] || "Racer";

    const driverId = DRIVER_ID_MAP[user.favoriteDriver];
    const teamId = FAV_TEAM_TO_CONSTRUCTOR_ID[user.favoriteTeam];
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

                        {editingIdentity ? (
                            <div className="mg-tune-field">
                                <span className="mg-tune-label mg-mono">NAME</span>
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    placeholder="Your name"
                                />
                                <span className="mg-tune-label mg-mono">EMAIL</span>
                                <input
                                    type="email"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    placeholder="you@example.com"
                                />
                                {identityError && (
                                    <p className="mg-tune-message mg-tune-message--error mg-mono">
                                        {identityError.toUpperCase()}
                                    </p>
                                )}
                                <div className="mg-edit-actions">
                                    <button
                                        className="mg-save-btn"
                                        onClick={saveIdentity}
                                        disabled={savingIdentity || !nameInput.trim() || !emailInput.trim()}
                                    >
                                        {savingIdentity ? "SAVING…" : "SAVE"}
                                    </button>
                                    <button
                                        className="mg-cancel-btn"
                                        onClick={() => setEditingIdentity(false)}
                                        disabled={savingIdentity}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
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
                                <button className="mg-cta mg-cta--btn" onClick={startEditIdentity}>
                                    EDIT DETAILS <span aria-hidden="true">→</span>
                                </button>
                            </>
                        )}
                    </section>

                    {/* ── Favourite driver workstation ──────────────── */}
                    <section className="mg-module mg-module--driver" aria-label="Favourite driver">
                        <span className="mg-module-label mg-mono">WORKSTATION 01 — DRIVER</span>
                        {editingDriver ? (
                            <div className="mg-tune-field">
                                <select value={driverInput} onChange={(e) => setDriverInput(e.target.value)}>
                                    <option value="">Select Driver</option>
                                    {DRIVERS.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <div className="mg-edit-actions">
                                    <button
                                        className="mg-save-btn"
                                        onClick={saveDriver}
                                        disabled={savingDriver || !driverInput}
                                    >
                                        {savingDriver ? "SAVING…" : "SAVE"}
                                    </button>
                                    <button
                                        className="mg-cancel-btn"
                                        onClick={() => setEditingDriver(false)}
                                        disabled={savingDriver}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        ) : user.favoriteDriver ? (
                            <>
                                <span className="mg-big-pick">{user.favoriteDriver}</span>
                                <span className="mg-pick-sub mg-mono">YOUR DRIVER OF CHOICE</span>
                                <div className="mg-edit-actions">
                                    <Link to={`/drivers/2026/${driverId}`} className="mg-cta" viewTransition>
                                        OPEN DRIVER DOSSIER <span aria-hidden="true">→</span>
                                    </Link>
                                    <button className="mg-cancel-btn" onClick={startEditDriver}>
                                        CHANGE
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="mg-big-pick mg-big-pick--empty">SEAT OPEN</span>
                                <span className="mg-pick-sub mg-mono">NO DRIVER SELECTED YET</span>
                                <button className="mg-cta mg-cta--btn" onClick={startEditDriver}>
                                    PICK YOUR DRIVER <span aria-hidden="true">→</span>
                                </button>
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
                        {editingTeam ? (
                            <div className="mg-tune-field">
                                <select value={teamInput} onChange={(e) => setTeamInput(e.target.value)}>
                                    <option value="">Select Team</option>
                                    {TEAMS.map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <div className="mg-edit-actions">
                                    <button
                                        className="mg-save-btn"
                                        onClick={saveTeam}
                                        disabled={savingTeam || !teamInput}
                                    >
                                        {savingTeam ? "SAVING…" : "SAVE"}
                                    </button>
                                    <button
                                        className="mg-cancel-btn"
                                        onClick={() => setEditingTeam(false)}
                                        disabled={savingTeam}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        ) : user.favoriteTeam ? (
                            <>
                                <span className="mg-big-pick">{user.favoriteTeam}</span>
                                <span className="mg-pick-sub mg-mono">YOUR GARAGE COLOURS</span>
                                <div className="mg-edit-actions">
                                    <Link to={`/teams/2026/${teamId}`} className="mg-cta" viewTransition>
                                        ENTER THE GARAGE <span aria-hidden="true">→</span>
                                    </Link>
                                    <button className="mg-cancel-btn" onClick={startEditTeam}>
                                        CHANGE
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="mg-big-pick mg-big-pick--empty">BAY EMPTY</span>
                                <span className="mg-pick-sub mg-mono">NO CONSTRUCTOR SELECTED YET</span>
                                <button className="mg-cta mg-cta--btn" onClick={startEditTeam}>
                                    PICK YOUR TEAM <span aria-hidden="true">→</span>
                                </button>
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
