/*
 * FROM THE PADDOCK — the news feed as a premium F1 editorial newsroom.
 *
 * A dark masthead leads into a light featured-story band, a dark deck of
 * secondary stories, and a light "latest news" archive grouped into real
 * chapters — a deliberate light/dark rhythm instead of one long black
 * page. The chapter names already computed from article content now also
 * double as a real, non-fake category filter. Opening a story unfolds an
 * in-page reader (no route change) via a shared-element view transition,
 * with a reading progress bar, contextual driver/team links and editorial
 * recommendations. Same /news endpoint, search and reader mechanics as
 * before; only the presentation changes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { SearchInput, EmptyState, Button } from "../components/UI";
import {
    DRIVER_ID_MAP,
    FAV_TEAM_TO_CONSTRUCTOR_ID,
    formatArticleTime,
} from "../utils/landingHelpers";
import "../styles/pages/NewsPage.css";

const API = "http://localhost:3000";

/* ── Editorial helpers (presentation only) ─────────────────────────── */

const CHAPTERS = [
    {
        name: "Race Weekend",
        test: /grand prix|qualifying|practice|pole|podium|sprint|race day|fastest lap|lights out/i,
    },
    {
        name: "Transfers & Contracts",
        test: /contract|sign(s|ed|ing)?|seat|replace|move to|switch|joins|linked|rumou?r|deal/i,
    },
    {
        name: "Technical Developments",
        test: /upgrade|aero|engine|power unit|floor|wing|chassis|technical|development|design|testing/i,
    },
    {
        name: "Regulations & Race Control",
        test: /fia|regulation|penalt|steward|rule|ban|protest|investigation|budget cap/i,
    },
    {
        name: "Driver News",
        test: new RegExp(Object.keys(DRIVER_ID_MAP).join("|"), "i"),
    },
    {
        name: "Team News",
        test: new RegExp(Object.keys(FAV_TEAM_TO_CONSTRUCTOR_ID).join("|"), "i"),
    },
];

const FALLBACK_CHAPTER = "Paddock Notes";

function chapterFor(article) {
    const text = `${article.title || ""} ${article.description || ""}`;
    for (const chapter of CHAPTERS) {
        if (chapter.test.test(text)) return chapter.name;
    }
    return FALLBACK_CHAPTER;
}

function readingTime(article) {
    const words = `${article.title || ""} ${article.description || ""}`
        .split(/\s+/)
        .filter(Boolean).length;
    return Math.max(1, Math.round(words / 90));
}

function formatNewsDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/* drivers / teams mentioned in the copy → contextual editorial links */
function entityLinks(article) {
    const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
    const links = [];
    for (const [name, driverId] of Object.entries(DRIVER_ID_MAP)) {
        if (text.includes(name.toLowerCase())) {
            links.push({ label: name, to: `/drivers/2026/${driverId}`, kind: "DRIVER" });
        }
    }
    for (const [name, teamId] of Object.entries(FAV_TEAM_TO_CONSTRUCTOR_ID)) {
        if (text.includes(name.toLowerCase())) {
            links.push({ label: name, to: `/teams/2026/${teamId}`, kind: "TEAM" });
        }
    }
    /* de-dupe by target (Kimi Antonelli appears under two map keys) */
    return links.filter(
        (l, i) => links.findIndex((o) => o.to === l.to) === i
    ).slice(0, 6);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/* ── Article photography with a styled local fallback ─────────────── */

function ArticleImage({ article, className, vtName }) {
    const [failed, setFailed] = useState(false);
    if (!article.image || failed) {
        return (
            <div
                className={`fp-img fp-img--missing ${className || ""}`}
                style={vtName ? { viewTransitionName: vtName } : undefined}
                aria-hidden="true"
            >
                <span className="fp-mono">FROM THE PADDOCK</span>
            </div>
        );
    }
    return (
        <div
            className={`fp-img ${className || ""}`}
            style={vtName ? { viewTransitionName: vtName } : undefined}
        >
            <img
                src={article.image}
                alt={article.title}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

/* ── The unfolding magazine reader ─────────────────────────────────── */

function Reader({ article, related, onClose, onSwitch }) {
    const bodyRef = useRef(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    /* reset progress when the story changes (state adjustment during
       render, per React docs, instead of a cascading setState in an effect) */
    const [lastId, setLastId] = useState(article.id);
    if (lastId !== article.id) {
        setLastId(article.id);
        setProgress(0);
    }

    /* scroll the new story to the top */
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
    }, [article.id]);

    const onScroll = () => {
        const el = bodyRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
    };

    const links = entityLinks(article);

    return (
        <div className="fp-reader" role="dialog" aria-modal="true" aria-label={article.title}>
            <div className="fp-reader-backdrop" onClick={onClose} />
            <div className="fp-reader-page">
                <div className="fp-reader-progress" aria-hidden="true">
                    <div style={{ transform: `scaleX(${progress})` }} />
                </div>

                <button className="fp-reader-close" onClick={onClose} aria-label="Close story">
                    <X size={18} />
                </button>

                <div className="fp-reader-body" ref={bodyRef} onScroll={onScroll}>
                    <div className="fp-reader-copy">
                        <span className="fp-kicker fp-mono">F1 · {chapterFor(article).toUpperCase()}</span>

                        <h1 className="fp-reader-title">{article.title}</h1>

                        <div className="fp-reader-meta fp-mono">
                            <span className="fp-source">{article.source}</span>
                            <span>{formatNewsDate(article.publishedAt)}</span>
                            <span>{readingTime(article)} MIN BRIEF</span>
                            <span className="fp-reader-fresh">{formatArticleTime(article.publishedAt)}</span>
                        </div>
                    </div>

                    <ArticleImage article={article} className="fp-reader-img" vtName="fp-story" />

                    <div className="fp-reader-copy">
                        <p className="fp-reader-lede">{article.description}</p>

                        <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="fp-reader-continue"
                        >
                            <span>
                                <b>Continue reading at {article.source}</b>
                                <small className="fp-mono">FULL STORY · EXTERNAL SOURCE</small>
                            </span>
                            <ArrowUpRight size={20} />
                        </a>

                        {links.length > 0 && (
                            <div className="fp-reader-context">
                                <span className="fp-kicker fp-mono">MENTIONED IN THIS STORY</span>
                                <div className="fp-context-chips">
                                    {links.map((l) => (
                                        <Link key={l.to} to={l.to} className="fp-context-chip">
                                            <small className="fp-mono">{l.kind}</small>
                                            {l.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {related.length > 0 && (
                            <div className="fp-reader-related">
                                <span className="fp-kicker fp-mono">RELATED FROM THE PADDOCK</span>
                                {related.map((rel) => (
                                    <button
                                        key={rel.id}
                                        type="button"
                                        className="fp-related-row"
                                        onClick={() => onSwitch(rel)}
                                    >
                                        <span className="fp-related-title">{rel.title}</span>
                                        <span className="fp-related-meta fp-mono">
                                            {rel.source} · {readingTime(rel)} MIN
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Story cards at different editorial scales ─────────────────────── */

function StoryCard({ article, scale, onOpen, vtName }) {
    return (
        <article className={`fp-card fp-card--${scale}`}>
            <button type="button" className="fp-card-hit" onClick={() => onOpen(article)}>
                {scale !== "text" && (
                    <ArticleImage article={article} className="fp-card-img" vtName={vtName} />
                )}
                <div className="fp-card-copy">
                    <span className="fp-card-category fp-mono">F1 · {chapterFor(article).toUpperCase()}</span>
                    <h3 className="fp-card-title">{article.title}</h3>
                    {scale !== "small" && scale !== "text" && (
                        <p className="fp-card-desc">{article.description}</p>
                    )}
                    <div className="fp-card-meta fp-mono">
                        <span className="fp-source">{article.source}</span>
                        <span>{formatNewsDate(article.publishedAt)}</span>
                    </div>
                    <span className="fp-card-open fp-mono">
                        READ STORY <ArrowRight size={12} />
                    </span>
                </div>
            </button>
        </article>
    );
}

/* ── Loading skeleton — mirrors the real layout, not a bare spinner ── */

function NewsSkeleton() {
    return (
        <div className="fp-skeleton" aria-busy="true" aria-label="Loading the paddock">
            <div className="fp-band fp-band--light">
                <div className="fp-band-inner">
                    <div className="fp-sk fp-sk-cover" />
                    <div className="fp-sk fp-sk-line" style={{ width: "70%" }} />
                    <div className="fp-sk fp-sk-line" style={{ width: "45%" }} />
                </div>
            </div>
            <div className="fp-band fp-band--dark">
                <div className="fp-band-inner fp-deck">
                    <div className="fp-sk fp-sk-card" />
                    <div className="fp-sk fp-sk-card" />
                </div>
            </div>
        </div>
    );
}

/* ── Page ──────────────────────────────────────────────────────────── */

function NewsPage() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [active, setActive] = useState(null);
    const [transitionId, setTransitionId] = useState(null);
    const [retryTick, setRetryTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const fetchNews = async () => {
            try {
                const response = await fetch(`${API}/news`);
                const data = await response.json();
                if (!cancelled) setArticles(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setError("Failed to fetch news.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchNews();
        return () => { cancelled = true; };
    }, [retryTick]);

    const retry = () => {
        setLoading(true);
        setError("");
        setRetryTick((t) => t + 1);
    };

    const sorted = useMemo(
        () =>
            [...articles].sort(
                (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
            ),
        [articles]
    );

    /* categories are never invented — only chapter names that at least one
       real, currently-loaded article actually matches are offered */
    const categories = useMemo(() => {
        const present = new Set(sorted.map(chapterFor));
        return CHAPTERS.map((c) => c.name)
            .filter((name) => present.has(name))
            .concat(present.has(FALLBACK_CHAPTER) ? [FALLBACK_CHAPTER] : []);
    }, [sorted]);

    const searching = search.trim().length > 0;

    const filtered = sorted.filter((a) =>
        `${a.title} ${a.source}`.toLowerCase().includes(search.toLowerCase())
    );
    const categoryFiltered =
        activeCategory === "All" ? filtered : filtered.filter((a) => chapterFor(a) === activeCategory);

    const showCinematic = !searching && activeCategory === "All";
    const cover = showCinematic ? categoryFiltered[0] : null;
    const deck = showCinematic ? categoryFiltered.slice(1, 3) : [];
    const rest = showCinematic ? categoryFiltered.slice(3) : categoryFiltered;

    const byName = new Map();
    for (const article of rest) {
        const name = chapterFor(article);
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(article);
    }
    const chapters = [...byName.entries()];

    /* Shared-element unfold: the clicked card's photo carries the
       `fp-story` view-transition-name, the reader hero picks it up. */
    const withTransition = (mutate) => {
        if (document.startViewTransition) {
            document.startViewTransition(() => flushSync(mutate));
        } else {
            mutate();
        }
    };

    const openStory = (article) => {
        flushSync(() => setTransitionId(article.id));
        withTransition(() => setActive(article));
    };

    const closeStory = () => {
        withTransition(() => setActive(null));
    };

    const related = active
        ? sorted
            .filter((a) => a.id !== active.id && chapterFor(a) === chapterFor(active))
            .slice(0, 3)
        : [];

    /* only the card being opened/closed carries the shared name, and never
       while the reader is mounted (duplicate names cancel the transition) */
    const vtFor = (article) =>
        !active && transitionId === article.id ? "fp-story" : undefined;

    const selectCategory = (name) => setActiveCategory(name);

    return (
        <div className="fp">
            {/* ── Masthead (dark) ──────────────────────────────────── */}
            <header className="fp-masthead">
                <span className="fp-issue fp-mono">FORMULA 1 · NEWS</span>
                <h1 className="fp-title">The paddock, without the noise.</h1>
                <p className="fp-sub">
                    Current F1 stories, race developments and championship updates —
                    gathered from the paddock's own newsrooms.
                </p>

                <div className="fp-controls">
                    <SearchInput
                        placeholder="Headline or source…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search F1 news"
                        className="fp-search-input"
                    />
                    {categories.length > 0 && (
                        <div className="fp-filter-row" role="group" aria-label="Filter by category">
                            <button
                                type="button"
                                className={`fp-chip${activeCategory === "All" ? " fp-chip-active" : ""}`}
                                onClick={() => selectCategory("All")}
                            >
                                All
                            </button>
                            {categories.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    className={`fp-chip${activeCategory === name ? " fp-chip-active" : ""}`}
                                    onClick={() => selectCategory(name)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {loading && <NewsSkeleton />}

            {!loading && error && (
                <div className="fp-band fp-band--light">
                    <div className="fp-band-inner">
                        <EmptyState
                            onLight
                            title="Press room unreachable"
                            description="We couldn't load the news feed. Check your connection and try again."
                            action={<Button variant="dark" onClick={retry}>Retry</Button>}
                        />
                    </div>
                </div>
            )}

            {!loading && !error && (
                <>
                    {categoryFiltered.length === 0 ? (
                        <div className="fp-band fp-band--light">
                            <div className="fp-band-inner">
                                <EmptyState
                                    onLight
                                    title="Nothing on the wire"
                                    description={
                                        searching
                                            ? `No stories match "${search.trim()}".`
                                            : "No stories in this category right now."
                                    }
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ── Featured story (light) ───────────────── */}
                            {cover && (
                                <section className="fp-band fp-band--light" aria-label="Featured story">
                                    <div className="fp-band-inner">
                                        <span className="fp-section-title fp-mono">FEATURED STORY</span>
                                        <article className="fp-cover">
                                            <button type="button" className="fp-cover-hit" onClick={() => openStory(cover)}>
                                                <ArticleImage article={cover} className="fp-cover-img" vtName={vtFor(cover)} />
                                                <div className="fp-cover-copy">
                                                    <span className="fp-kicker fp-mono">
                                                        F1 · {chapterFor(cover).toUpperCase()}
                                                    </span>
                                                    <h2 className="fp-cover-title">{cover.title}</h2>
                                                    <p className="fp-cover-desc">{cover.description}</p>
                                                    <div className="fp-card-meta fp-mono">
                                                        <span className="fp-source">{cover.source}</span>
                                                        <span>{formatNewsDate(cover.publishedAt)}</span>
                                                        <span>{readingTime(cover)} MIN BRIEF</span>
                                                    </div>
                                                    <span className="fp-card-open fp-mono">
                                                        READ STORY <ArrowRight size={12} />
                                                    </span>
                                                </div>
                                            </button>
                                        </article>
                                    </div>
                                </section>
                            )}

                            {/* ── Secondary stories (dark) ─────────────── */}
                            {deck.length > 0 && (
                                <section className="fp-band fp-band--dark" aria-label="Secondary stories">
                                    <div className="fp-band-inner">
                                        <span className="fp-section-title fp-mono">SECONDARY STORIES</span>
                                        <div className="fp-deck">
                                            {deck.map((article) => (
                                                <StoryCard
                                                    key={article.id}
                                                    article={article}
                                                    scale="feature"
                                                    onOpen={openStory}
                                                    vtName={vtFor(article)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── Latest news / chapters (light) ───────── */}
                            <section className="fp-band fp-band--light">
                                <div className="fp-band-inner">
                                    <span className="fp-section-title fp-mono">
                                        {showCinematic ? "LATEST NEWS" : searching ? "SEARCH RESULTS" : "FILTERED"}
                                    </span>
                                    {chapters.map(([name, items], ci) => (
                                        <div className="fp-chapter" key={name}>
                                            <header className="fp-chapter-head">
                                                <span className="fp-chapter-num fp-mono">{ROMAN[ci] || ci + 1}</span>
                                                <div>
                                                    <h2 className="fp-chapter-title">{name}</h2>
                                                    <span className="fp-chapter-count fp-mono">
                                                        {items.length} STOR{items.length !== 1 ? "IES" : "Y"}
                                                    </span>
                                                </div>
                                            </header>
                                            <div className="fp-chapter-grid">
                                                {items.map((article, i) => (
                                                    <StoryCard
                                                        key={article.id}
                                                        article={article}
                                                        scale={i === 0 ? "lead" : i <= 2 ? "small" : "text"}
                                                        onOpen={openStory}
                                                        vtName={vtFor(article)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}

                    <footer className="fp-band fp-band--dark">
                        <p className="fp-colophon fp-mono" aria-hidden="true">
                            — END OF THIS ISSUE · NEW DISPATCHES ARRIVE DAILY —
                        </p>
                    </footer>
                </>
            )}

            {active && (
                <Reader
                    article={active}
                    related={related}
                    onClose={closeStory}
                    onSwitch={(a) => {
                        setTransitionId(a.id);
                        setActive(a);
                    }}
                />
            )}
        </div>
    );
}

export default NewsPage;
