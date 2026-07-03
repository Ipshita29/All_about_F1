import { useEffect, useState } from "react";

const TOTAL_LIGHTS = 5;
const LIGHT_ON_INTERVAL = 400;
const HOLD_DURATION = 650;
const LIGHTS_OUT_PAUSE = 850;

export default function LoadingSpinner({ label = "Loading..." }) {
    const [litCount, setLitCount] = useState(0);
    const [go, setGo] = useState(false);

    useEffect(() => {
        let timeouts = [];
        const runCycle = () => {
            setGo(false);
            for (let i = 1; i <= TOTAL_LIGHTS; i++) {
                timeouts.push(setTimeout(() => setLitCount(i), i * LIGHT_ON_INTERVAL));
            }
            const lightsOutAt = TOTAL_LIGHTS * LIGHT_ON_INTERVAL + HOLD_DURATION;
            timeouts.push(setTimeout(() => {
                setLitCount(0);
                setGo(true);
            }, lightsOutAt));
            timeouts.push(setTimeout(runCycle, lightsOutAt + LIGHTS_OUT_PAUSE));
        };
        runCycle();
        return () => timeouts.forEach(clearTimeout);
    }, []);

    return (
        <div className="f1-lights-loading">
            <div className="f1-lights-gantry">
                <div className="f1-lights-beam"></div>
                <div className="f1-lights-row">
                    {Array.from({ length: TOTAL_LIGHTS }).map((_, i) => (
                        <div className="f1-light-column" key={i}>
                            <span className={`f1-light ${litCount > i ? "lit" : ""}`}></span>
                            <span className={`f1-light ${litCount > i ? "lit" : ""}`}></span>
                        </div>
                    ))}
                </div>
            </div>
            <p className={`f1-lights-label ${go ? "go" : ""}`}>{go ? "GO!" : label}</p>
        </div>
    );
}
