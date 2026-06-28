import { useState } from "react";

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  };

  return (
    <div className="page" style={{ maxWidth: 420, margin: "0 auto" }}>
      <h1>{isLogin ? "Sign In" : "Create Account"}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button onClick={() => switchMode(true)} style={{ flex: 1, opacity: isLogin ? 1 : 0.5 }}>
          Login
        </button>
        <button onClick={() => switchMode(false)} style={{ flex: 1, opacity: !isLogin ? 1 : 0.5 }}>
          Sign Up
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!isLogin && (
          <div>
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Lewis Hamilton"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          onClick={isLogin ? handleLogin : handleSignup}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
        </button>
      </div>

      <p style={{ marginTop: 16, fontSize: "0.9rem" }}>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <span
          style={{ color: "#E10600", cursor: "pointer", fontWeight: 600 }}
          onClick={() => switchMode(!isLogin)}
        >
          {isLogin ? "Sign Up" : "Login"}
        </span>
      </p>
    </div>
  );
}

export default AuthPage;
