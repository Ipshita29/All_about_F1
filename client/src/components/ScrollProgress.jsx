import { useEffect, useState } from "react";

function F1CarIcon() {
    return (
        <svg viewBox="0 0 120 50" className="f1-scroll-car-svg" aria-hidden="true">
            {/* rear wing */}
            <rect x="0" y="9" width="16" height="4" rx="2" fill="currentColor" />
            <rect x="7" y="13" width="3" height="9" fill="currentColor" />
            {/* rear deck + chassis */}
            <rect x="10" y="16" width="20" height="7" rx="3" fill="currentColor" />
            <rect x="10" y="21" width="72" height="9" rx="4.5" fill="currentColor" />
            {/* cockpit hump */}
            <rect x="34" y="12" width="18" height="10" rx="5" fill="currentColor" />
            {/* halo */}
            <path
                d="M37,15 Q46,3 55,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            {/* nose cone */}
            <polygon points="80,22 80,29 108,27 108,24" fill="currentColor" />
            {/* front wing */}
            <rect x="100" y="29" width="17" height="3" rx="1.5" fill="currentColor" />
            <rect x="113" y="26" width="2.5" height="9" fill="currentColor" />
            {/* wheels */}
            <circle cx="28" cy="34" r="9" fill="#161616" />
            <circle cx="28" cy="34" r="3.5" fill="#666" />
            <circle cx="86" cy="34" r="9" fill="#161616" />
            <circle cx="86" cy="34" r="3.5" fill="#666" />
        </svg>
    );
}

export default function ScrollProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - doc.clientHeight;
            const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
            setProgress(Math.min(100, Math.max(0, pct)));
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, []);

    return (
        <div
            className="f1-scroll-track"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Page scroll progress"
        >
            <div className="f1-scroll-fill" style={{ width: `${progress}%` }} />
            <div className="f1-scroll-car" style={{ left: `${progress}%` }}>
                <F1CarIcon />
            </div>
            <div className="f1-scroll-finish" />
        </div>
    );
}
