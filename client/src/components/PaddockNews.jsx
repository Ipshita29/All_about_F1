/*
 * FROM THE PADDOCK — quiet editorial news section on a light Cararra
 * surface: one featured story with a fixed-ratio image, three text-only
 * supporting stories (no random image dimensions dictating layout).
 * Articles are filtered to exclude stories that are clearly about a
 * different racing series (see isRelevantF1Article) before display.
 */
import SectionHeader from "./SectionHeader";
import Button from "./Button";
import { articleIsForYou, formatArticleTime, isRelevantF1Article } from "../utils/landingHelpers";

function ForYouTag() {
    return <span className="lp-news-foryou">FOR YOU</span>;
}

export default function PaddockNews({ articles, favs, error }) {
    const relevant = (articles || []).filter(isRelevantF1Article);

    if (error) {
        return (
            <section className="news" aria-label="Formula 1 news">
                <SectionHeader onLight eyebrow="LATEST STORIES" title="From The Paddock" />
                <p className="lp-inline-state">NEWS FEED UNAVAILABLE — COULD NOT REACH THE NEWS SERVER</p>
            </section>
        );
    }

    if (!relevant.length) return null;

    const [featured, ...rest] = relevant;
    const supporting = rest.slice(0, 3);

    return (
        <section className="news" aria-label="Formula 1 news">
            <div className="news-head">
                <SectionHeader onLight eyebrow="LATEST STORIES" title="From The Paddock" />
                <Button variant="secondary" to="/news" arrow>View All Stories</Button>
            </div>

            <div className="news-grid">
                <a href={featured.url} target="_blank" rel="noreferrer" className="news-featured">
                    <div className="news-featured-img">
                        <img
                            src={featured.image}
                            alt=""
                            loading="lazy"
                            onError={(e) => { e.target.closest("div").classList.add("is-imgless"); }}
                        />
                    </div>
                    <div className="news-featured-body">
                        <p className="news-meta">
                            {featured.source?.toUpperCase()} · {formatArticleTime(featured.publishedAt)}
                            {articleIsForYou(featured, favs) && <ForYouTag />}
                        </p>
                        <h3 className="news-featured-title">{featured.title}</h3>
                        {featured.description && <p className="news-featured-desc">{featured.description}</p>}
                        <span className="news-readmore">READ STORY →</span>
                    </div>
                </a>

                <div className="news-side">
                    {supporting.map((article) => (
                        <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className="news-item">
                            <p className="news-meta">
                                {article.source?.toUpperCase()} · {formatArticleTime(article.publishedAt)}
                                {articleIsForYou(article, favs) && <ForYouTag />}
                            </p>
                            <h3 className="news-item-title">{article.title}</h3>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
