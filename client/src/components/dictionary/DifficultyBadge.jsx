function DifficultyBadge({ level }) {
  if (!level) return null;
  const cls = level.toLowerCase();
  return <span className={`fd-badge fd-badge-${cls}`}>{level}</span>;
}

export default DifficultyBadge;
