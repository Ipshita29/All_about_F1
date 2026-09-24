/*
 * JOIN THE GRID — one authentication journey instead of two forms.
 *
 * A dark brand panel (identity, starting-lights progress) sits beside a
 * light Cararra form panel — an editorial two-pane composition instead of
 * a card centred on a black screen. Returning drivers sign in and launch;
 * new drivers create their credentials, then the journey continues
 * straight into choosing a favourite driver and constructor (the same
 * /user/preferences API the Preferences page uses) before the final light
 * goes out and the site opens.
 *
 * Business logic is unchanged: same /auth/login and /auth/signup
 * endpoints, same token storage, same destinations, same fields, same
 * validation. Only presentation changed — copy, layout and the shared
 * Phase 1 Button component in place of bespoke buttons.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/UI";
import "../styles/pages/AuthPage.css";

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

/* A subtle technical mark for the auth brand panel — sector ticks along a
   lap line, not a race photo or a logo. Only used on this page. */
function AuthMark() {
  return (
    <svg className="jg-mark" viewBox="0 0 260 90" fill="none" aria-hidden="true">
      <line x1="4" y1="45" x2="256" y2="45" stroke="currentColor" strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
      <path d="M4 45 L70 45 L92 12 L168 12 L190 45 L256 45" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="70" cy="45" r="2.5" fill="currentColor" />
      <circle cx="92" cy="12" r="2.5" fill="currentColor" />
      <circle cx="168" cy="12" r="2.5" fill="currentColor" />
      <circle cx="190" cy="45" r="2.5" fill="currentColor" />
      <text x="66" y="66" className="jg-mark-tag">S1</text>
      <text x="120" y="6" className="jg-mark-tag">S2</text>
      <text x="186" y="66" className="jg-mark-tag">S3</text>
    </svg>
  );
}

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
      setError("Server unreachable. Try again.");
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
      setError("Server unreachable. Try again.");
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
    ? "You're in. Opening the paddock."
    : isLogin
      ? "Sign in to continue where you left off."
      : ["Step 1 of 3 — your credentials", "Step 2 of 3 — pick your driver", "Step 3 of 3 — pick your constructor"][step];

  const panelKey = launching ? "launch" : `${isLogin ? "login" : "signup"}-${step}`;

  return (
    <div className="jg">
      <header className="jg-topbar">
        <Link to="/" className="jg-wordmark">ALL ABOUT F1</Link>
        <Link to="/" className="jg-home-link jg-mono">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
      </header>

      <div className="jg-stage">
        {/* ── Left: brand + starting procedure ─────────────────────── */}
        <aside className="jg-procedure">
          <div>
            <span className="jg-eyebrow jg-mono">F1 · MEMBER ACCESS</span>
            <h1 className="jg-title">Join the grid.</h1>
            <p className="jg-lede">
              One account for race data, championship context and every
              driver &amp; constructor you follow.
            </p>

            <ul className="jg-points jg-mono">
              <li>Live standings &amp; race results</li>
              <li>Driver &amp; constructor intelligence</li>
              <li>A paddock tuned to your favourites</li>
            </ul>
          </div>

          <div className="jg-procedure-foot">
            <p className="jg-caption jg-mono" key={stageCaption}>{stageCaption}</p>
            <StartLights lit={litCount} out={launching} />
            {launching && <p className="jg-go jg-mono">GO GO GO</p>}

            <ol className="jg-steps jg-mono" aria-label="Onboarding progress">
              <li className={!isLogin && step === 0 ? "jg-step--now" : ""}>CREDENTIALS</li>
              <li className={!isLogin && step === 1 ? "jg-step--now" : ""}>DRIVER</li>
              <li className={!isLogin && step === 2 ? "jg-step--now" : ""}>CONSTRUCTOR</li>
              <li className={launching ? "jg-step--now" : ""}>LIGHTS OUT</li>
            </ol>

            <AuthMark />
          </div>
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
                {isLogin && <span className="jg-mode-dot" aria-hidden="true" />}
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={`jg-mode-btn${!isLogin ? " jg-mode-btn--active" : ""}`}
                onClick={() => switchMode(false)}
              >
                {!isLogin && <span className="jg-mode-dot" aria-hidden="true" />}
                Create Account
              </button>
            </div>
          )}

          <div className="jg-panel" key={panelKey}>
            {launching ? (
              <div className="jg-launch">
                <h2 className="jg-panel-title">You're all set.</h2>
                <p className="jg-panel-sub jg-mono">OPENING YOUR PADDOCK…</p>
              </div>
            ) : isLogin ? (
              /* ── LOGIN ─────────────────────────────────────────── */
              <form
                className="jg-form"
                onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
              >
                <h2 className="jg-panel-title">Welcome back.</h2>
                <p className="jg-panel-sub">Continue your F1 experience.</p>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">EMAIL</span>
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

                {error && <p className="jg-error jg-mono" role="alert">{error}</p>}

                <Button type="submit" variant="primary" arrow disabled={loading} className="jg-submit">
                  {loading ? "Signing In…" : "Sign In"}
                </Button>

                <p className="jg-swap">
                  Don&rsquo;t have an account?{" "}
                  <button type="button" className="jg-swap-link" onClick={() => switchMode(false)}>
                    Create one →
                  </button>
                </p>
              </form>
            ) : step === 0 ? (
              /* ── SIGNUP · CREDENTIALS ──────────────────────────── */
              <form
                className="jg-form"
                onSubmit={(e) => { e.preventDefault(); handleSignup(); }}
              >
                <h2 className="jg-panel-title">Create your account.</h2>
                <p className="jg-panel-sub">Your F1 dashboard starts here.</p>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">NAME</span>
                  <input
                    type="text"
                    placeholder="Lewis Hamilton"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>

                <label className="jg-field">
                  <span className="jg-field-label jg-mono">EMAIL</span>
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

                {error && <p className="jg-error jg-mono" role="alert">{error}</p>}

                <Button type="submit" variant="primary" arrow disabled={loading} className="jg-submit">
                  {loading ? "Creating Account…" : "Create Account"}
                </Button>

                <p className="jg-swap">
                  Already have an account?{" "}
                  <button type="button" className="jg-swap-link" onClick={() => switchMode(true)}>
                    Sign in →
                  </button>
                </p>
              </form>
            ) : step === 1 ? (
              /* ── SIGNUP · DRIVER PICK ──────────────────────────── */
              <div className="jg-form">
                <h2 className="jg-panel-title">Who do you race for?</h2>
                <p className="jg-panel-sub">Step 2 of 3 — pick your favourite driver.</p>

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
                  <Button
                    type="button"
                    variant="primary"
                    arrow
                    disabled={!favoriteDriver}
                    onClick={() => setStep(2)}
                  >
                    Confirm Driver
                  </Button>
                  <Button type="button" variant="dark" onClick={skipOnboarding}>
                    Skip For Now
                  </Button>
                </div>
              </div>
            ) : (
              /* ── SIGNUP · CONSTRUCTOR PICK ─────────────────────── */
              <div className="jg-form">
                <h2 className="jg-panel-title">Choose your garage.</h2>
                <p className="jg-panel-sub">Step 3 of 3 — pick your favourite constructor.</p>

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

                {loading && <p className="jg-panel-sub jg-mono">Saving your garage…</p>}

                <div className="jg-row">
                  <Button type="button" variant="dark" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button type="button" variant="dark" onClick={skipOnboarding}>
                    Skip For Now
                  </Button>
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
