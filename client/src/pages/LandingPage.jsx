/*
 * Landing page — cinematic F1 experience.
 *
 * This file owns all landing-page data fetching (same backend endpoints the
 * old page used) and passes plain props down to the section components in
 * src/components/landing/. Page order:
 *
 *   F1Intro → HeroReveal → (GridInvite, delayed, logged-out only)
 *   → LiveRaceCenter → NextGpGarage → PodiumSection → ChampionshipSection
 *   → PaddockNews → ExploreGrid → GarageFooter
 *   + PitWallRadio floating after the hero.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import F1Intro from "../components/landing/F1Intro";
import HeroReveal from "../components/landing/HeroReveal";
import GridInvite from "../components/landing/GridInvite";
import LiveRaceCenter from "../components/landing/LiveRaceCenter";
import NextGpGarage from "../components/landing/NextGpGarage";
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
            <F1Intro />

            <HeroReveal />

            <GridInvite isAuthenticated={isAuthenticated} />

            <main className="lp-main">
                <LiveRaceCenter
                    liveSession={liveSession}
                    nextSession={nextSession}
                    driverStandings={driverStandings}
                    favs={favs}
                    scheduleError={scheduleError}
                />

                <NextGpGarage race={nextSession?.race || null} />

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
