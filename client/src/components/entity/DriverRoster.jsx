export default function DriverRoster({ children }) {
    return (
        <ol className="dp-grid" aria-label="Driver roster">
            {children}
        </ol>
    );
}
