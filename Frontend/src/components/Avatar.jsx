function initials(name) {
  if (!name || name === "—") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic accent pick from the existing palette, keyed off the id so a
// given member always renders the same tint across pages.
const ACCENTS = ["var(--case-red)", "var(--brass)", "var(--evidence-green)"];

function accentFor(seed) {
  if (!seed) return ACCENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}

export default function Avatar({ name, seed, size = "md" }) {
  const color = accentFor(seed || name || "");
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ "--avatar-color": color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
