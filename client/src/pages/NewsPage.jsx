import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";

function formatNewsDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function NewsPage() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const response = await fetch("http://localhost:3000/news");
                const data = await response.json();

                setArticles(data);
            } catch (err) {
                setError("Failed to fetch news.");
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    if (loading) return <div className="loading"><LoadingSpinner label="Loading News..." /></div>;
    if (error) return <h2>{error}</h2>;

    const filtered = articles.filter((a) =>
        `${a.title} ${a.source}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page">
            <h1>F1 News</h1>
            <div className="page-controls">
                <input
                    type="text"
                    placeholder="Search news..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p>{filtered.length} article{filtered.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="list-grid news-grid">
                {filtered.map((article) => (
                    <div key={article.id} className="list-card news-card">
                        <div className="news-card-img">
                            <img
                                src={article.image}
                                alt={article.title}
                                onError={(e) => { e.target.src = "https://via.placeholder.com/800x450?text=Formula+1+News"; }}
                            />
                        </div>
                        <div className="news-card-body">
                            <h3>{article.title}</h3>
                            <p>{article.description}</p>
                            <div className="news-card-meta">
                                <span className="news-source-badge">{article.source}</span>
                                <span className="list-date">{formatNewsDate(article.publishedAt)}</span>
                            </div>
                            <a href={article.url} target="_blank" rel="noreferrer" className="news-read-link">
                                Read Full Article <ArrowRight size={12} />
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NewsPage;
