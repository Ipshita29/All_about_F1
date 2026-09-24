/*
 * Explanation-level segmented control — Rookie / Race Engineer.
 * A proper two-cell segmented control, not a floating pill: equal-height
 * cells, a shared border, the active cell filled with a light surface and
 * marked with a small Milano Red indicator dot. Same getBriefingMode/
 * saveBriefingMode contract as before — this only changes presentation.
 */
const OPTIONS = [
    { value: "beginner", label: "ROOKIE" },
    { value: "expert", label: "RACE ENGINEER" },
];

function ModeSwitch({ mode, onChange, label = "EXPLANATION LEVEL", className = "" }) {
    return (
        <div className={`fd-mode${className ? ` ${className}` : ""}`}>
            <span className="fd-mode-label fd-mono">{label}</span>
            <div className="fd-mode-track" role="group" aria-label={label}>
                {OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        aria-pressed={mode === opt.value}
                        className={`fd-mode-btn${mode === opt.value ? " fd-mode-btn-active" : ""}`}
                        onClick={() => onChange(opt.value)}
                    >
                        {mode === opt.value && <span className="fd-mode-dot" aria-hidden="true" />}
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ModeSwitch;
