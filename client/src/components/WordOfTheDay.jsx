import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, BookOpen, ArrowRight } from "lucide-react";
import { getWordOfTheDay } from "../utils/dictionaryHelpers";

const DISMISS_KEY = "f1dict_wotd_dismissed_on";

function WordOfTheDay() {
    const [visible, setVisible] = useState(false);
    const [term] = useState(getWordOfTheDay);

    useEffect(() => {
        const today = new Date().toDateString();
        if (localStorage.getItem(DISMISS_KEY) === today) return;
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, new Date().toDateString());
        setVisible(false);
    };

    if (!term || !visible) return null;

    return (
        <div className="wotd-popup">
            <button className="wotd-close" onClick={dismiss} aria-label="Dismiss">
                <X size={14} />
            </button>
            <div className="wotd-label">
                <BookOpen size={13} /> Word of the Day
            </div>
            <h3 className="wotd-title">{term.title}</h3>
            <p className="wotd-desc">{term.shortDescription}</p>
            <Link to={`/dictionary/${term.slug}`} className="wotd-link" onClick={dismiss}>
                Discover it <ArrowRight size={13} />
            </Link>
        </div>
    );
}

export default WordOfTheDay;
