import { Button } from "../components/UI";

function NotFound() {
    return (
        <div className="ex">
            <main className="ex-main" style={{ display: "flex", justifyContent: "center", padding: "var(--space-9) var(--space-6)" }}>
                <div className="empty-state">
                    <span className="empty-state-title" style={{ fontSize: "var(--text-h1)", fontFamily: "var(--font-mono)" }}>404</span>
                    <h1 className="empty-state-title">Page not found</h1>
                    <p className="empty-state-desc">The page you're looking for doesn't exist or has moved.</p>
                    <div className="empty-state-action">
                        <Button variant="primary" to="/" arrow>Back to Overview</Button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default NotFound;
