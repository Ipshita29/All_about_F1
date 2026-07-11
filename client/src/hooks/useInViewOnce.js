import { useEffect, useRef, useState } from "react";

/* True once the referenced element has entered the viewport; the observer
   disconnects after the first hit so scroll animations only run once.
   Environments without IntersectionObserver start "in view". */
export default function useInViewOnce(options = { threshold: 0.25 }) {
    const ref = useRef(null);
    const [inView, setInView] = useState(
        () => typeof IntersectionObserver === "undefined"
    );

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setInView(true);
                observer.disconnect();
            }
        }, options);
        observer.observe(el);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return [ref, inView];
}
