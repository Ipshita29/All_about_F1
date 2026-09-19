import { Link } from "react-router-dom";

/* A restrained editorial link into the comparison tool — never a button. */
export default function ComparisonCTA({ to, label }) {
    return (
        <Link to={to} className="cta-link">
            {label} <span aria-hidden="true">→</span>
        </Link>
    );
}
