/*
 * JOIN THE GRID — one authentication journey instead of two forms.
 *
 * The page is staged like the Formula 1 starting procedure: a gantry of
 * five starting lights tracks progress, and the interface physically
 * transforms between states instead of swapping forms. Returning drivers
 * sign in and launch; new drivers create their credentials, then the
 * journey continues straight into choosing a favourite driver and
 * constructor (the same /user/preferences API the Preferences page uses)
 * before the final light goes out and the site opens.
 *
 * Business logic is unchanged: same /auth/login and /auth/signup endpoints,
 * same token storage, same destinations. Error alerts became in-page
 * "race control" messages.
 */
import { useState } from "react";
import "./JoinTheGrid.css";

const API = "http://localhost:3000";

const DRIVERS = [
  "Charles Leclerc", "Lewis Hamilton", "George Russell", "Kimi Antonelli",
  "Max Verstappen", "Yuki Tsunoda", "Lando Norris", "Oscar Piastri",
  "Fernando Alonso", "Lance Stroll", "Pierre Gasly", "Franco Colapinto",
  "Esteban Ocon", "Oliver Bearman", "Liam Lawson", "Isack Hadjar",
  "Carlos Sainz", "Alexander Albon", "Nico Hulkenberg", "Gabriel Bortoleto",
];

/* value → display name, same values the Preferences page saves */
const TEAMS = [
  ["Ferrari", "Scuderia Ferrari HP", "#dc0000"],
  ["Mercedes", "Mercedes-AMG PETRONAS", "#00d2be"],
  ["Red Bull", "Oracle Red Bull Racing", "#1e41ff"],
  ["McLaren", "McLaren F1 Team", "#ff8700"],
  ["Aston Martin", "Aston Martin Aramco", "#006f62"],
  ["Alpine", "BWT Alpine F1 Team", "#0090ff"],
  ["Haas", "MoneyGram Haas F1 Team", "#b6babd"],
  ["Racing Bulls", "Visa Cash App Racing Bulls", "#2b4562"],
  ["Williams", "Atlassian Williams Racing", "#005aff"],
  ["Sauber", "Stake F1 Kick Sauber", "#52e252"],
  ["Cadillac", "Cadillac F1 Team", "#9b7b4f"],
];

/*
 * STAGES of the starting procedure — how many lights are lit:
 *   login            4  (a returning driver, ready to launch)
 *   signup step 0    2  (credentials)
 *   signup step 1    3  (choose driver)
 *   signup step 2    4  (choose constructor)
 *   launching        5  → lights out → go
 */
