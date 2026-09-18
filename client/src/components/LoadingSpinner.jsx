/*
 * Minimal, restrained loading indicator: three dots easing in sequence.
 * Replaces the old "F1 starting lights" animation — same purpose, none
 * of the theatre.
 */
export default function LoadingSpinner({ label = "Loading" }) {
    return (
        <div className="aaf-spinner" role="status" aria-live="polite">
            <span className="aaf-spinner-dots" aria-hidden="true">
                <i /><i /><i />
            </span>
            <p className="aaf-spinner-label">{label}</p>
        </div>
    );
}
