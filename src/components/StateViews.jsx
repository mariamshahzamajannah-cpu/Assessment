export function Loading({ label = "Loading case file…" }) {
  return <div className="loading-state">{label}</div>;
}

export function ErrorState({ error }) {
  if (!error) return null;
  return <div className="error-state">{error.message || String(error)}</div>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
