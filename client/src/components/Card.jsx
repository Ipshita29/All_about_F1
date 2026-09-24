import { Link } from "react-router-dom";

/*
 * Shared card system — variants: dark (default, sits on the canvas) /
 * light (Cararra panel, high-contrast) / minimal (quiet outlined panel,
 * no fill). Renders a <Link> when given `to`, otherwise a <div>.
 *
 *   <Card variant="light">
 *     <Card.Media src={...} alt="" />
 *     <Card.Body>
 *       <Card.Title>Baku City Circuit</Card.Title>
 *       <Card.Desc>...</Card.Desc>
 *     </Card.Body>
 *   </Card>
 */
export default function Card({ variant = "dark", to, className = "", children, ...rest }) {
    const classes = `card card-${variant}${className ? ` ${className}` : ""}`;

    if (to) {
        return (
            <Link to={to} className={classes} {...rest}>
                {children}
            </Link>
        );
    }

    return (
        <div className={classes} {...rest}>
            {children}
        </div>
    );
}

Card.Media = function CardMedia({ className = "", ...rest }) {
    return <div className={`card-media${className ? ` ${className}` : ""}`} {...rest} />;
};

Card.Body = function CardBody({ className = "", children, ...rest }) {
    return (
        <div className={`card-body${className ? ` ${className}` : ""}`} {...rest}>
            {children}
        </div>
    );
};

Card.Title = function CardTitle({ className = "", children, ...rest }) {
    return (
        <h3 className={`card-title${className ? ` ${className}` : ""}`} {...rest}>
            {children}
        </h3>
    );
};

Card.Desc = function CardDesc({ className = "", children, ...rest }) {
    return (
        <p className={`card-desc${className ? ` ${className}` : ""}`} {...rest}>
            {children}
        </p>
    );
};
