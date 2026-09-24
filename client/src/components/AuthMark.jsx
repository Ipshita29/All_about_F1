/*
 * A subtle technical mark for the auth brand panel — sector ticks along a
 * lap line, not a race photo or a logo. Reinforces "F1 data product"
 * without competing with the form for attention.
 */
export default function AuthMark() {
    return (
        <svg className="jg-mark" viewBox="0 0 260 90" fill="none" aria-hidden="true">
            <line x1="4" y1="45" x2="256" y2="45" stroke="currentColor" strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
            <path d="M4 45 L70 45 L92 12 L168 12 L190 45 L256 45" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <circle cx="70" cy="45" r="2.5" fill="currentColor" />
            <circle cx="92" cy="12" r="2.5" fill="currentColor" />
            <circle cx="168" cy="12" r="2.5" fill="currentColor" />
            <circle cx="190" cy="45" r="2.5" fill="currentColor" />
            <text x="66" y="66" className="jg-mark-tag">S1</text>
            <text x="120" y="6" className="jg-mark-tag">S2</text>
            <text x="186" y="66" className="jg-mark-tag">S3</text>
        </svg>
    );
}
