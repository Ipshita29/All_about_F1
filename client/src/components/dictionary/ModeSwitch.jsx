/*
 * Rookie / Race Engineer switch for the Pit Wall Briefing.
 * The chosen depth persists via getBriefingMode/saveBriefingMode in
 * utils/dictionaryHelpers.js so the hub and every term page stay in sync.
 */
function ModeSwitch({ mode, onChange }) {
  return (
    <div className="fd-mode" role="group" aria-label="Briefing depth">
      <span className="fd-mode-label fd-mono">BRIEFING DEPTH</span>
      <div className="fd-mode-track">
        {["beginner", "expert"].map((m) => (
          <button
            key={m}
            type="button"
            className={`fd-mode-btn${mode === m ? " fd-mode-btn-active" : ""}`}
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
          >
            {m === "beginner" ? "ROOKIE" : "RACE ENGINEER"}
          </button>
        ))}
        <span className={`fd-mode-thumb fd-mode-thumb--${mode}`} aria-hidden="true" />
      </div>
    </div>
  );
}

export default ModeSwitch;