function StartLights({ lit, out }) {
  return (
    <div className={`jg-gantry${out ? " jg-gantry--out" : ""}`} aria-hidden="true">
      <div className="jg-gantry-beam" />
      <div className="jg-gantry-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="jg-light-col" key={i}>
            <span className={`jg-light${!out && lit > i ? " jg-light--on" : ""}`} />
            <span className={`jg-light${!out && lit > i ? " jg-light--on" : ""}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(0); // signup: 0 credentials · 1 driver · 2 team
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [favoriteDriver, setFavoriteDriver] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        setLaunching(true);
        setTimeout(() => { window.location.href = "/"; }, 1400);
      } else {
        setError(data.message || "Sign in failed.");
      }
    } catch (e) {
      console.log(e);
      setError("Race control unreachable. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        setStep(1); /* the journey continues — pick your driver */
      } else {
        setError(data.message || "Signup failed.");
      }
    } catch (e) {
      console.log(e);
      setError("Race control unreachable. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* onboarding end: save picks via the existing preferences API, then go */
  const finishOnboarding = async (team) => {
    setFavoriteTeam(team);
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/user/preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ favoriteTeam: team, favoriteDriver }),
      });
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setLaunching(true);
      setTimeout(() => { window.location.href = "/"; }, 1800);
    }
  };

  const skipOnboarding = () => {
    setLaunching(true);
    setTimeout(() => { window.location.href = "/"; }, 1400);
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setStep(0);
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const litCount = launching ? 5 : isLogin ? 4 : 2 + step;

  const stageCaption = launching
    ? "LIGHTS OUT — AND AWAY YOU GO"
    : isLogin
      ? "RETURNING DRIVER — FINAL LIGHT ON LAUNCH"
      : ["FORMATION LAP — YOUR CREDENTIALS", "GRID SLOT — PICK YOUR DRIVER", "GARAGE COLOURS — PICK YOUR CONSTRUCTOR"][step];

  const panelKey = launching ? "launch" : `${isLogin ? "login" : "signup"}-${step}`;

  return (
    <div className="jg">
      <div className="jg-stage">
        {/* ── Left: the starting procedure ─────────────────────────── */}
        <aside className="jg-procedure">
          <div className="jg-ring" aria-hidden="true" />
          <span className="jg-eyebrow jg-mono">ALL ABOUT F1 · STARTING PROCEDURE</span>
          <h1 className="jg-title">JOIN THE GRID</h1>
          <p className="jg-caption jg-mono" key={stageCaption}>{stageCaption}</p>

          <StartLights lit={litCount} out={launching} />

          {launching && <p className="jg-go jg-mono">GO GO GO</p>}

          <ol className="jg-steps jg-mono" aria-label="Onboarding progress">
            <li className={!isLogin && step === 0 ? "jg-step--now" : ""}>CREDENTIALS</li>
            <li className={!isLogin && step === 1 ? "jg-step--now" : ""}>DRIVER</li>
            <li className={!isLogin && step === 2 ? "jg-step--now" : ""}>CONSTRUCTOR</li>
            <li className={launching ? "jg-step--now" : ""}>LIGHTS OUT</li>
          </ol>
        </aside>

        {/* ── Right: the transforming panel ────────────────────────── */}
        <main className="jg-console">
          {!launching && (
            <div className="jg-mode-toggle" role="tablist" aria-label="Sign in or create an account">
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                className={`jg-mode-btn${isLogin ? " jg-mode-btn--active" : ""}`}
                onClick={() => switchMode(true)}
              >
                RETURNING DRIVER
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={`jg-mode-btn${!isLogin ? " jg-mode-btn--active" : ""}`}
                onClick={() => switchMode(false)}
              >
                NEW TO THE GRID
              </button>
              <span
                className={`jg-mode-thumb${isLogin ? "" : " jg-mode-thumb--right"}`}
                aria-hidden="true"
              />
            </div>
          )}

          <div className="jg-panel" key={panelKey}>
            {launching ? (
              <div className="jg-launch">
                <h2 className="jg-panel-title">GRID CONFIRMED</h2>
                <p className="jg-panel-sub jg-mono">OPENING YOUR PERSONALISED PADDOCK…</p>
                <div className="jg-launch-streaks" aria-hidden="true">
                  <span /><span /><span />
                </div>
              </div>
            ) : isLogin ? (
              /* ── LOGIN ─────────────────────────────────────────── */
              <form
                className="jg-form"
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
              >
                <h2 className="jg-panel-title">WELCOME BACK TO THE PADDOCK</h2>
                <p className="jg-panel-sub jg-mono">YOUR SEAT IS WHERE YOU LEFT IT</p>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">EMAIL ADDRESS</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">PASSWORD</span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>

                {error && <p className="jg-error jg-mono" role="alert">⚑ RACE CONTROL — {error.toUpperCase()}</p>}

                <button type="submit" className="jg-primary-btn" disabled={loading}>
                  {loading ? "CHECKING TELEMETRY…" : "LAUNCH"}
                </button>

                <p className="jg-swap">
                  First time here?{" "}
                  <button type="button" className="jg-swap-link" onClick={() => switchMode(false)}>
                    Join the grid
                  </button>
                </p>
              </form>
            ) : step === 0 ? (
              /* ── SIGNUP · CREDENTIALS ──────────────────────────── */
              <form
                className="jg-form"
                onSubmit={(e) => { e.preventDefault(); handleSignup(); }}
              >
                <h2 className="jg-panel-title">EVERY LEGEND STARTS SOMEWHERE</h2>
                <p className="jg-panel-sub jg-mono">STEP 1 OF 3 — YOUR RACE LICENCE</p>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">FULL NAME</span>
                  <input
                    type="text"
                    placeholder="Lewis Hamilton"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">EMAIL ADDRESS</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">PASSWORD</span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                {error && <p className="jg-error jg-mono" role="alert">⚑ RACE CONTROL — {error.toUpperCase()}</p>}

                <button type="submit" className="jg-primary-btn" disabled={loading}>
                  {loading ? "FILING PAPERWORK…" : "SIGN MY RACE LICENCE →"}
                </button>

                <p className="jg-swap">
                  Already on the grid?{" "}
                  <button type="button" className="jg-swap-link" onClick={() => switchMode(true)}>
                    Sign in
                  </button>
                </p>
              </form>
            ) : step === 1 ? (
              /* ── SIGNUP · DRIVER PICK ──────────────────────────── */
              <div className="jg-form">
                <h2 className="jg-panel-title">WHO DO YOU RACE FOR?</h2>
                <p className="jg-panel-sub jg-mono">STEP 2 OF 3 — PICK YOUR DRIVER</p>

                <div className="jg-pick-grid" role="listbox" aria-label="Favourite driver">
                  {DRIVERS.map((driver, i) => (
                    <button
                      key={driver}
                      type="button"
                      role="option"
                      aria-selected={favoriteDriver === driver}
                      className={`jg-pick${favoriteDriver === driver ? " jg-pick--on" : ""}`}
                      style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}
                      onClick={() => setFavoriteDriver(driver)}
                    >
                      <span className="jg-pick-num jg-mono">{String(i + 1).padStart(2, "0")}</span>
                      {driver}
                    </button>
                  ))}
                </div>

                <div className="jg-row">
                  <button
                    type="button"
                    className="jg-primary-btn"
                    disabled={!favoriteDriver}
                    onClick={() => setStep(2)}
                  >
                    CONFIRM DRIVER →
                  </button>
                  <button type="button" className="jg-ghost-btn" onClick={skipOnboarding}>
                    SKIP FOR NOW
                  </button>
                </div>
              </div>
            ) : (
              /* ── SIGNUP · CONSTRUCTOR PICK ─────────────────────── */
              <div className="jg-form">
                <h2 className="jg-panel-title">CHOOSE YOUR GARAGE</h2>
                <p className="jg-panel-sub jg-mono">STEP 3 OF 3 — PICK YOUR CONSTRUCTOR</p>

                <div className="jg-pick-grid jg-pick-grid--teams" role="listbox" aria-label="Favourite constructor">
                  {TEAMS.map(([value, label, color], i) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={favoriteTeam === value}
                      className={`jg-pick jg-pick--team${favoriteTeam === value ? " jg-pick--on" : ""}`}
                      style={{ "--jg-team": color, animationDelay: `${Math.min(i, 14) * 30}ms` }}
                      onClick={() => (loading ? null : finishOnboarding(value))}
                    >
                      <span className="jg-pick-swatch" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>

                {loading && <p className="jg-panel-sub jg-mono">PAINTING YOUR GARAGE…</p>}

                <div className="jg-row">
                  <button type="button" className="jg-ghost-btn" onClick={() => setStep(1)}>
                    ← BACK TO DRIVERS
                  </button>
                  <button type="button" className="jg-ghost-btn" onClick={skipOnboarding}>
                    SKIP FOR NOW
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AuthPage;
