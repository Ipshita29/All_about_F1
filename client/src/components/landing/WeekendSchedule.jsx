/*
 * Compact Friday–Sunday session list for the current/next race weekend.
 */
import { formatSessionTime } from "../../utils/timeUtils";

export default function WeekendSchedule({ sessions }) {
    const now = new Date();
    return (
        <div className="ws">
            <span className="ws-label">WEEKEND SCHEDULE</span>
            <ul>
                {sessions.map((s) => (
                    <li key={s.key} className={s.start < now ? "is-done" : ""}>
                        <span>{s.label}</span>
                        <span>{formatSessionTime(s.date, s.time)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
