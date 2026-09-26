/*
 * FROM THE PADDOCK — the news feed as a premium F1 media-browsing page,
 * not an online magazine. A dark masthead leads into one large featured
 * story, then Netflix-style horizontal carousels: "Latest News" plus one
 * row per category, each computed from real article content (never
 * invented) and doubling as the same non-fake category filter this page
 * has always had. Selecting a category or searching collapses the rows
 * into a single flat grid of that result set. Opening a story unfolds an
 * in-page reader (no route change) via a shared-element view transition,
 * with a reading progress bar, contextual driver/team links and editorial
 * recommendations. Same /news endpoint, search and reader mechanics as
 * before; only the browsing layout changes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SearchInput, EmptyState, Button } from "../components/UI";
import {
    DRIVER_ID_MAP,
    FAV_TEAM_TO_CONSTRUCTOR_ID,
    formatArticleTime,
    getNewsImage,
} from "../utils/landingHelpers";
import "../styles/pages/NewsPage.css";
import { API_BASE_URL as API } from "../config/api";


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

/* ── Article photography with a styled local fallback ─────────────── */

function ArticleImage({ article, className, vtName }) {
    const [failed, setFailed] = useState(false);
    const src = getNewsImage(article);
    if (!src || failed) {
        return (
            <div
                className={`fp-img fp-img--missing ${className || ""}`}
                style={vtName ? { viewTransitionName: vtName } : undefined}
                aria-hidden="true"
            >
                <span className="fp-img-missing-mark fp-mono">F1</span>
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
                src={src}
                alt={article.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    setFailed(true);
                }}
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

/* ── Compact media card — the carousel unit ───────────────────────────
   A media-library card, not a miniature article: image, category,
   a two-line-clamped headline, source/date. No description — that's
   what the reader is for. Fixed dimensions (width + aspect-ratio, both
   in CSS) so every card in a row is visually identical regardless of
   headline length. ─────────────────────────────────────────────────── */

function CarouselCard({ article, onOpen, vtName }) {
    return (
        <article className="fp-reel-card">
            <button type="button" className="fp-reel-hit" onClick={() => onOpen(article)}>
                <ArticleImage article={article} className="fp-reel-img" vtName={vtName} />
                <div className="fp-reel-copy">
                    <span className="fp-reel-category fp-mono">F1 · {chapterFor(article).toUpperCase()}</span>
                    <h3 className="fp-reel-title">{article.title}</h3>
                    <div className="fp-reel-meta fp-mono">
                        <span className="fp-source">{article.source}</span>
                        <span>{formatNewsDate(article.publishedAt)}</span>
                        <ArrowUpRight size={13} className="fp-reel-arrow-hint" aria-hidden="true" />
                    </div>
                </div>
            </button>
        </article>
    );
}

/* ── Netflix-style horizontal row — CSS overflow-x scrolling, plain
   React state for the arrow controls, no carousel dependency. Arrows
   only render once there's somewhere to scroll to/from, computed from
   the track's own scroll metrics (cards have a fixed width and the
   image area reserves its height via aspect-ratio, so this is accurate
   immediately on mount rather than shifting once images finish loading). */
function CarouselRow({ title, articles, onOpen, vtFor }) {
    const trackRef = useRef(null);
    const [scrollState, setScrollState] = useState({ left: false, right: false });

    const updateScrollState = () => {
        const el = trackRef.current;
        if (!el) return;
        setScrollState({
            left: el.scrollLeft > 4,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
        });
    };

    useEffect(() => {
        updateScrollState();
        window.addEventListener("resize", updateScrollState);
        return () => window.removeEventListener("resize", updateScrollState);
    }, [articles]);

    if (articles.length === 0) return null;

    const scrollBy = (dir) => {
        trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.85, behavior: "smooth" });
    };

    return (
        <div className="fp-reel">
            <h2 className="fp-reel-heading">{title}</h2>
            <div className="fp-reel-viewport">
                <div className="fp-reel-track" ref={trackRef} onScroll={updateScrollState}>
                    {articles.map((article) => (
                        <CarouselCard key={article.id} article={article} onOpen={onOpen} vtName={vtFor(article)} />
                    ))}
                </div>
                {scrollState.left && (
                    <button type="button" className="fp-reel-arrow fp-reel-arrow--left" onClick={() => scrollBy(-1)} aria-label={`Scroll ${title} left`}>
                        <ChevronLeft size={20} />
                    </button>
                )}
                {scrollState.right && (
                    <button type="button" className="fp-reel-arrow fp-reel-arrow--right" onClick={() => scrollBy(1)} aria-label={`Scroll ${title} right`}>
                        <ChevronRight size={20} />
                    </button>
                )}
            </div>
        </div>
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
            <div className="fp-band fp-band--light">
                <div className="fp-band-inner fp-sk-reel">
                    <div className="fp-sk fp-sk-card" />
                    <div className="fp-sk fp-sk-card" />
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
    const latestNews = showCinematic ? categoryFiltered.slice(1) : [];

    /* Category rows draw from the full filtered set (not "whatever's left
       after Latest News") — a story can legitimately appear in both its
       own category's row and the general Latest News row, same as any
       genre-row browsing UI. */
    const byName = new Map();
    for (const article of categoryFiltered) {
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
                        /* Featured story + all browsing rows share one light
                           band — two separate bands here meant two lots of
                           vertical band padding stacking into a ~128px gap
                           between "Featured Story" and "Latest News", which
                           read as exactly the kind of dead space this page
                           was rebuilt to get rid of. */
                        <section className="fp-band fp-band--light">
                            <div className="fp-band-inner fp-news-body">
                                {cover && (
                                    <section aria-label="Featured story">
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
                                    </section>
                                )}

                                <div className="fp-reels">
                                    {showCinematic ? (
                                        <>
                                            <CarouselRow title="Latest News" articles={latestNews} onOpen={openStory} vtFor={vtFor} />
                                            {chapters.map(([name, items]) => (
                                                <CarouselRow key={name} title={name} articles={items} onOpen={openStory} vtFor={vtFor} />
                                            ))}
                                        </>
                                    ) : (
                                        <div className="fp-reel">
                                            <h2 className="fp-reel-heading">{searching ? "Search Results" : activeCategory}</h2>
                                            <div className="fp-reel-grid">
                                                {categoryFiltered.map((article) => (
                                                    <CarouselCard key={article.id} article={article} onOpen={openStory} vtName={vtFor(article)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
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
