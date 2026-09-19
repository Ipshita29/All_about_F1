export default function ConstructorRoster({ children }) {
    return (
        <ol className="cp-list" aria-label="Constructor roster">
            {children}
        </ol>
    );
}
