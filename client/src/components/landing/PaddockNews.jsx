/*
 * FROM THE PADDOCK — quiet editorial news section: one featured story plus
 * three supporting stories, powered by the existing /news backend route.
 * Articles mentioning the logged-in user's favourite driver or team get a
 * restrained FOR YOU tag.
 */
import { Link } from "react-router-dom";
import { articleIsForYou, formatArticleTime } from "../../utils/landingHelpers";

function ArticleImage({ article, className }) {
    /* NewsAPI images are external; hide the frame if one fails instead of
       showing a broken placeholder. */
    return (
        <div className={className}>
            <img
                src={article.image}
                alt=""
                loading="lazy"
                onError={(e) => {
                    e.target.closest("div").classList.add("is-imgless");
                }}
            />
        </div>
    );
}

function ForYouTag() {
    return <span className="lp-news-foryou">FOR YOU</span>;
}

export default function PaddockNews({ articles, favs, error }) {
    if (error) {
        return (
            <section className="lp-section lp-news" aria-label="Formula 1 news">
                <header className="lp-section-head">
                    <span className="lp-section-eyebrow">LATEST STORIES</span>
                    <h2 className="lp-section-title">FROM THE PADDOCK</h2>
                </header>
                <p className="lp-inline-state lp-mono">
                    NEWS FEED UNAVAILABLE — COULD NOT REACH THE NEWS SERVER
                </p>
            </section>
        );
    }

    if (!articles?.length) return null;

    const [featured, ...rest] = articles;
    const supporting = rest.slice(0, 3);

    return (
        <section className="lp-section lp-news" aria-label="Formula 1 news">
            <header className="lp-section-head lp-news-head">
                <div>
                    <span className="lp-section-eyebrow">LATEST STORIES</span>
                    <h2 className="lp-section-title">FROM THE PADDOCK</h2>
                </div>
                <Link to="/news" className="lp-cta">
                    VIEW ALL STORIES <span aria-hidden="true">→</span>
                </Link>
            </header>

            <div className="lp-news-grid">
                <a
                    href={featured.url}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-news-featured"
                >
                    <ArticleImage article={featured} className="lp-news-featured-img" />
                    <div className="lp-news-featured-body">
                        <p className="lp-news-meta lp-mono">
                            {featured.source?.toUpperCase()} · {formatArticleTime(featured.publishedAt)}
                            {articleIsForYou(featured, favs) && <ForYouTag />}
                        </p>
                        <h3 className="lp-news-featured-title">{featured.title}</h3>
                        {featured.description && (
                            <p className="lp-news-featured-desc">{featured.description}</p>
                        )}
                        <span className="lp-news-readmore lp-mono">READ STORY →</span>
                    </div>
                </a>

                <div className="lp-news-side">
                    {supporting.map((article) => (
                        <a
                            key={article.id}
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="lp-news-item"
                        >
                            <ArticleImage article={article} className="lp-news-item-img" />
                            <div className="lp-news-item-body">
                                <p className="lp-news-meta lp-mono">
                                    {article.source?.toUpperCase()} ·{" "}
                                    {formatArticleTime(article.publishedAt)}
                                    {articleIsForYou(article, favs) && <ForYouTag />}
                                </p>
                                <h3 className="lp-news-item-title">{article.title}</h3>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
