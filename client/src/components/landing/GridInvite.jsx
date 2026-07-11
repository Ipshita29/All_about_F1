/*
 * Delayed personalization invitation for logged-out visitors.
 * Slides in from the bottom-right ~8s after the page loads, is dismissible,
 * and stays dismissed for the rest of the browser session.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const DISMISS_KEY = "aaf1_invite_dismissed";
const SHOW_DELAY_MS = 8000;

function wasDismissed() {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
        return false;
    }
}

export default function GridInvite({ isAuthenticated }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isAuthenticated || wasDismissed()) return undefined;
        const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
    }, [isAuthenticated]);

    const dismiss = () => {
        try {
            sessionStorage.setItem(DISMISS_KEY, "1");
        } catch {
            /* ignore */
        }
        setVisible(false);
    };

    if (isAuthenticated || !visible) return null;

    return (
        <aside
            className="lp-invite"
            aria-label="Personalize your feed"
            onKeyDown={(e) => e.key === "Escape" && dismiss()}
        >
            <button className="lp-invite-close" onClick={dismiss} aria-label="Dismiss invitation">
                <X size={14} />
            </button>
            <p className="lp-invite-eyebrow">PIT LANE OPEN</p>
            <h3 className="lp-invite-title">MAKE THE GRID YOURS</h3>
            <p className="lp-invite-copy">
                Follow your favourite driver and team. Highlight the stories,
                standings and race updates that matter to you.
            </p>
            <div className="lp-invite-actions">
                <Link to="/auth" className="lp-invite-primary" onClick={dismiss}>
                    PERSONALIZE MY FEED
                </Link>
                <button className="lp-invite-secondary" onClick={dismiss}>
                    MAYBE LATER
                </button>
            </div>
        </aside>
    );
}
