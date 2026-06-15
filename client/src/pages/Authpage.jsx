import { useState, useRef } from "react";

function AuthPage() {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rpmSegments, setRpmSegments] = useState(Array(10).fill(null));
  const [rpmText, setRpmText] = useState("IDLE");

  const [lightsVisible, setLightsVisible] = useState(false);
  const [lightStates, setLightStates] = useState(Array(5).fill("off"));
  const lightIntervalRef = useRef(null);

  const [throttleHeight, setThrottleHeight] = useState(75);
  const [brakeHeight, setBrakeHeight] = useState(25);

  const handleLogin = async () => {
    const response = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    localStorage.setItem("token", data.token);
    window.location.href = "/";
  };

  const handleSignup = async () => {
    const response = await fetch("http://localhost:3000/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    console.log(data);
    window.location.href = "/preferences";
  };

  const updateRPMGauge = (val) => {
    const score = val.length;
    const activeCount = Math.min(Math.floor(score / 1.2), 10);
    const colors = Array(10).fill(null).map((_, i) => {
      if (i >= activeCount) return null;
      if (i < 5) return "#01d2be";
      if (i < 8) return "#ff8700";
      return "#e10600";
    });
    setRpmSegments(colors);
    if (activeCount === 0) setRpmText("IDLE");
    else if (activeCount < 4) setRpmText("LOW_REV");
    else if (activeCount < 7) setRpmText("MID_BAND");
    else if (activeCount < 10) setRpmText("OPTIMAL");
    else setRpmText("REV_LIMITER");
  };

  const updateTelemetry = () => {
    setThrottleHeight(Math.floor(Math.random() * 80) + 10);
    setBrakeHeight(Math.floor(Math.random() * 60) + 5);
  };

  const startLightSequence = () => {
    setLightsVisible(true);
    setLightStates(Array(5).fill("off"));
    let current = 0;
    lightIntervalRef.current = setInterval(() => {
      if (current < 5) {
        const idx = current;
        setLightStates((prev) => {
          const next = [...prev];
          next[idx] = "red";
          return next;
        });
        current++;
      } else {
        clearInterval(lightIntervalRef.current);
        setTimeout(() => setLightStates(Array(5).fill("go")), 500);
      }
    }, 300);
  };

  const resetLightSequence = () => {
    clearInterval(lightIntervalRef.current);
    setLightsVisible(false);
    setLightStates(Array(5).fill("off"));
  };

  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
  };

  const lightDotClass = (state) => {
    if (state === "red") return "auth-light-dot auth-light-dot--red";
    if (state === "go") return "auth-light-dot auth-light-dot--go";
    return "auth-light-dot";
  };

  const footerLinks = ["Privacy Policy", "Terms of Service", "Cookie Settings", "Contact Paddock"];
  const checkeredBlocks = [8, 4, 8, 4, 8, 4];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div className="auth-root">

        {/* ── Main ── */}
        <main className="auth-main">

          {/* Left: Telemetry */}
          <section className="auth-telemetry">
            {/* Replace this div with your <img> when ready */}
            <div className="auth-telemetry__placeholder">
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: "rgba(225,6,0,0.3)", fontVariationSettings: "'FILL' 0" }}>
                directions_car
              </span>
              <span className="auth-telemetry__placeholder-label">IMAGE_PLACEHOLDER</span>
              <span className="auth-telemetry__placeholder-sub">replace with &lt;img&gt; or background</span>
            </div>

            {/* HUD */}
            <div className="auth-hud">
              <div className="auth-hud__top">
                <div>
                  <div className="auth-hud__live-label">
                    <span className="auth-hud__live-dot" />
                    LIVE_TELEMETRY_FEED
                  </div>
                  <div className="auth-hud__coords">LAT: 52.0733° N | LON: 1.0147° W</div>
                </div>
                <div className="auth-hud__circuit-info">
                  CIRCUIT: SILVERSTONE<br />TRACK_TEMP: 34.2°C
                </div>
              </div>

              <div className="auth-hud__bottom">
                <div className="auth-hud__bars">
                  {/* Brake */}
                  <div className="auth-bar-group">
                    <div className="auth-bar-group__label">BRAKE</div>
                    <div className="auth-bar-track">
                      <div className="auth-bar-fill auth-bar-fill--brake" style={{ height: `${brakeHeight}%` }} />
                    </div>
                  </div>
                  {/* Throttle */}
                  <div className="auth-bar-group">
                    <div className="auth-bar-group__label">THROTTLE</div>
                    <div className="auth-bar-track">
                      <div className="auth-bar-fill auth-bar-fill--throttle" style={{ height: `${throttleHeight}%` }} />
                    </div>
                  </div>
                </div>

                <div className="auth-hud__gear">
                  <div className="auth-hud__gear-number">08</div>
                  <div className="auth-hud__gear-label">CURRENT_GEAR</div>
                </div>
              </div>
            </div>

            <div className="auth-telemetry__edge-line" />
          </section>

          {/* Right: Auth Panel */}
          <section className="auth-panel">
            <div className="auth-panel__inner">

              {/* Tabs */}
              <div className="auth-tabs">
                {["login", "signup"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => switchMode(tab)}
                    className={`auth-tab${mode === tab ? " auth-tab--active" : ""}`}
                  >
                    {tab === "login" ? "LOGIN" : "SIGN UP"}
                  </button>
                ))}
              </div>

              {/* Form content */}
              <div className="auth-content-transition">
                <div className="auth-form__heading">
                  <h1 className="auth-form__title">
                    {mode === "signup" ? "INITIALIZATION PROTOCOL" : "ACCESS GRANTED"}
                  </h1>
                  <p className="auth-form__subtitle">
                    {mode === "signup"
                      ? "Create your pilot profile to join the grid."
                      : "Enter your paddock credentials to continue."}
                  </p>
                </div>

                <div className="auth-form__fields">
                  {/* Pilot Name — signup only */}
                  {mode === "signup" && (
                    <div>
                      <label className="auth-field__label">PILOT_FULL_NAME</label>
                      <div className="auth-field__wrapper">
                        <span className="material-symbols-outlined auth-field__icon">badge</span>
                        <input
                          type="text"
                          placeholder="MAX_VERSTAPPEN"
                          value={name}
                          onChange={(e) => { setName(e.target.value); updateTelemetry(); }}
                          className="auth-field__input"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="auth-field__label">PILOT_ID / EMAIL</label>
                    <div className="auth-field__wrapper">
                      <span className="material-symbols-outlined auth-field__icon">person</span>
                      <input
                        type="email"
                        placeholder="RACER_NAME@PADDOCK.F1"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); updateTelemetry(); }}
                        className="auth-field__input"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="auth-field__label">ENCRYPTION_KEY / PASSWORD</label>
                    <div className="auth-field__wrapper">
                      <span className="material-symbols-outlined auth-field__icon">lock</span>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); updateRPMGauge(e.target.value); updateTelemetry(); }}
                        className="auth-field__input"
                      />
                    </div>
                  </div>

                  {/* RPM gauge */}
                  <div>
                    <div className="auth-rpm__header">
                      <span className="auth-rpm__label">ENGINE_LOAD / PASSWORD_STRENGTH</span>
                      <span className="auth-rpm__status">{rpmText}</span>
                    </div>
                    <div className="auth-rpm__bar">
                      {rpmSegments.map((color, i) => (
                        <div
                          key={i}
                          className="auth-rpm__segment"
                          style={{
                            backgroundColor: color || undefined,
                            boxShadow: color === "#e10600" ? "0 0 20px rgba(225,6,0,0.4)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Remember / Forgot — login only */}
                  {mode === "login" && (
                    <div className="auth-remember-row">
                      <label className="auth-remember-row__label">
                        <input type="checkbox" className="auth-remember-row__checkbox" />
                        <span className="auth-remember-row__text">REMEMBER_PILOT</span>
                      </label>
                      <a href="#" className="auth-forgot-link">FORGOT_KEY?</a>
                    </div>
                  )}

                  {/* Lights + CTA */}
                  <div className="auth-cta">
                    <div className={`auth-lights${lightsVisible ? " auth-lights--visible" : ""}`}>
                      {lightStates.map((state, i) => (
                        <div key={i} className={lightDotClass(state)} />
                      ))}
                    </div>
                    <button
                      className="auth-cta__button"
                      onMouseEnter={startLightSequence}
                      onMouseLeave={resetLightSequence}
                      onClick={mode === "login" ? handleLogin : handleSignup}
                    >
                      {mode === "signup" ? "ENGAGE ACCESS" : "CONFIRM ACCESS"}
                    </button>
                  </div>

                  {/* Switch mode */}
                  <p className="auth-switch-text">
                    {mode === "signup" ? (
                      <>Already have an entry?{" "}
                        <span className="auth-switch-link" onClick={() => switchMode("login")}>Sign In</span>
                      </>
                    ) : (
                      <>Don't have Paddock Access?{" "}
                        <span className="auth-switch-link" onClick={() => switchMode("signup")}>Join a Team</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="auth-carbon-overlay" />
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="auth-footer">
          <div className="auth-footer__brand">
            <span className="auth-footer__f1-logo">F1</span>
            <span className="auth-footer__divider" />
            <span className="auth-footer__copyright">© 2024 FIA FORMULA ONE WORLD CHAMPIONSHIP</span>
          </div>
          <div className="auth-footer__links">
            {footerLinks.map((link) => (
              <a key={link} href="#" className="auth-footer__link">{link.toUpperCase()}</a>
            ))}
          </div>
          <div className="auth-footer__checkered">
            {checkeredBlocks.map((w, i) => (
              <div
                key={i}
                className="auth-footer__check-block"
                style={{ width: w * 4, backgroundColor: i % 2 === 0 ? "#e10600" : "#fff" }}
              />
            ))}
          </div>
        </footer>

      </div>
    </>
  );
}

export default AuthPage;