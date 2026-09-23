/*
 * Shared empty state — for pages like Driver/Team Comparison before a
 * selection is made. Intentional, not a blank page:
 *
 *   <EmptyState
 *     title="Two cars. One straight."
 *     description="Select two drivers above to line them up."
 *     action={<Button variant="primary">Select a driver</Button>}
 *   />
 */
function DefaultIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="12" r="6" />
            <circle cx="15" cy="12" r="6" />
        </svg>
    );
}

export default function EmptyState({ icon, title, description, action, className = "" }) {
    return (
        <div className={`empty-state${className ? ` ${className}` : ""}`}>
            <span className="empty-state-icon" aria-hidden="true">
                {icon || <DefaultIcon />}
            </span>
            {title && <h3 className="empty-state-title">{title}</h3>}
            {description && <p className="empty-state-desc">{description}</p>}
            {action && <div className="empty-state-action">{action}</div>}
        </div>
    );
}
