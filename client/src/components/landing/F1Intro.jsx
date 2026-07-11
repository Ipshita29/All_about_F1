/*
 * Cinematic once-per-session intro: near-black screen, an F1 car crosses
 * left→right with speed lines and a red light trail, then the overlay wipes
 * away left-to-right (following the trail) to reveal the hero.
 *
 * All motion is CSS keyframes; JS only decides whether to show the overlay
 * (sessionStorage) and unmounts it when the timeline ends.
 */
import { useEffect, useState } from "react";
import CarVisual from "./F1CarSilhouette";
import useReducedMotion from "../../hooks/useReducedMotion";

const SESSION_KEY = "aaf1_intro_seen";

function introAlreadySeen() {
    try {
        return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
        return true;
    }
}

function markIntroSeen() {
    try {
        sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
        /* private mode — just play it again next time */
    }
}

export default function F1Intro() {
    const reduced = useReducedMotion();
    const [visible, setVisible] = useState(() => !introAlreadySeen());

    useEffect(() => {
        if (!visible) return undefined;
        markIntroSeen();
        document.body.classList.add("lp-no-scroll");
        const total = reduced ? 450 : 1550;
        const timer = setTimeout(() => setVisible(false), total);
        return () => {
            clearTimeout(timer);
            document.body.classList.remove("lp-no-scroll");
        };
    }, [visible, reduced]);

    if (!visible) return null;

    return (
        <div
            className={`lp-intro${reduced ? " lp-intro--reduced" : ""}`}
            role="presentation"
            aria-hidden="true"
        >
            <div className="lp-intro-scene">
                <div className="lp-intro-speedlines" />
                <div className="lp-intro-runner">
                    <div className="lp-intro-trail" />
                    <CarVisual className="lp-intro-car" />
                </div>
                <p className="lp-intro-caption">LIGHTS OUT</p>
            </div>
        </div>
    );
}
