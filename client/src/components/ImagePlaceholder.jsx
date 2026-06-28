function ImagePlaceholder({ name = "", color = "#E10600", type = "driver", className = "" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  const icons = {
    driver: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="ph-icon">
        <circle cx="12" cy="7" r="4" />
        <path d="M12 13c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z" />
      </svg>
    ),
    team: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="ph-icon">
        <path d="M3 17h18v2H3v-2zm1-3l2-6h12l2 6H4zm3-4l-1 4h12l-1-4H7zm5-7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
      </svg>
    ),
    circuit: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="ph-icon">
        <path d="M17 3H7C5.3 3 4 4.3 4 6v12c0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3V6c0-1.7-1.3-3-3-3zm1 15c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V6c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v12z" />
        <path d="M8 8h8v2H8zm0 4h5v2H8zm0 4h3v2H8z" />
      </svg>
    ),
  };

  return (
    <div className={`img-placeholder img-placeholder--${type} ${className}`} style={{ "--ph-color": color }}>
      <div className="ph-inner">
        {icons[type]}
        <span className="ph-initials">{initials}</span>
      </div>
    </div>
  );
}

export default ImagePlaceholder;
