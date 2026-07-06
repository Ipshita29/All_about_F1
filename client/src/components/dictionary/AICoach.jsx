import { useState } from "react";

const MODES = [
  { key: "simple", label: "Explain Simply" },
  { key: "fan", label: "Explain Like A Fan" },
  { key: "technical", label: "Explain Technically" },
  { key: "example", label: "Give A Real Race Example" },
];

function AICoach({ termTitle }) {
  const [activeMode, setActiveMode] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClick = (mode) => {
    setActiveMode(mode);
    setLoading(true);
    setTimeout(() => setLoading(false), 1100);
  };

  return (
    <div className="fd-ai-card">
      <div className="fd-ai-header">
        <span className="fd-ai-orb" aria-hidden="true" />
        <div>
          <h3>AI Coach</h3>
          <p>Pick a style and get a tailored take on {termTitle}.</p>
        </div>
      </div>

      <div className="fd-ai-buttons">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className={`fd-ai-btn${activeMode === mode.key ? " fd-ai-btn-active" : ""}`}
            onClick={() => handleClick(mode.key)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {activeMode && (
        <div className="fd-ai-response">
          {loading ? (
            <p className="fd-ai-loading">
              <span className="fd-ai-dot" /> Analyzing telemetry...
            </p>
          ) : (
            <p>
              AI-powered explanations are coming soon. This button will use the "
              {MODES.find((m) => m.key === activeMode)?.label}" style once connected to a live model.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AICoach;
