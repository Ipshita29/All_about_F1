/*
 * Homepage — a premium F1 intelligence dashboard, not a cinematic showcase.
 *
 * This file owns all landing-page data fetching (same backend endpoints the
 * previous page used) and passes plain props down to the section components
 * in src/components/landing/. Page order:
 *
 *   HeroReveal (current/next GP, typographic) → GridInvite (delayed,
 *   logged-out only) → PodiumSection → ChampionshipSection → PaddockNews
 *   → ExploreGrid → GarageFooter, with PitWallRadio floating after the hero.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import HeroReveal from "../components/landing/HeroReveal";
import GridInvite from "../components/landing/GridInvite";
import PodiumSection from "../components/landing/PodiumSection";
import ChampionshipSection from "../components/landing/ChampionshipSection";
import PaddockNews from "../components/landing/PaddockNews";
import PitWallRadio from "../components/landing/PitWallRadio";
import ExploreGrid from "../components/landing/ExploreGrid";
import GarageFooter from "../components/landing/GarageFooter";

import {
    buildFavourites,
    findLiveSession,
    findNextSession,
    getCompletedRaces,
} from "../utils/landingHelpers";

import "./LandingPage.css";

const SEASON = 2026;
const API = "http://localhost:3000";

function LandingPage() {
    const [races, setRaces] = useState([]);
    const [scheduleError, setScheduleError] = useState(false);
    const [user, setUser] = useState(null);
    const [driverStandings, setDriverStandings] = useState([]);
    const [constructorStandings, setConstructorStandings] = useState([]);
    const [latestRace, setLatestRace] = useState(null);
    const [newsArticles, setNewsArticles] = useState([]);
    const [newsError, setNewsError] = useState(false);

    /* re-evaluated every minute so a session flips to LIVE without a reload */
    const [minuteTick, setMinuteTick] = useState(0);

    const footerWrapRef = useRef(null);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setRaces(Array.isArray(data) ? data : []))
            .catch(() => setScheduleError(true));
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API}/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => data && !data.message && setUser(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(`${API}/drivers/standings/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, []);

    useEffect(() => {
        fetch(`${API}/teams/standings/${SEASON}`)
            .then((res) => res.json())
            .then((data) => setConstructorStandings(Array.isArray(data) ? data : []))
            .catch(() => setConstructorStandings([]));
    }, []);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/latest`)
            .then((res) => res.json())
            .then((data) => data?.raceName && setLatestRace(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(`${API}/news`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setNewsArticles(data);
                else setNewsError(true);
            })
            .catch(() => setNewsError(true));
    }, []);

    useEffect(() => {
        const id = setInterval(() => setMinuteTick((t) => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    /* minuteTick is a deliberate extra dependency: these values depend on
       the current time, so they are re-derived once a minute */
    const { liveSession, nextSession, completedRaces } = useMemo(
        () => ({
            liveSession: findLiveSession(races),
            nextSession: findNextSession(races),
            completedRaces: getCompletedRaces(races),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [races, minuteTick]
    );
    const favs = useMemo(() => buildFavourites(user), [user]);

    const isAuthenticated = Boolean(localStorage.getItem("token"));

    return (
        <div className="lp">
            <HeroReveal
                liveSession={liveSession}
                nextSession={nextSession}
                scheduleError={scheduleError}
            />

            <GridInvite isAuthenticated={isAuthenticated} />

            <main className="lp-main">
                <PodiumSection
                    completedRaces={completedRaces}
                    latestRace={latestRace}
                    favs={favs}
                />

                <ChampionshipSection
                    driverStandings={driverStandings}
                    constructorStandings={constructorStandings}
                    favs={favs}
                />

                <PaddockNews articles={newsArticles} favs={favs} error={newsError} />

                <ExploreGrid />
            </main>

            <div ref={footerWrapRef}>
                <GarageFooter isAuthenticated={isAuthenticated} />
            </div>

            <PitWallRadio user={user} favs={favs} footerRef={footerWrapRef} />
        </div>
    );
}

export default LandingPage;
