import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/*
 * React Router doesn't reset scroll position on navigation by itself.
 * Mounted once near the router root, this resets it to the top on every
 * route change — instant, not smooth, so a new page never opens mid-way
 * down the previous one's scroll position.
 */
export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname]);

    return null;
}
