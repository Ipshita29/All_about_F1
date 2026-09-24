/*
 * Stand-in for the not-yet-selected side once exactly one driver/team has
 * been picked — an intentional placeholder, never a broken or empty card.
 */
export default function PendingSlot({ label }) {
    return (
        <div className="cmp-pending" aria-hidden="true">
            <span className="cmp-pending-mark">?</span>
            <span className="cmp-pending-label">{label}</span>
        </div>
    );
}
