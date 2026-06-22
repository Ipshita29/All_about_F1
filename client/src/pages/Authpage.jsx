import { useState } from "react";
import "./Authpage.css";

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/";
      } else {
        alert(data.message);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        window.location.href = "/preferences";
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="auth-wrap">

      {/* ── Left: hero image ── */}
      <div className="auth-image">
        <img
          src={isLogin ? "/auth/login.jpg" : "/auth/signup.jpg"}
          alt={isLogin ? "F1 Login" : "F1 Sign Up"}
        />
        <div className="auth-image-overlay">
          <div>
            <div className="auth-logo-mark">F1</div>
            <p className="auth-tagline">
              {isLogin
                ? "Welcome back. The race awaits."
                : "Join the grid. Your journey starts here."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-container">

          {/* Brand */}
          <div className="auth-brand-row">
            <span className="auth-brand-bar" />
            <span className="auth-brand-name">All About F1</span>
          </div>

          <h1 className="auth-heading">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="auth-subheading">
            {isLogin
              ? "Enter your credentials to continue"
              : "Start following the sport you love"}
          </p>

          {/* Login / Sign Up tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${isLogin ? " active" : ""}`}
              onClick={() => switchMode(true)}
            >
              Login
            </button>
            <button
              className={`auth-tab${!isLogin ? " active" : ""}`}
              onClick={() => switchMode(false)}
            >
              Sign Up
            </button>
          </div>

          {/* Form fields */}
          <div className="auth-fields">

            {!isLogin && (
              <div className="auth-field">
                <label className="auth-label">Full Name</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Lewis Hamilton"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label">Password</label>
                {isLogin && (
                  <span className="auth-forgot">Forgot password?</span>
                )}
              </div>
              <div className="auth-pw-wrapper">
                <input
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              className="auth-submit-btn"
              onClick={isLogin ? handleLogin : handleSignup}
              disabled={loading}
            >
              {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
            </button>
          </div>

          <p className="auth-switch-text">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span
              className="auth-switch-link"
              onClick={() => switchMode(!isLogin)}
            >
              {isLogin ? "Sign Up" : "Login"}
            </span>
          </p>

          <p className="auth-terms">
            By continuing you agree to our{" "}
            <span className="auth-terms-link">Terms of Service</span> and{" "}
            <span className="auth-terms-link">Privacy Policy</span>.
          </p>

        </div>
      </div>
    </div>
  );
}

export default AuthPage;
