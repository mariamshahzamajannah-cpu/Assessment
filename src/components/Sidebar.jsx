import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api/client.js";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/fraud-rings", label: "Fraud Rings" },
  { to: "/members", label: "Members" },
  { to: "/providers", label: "Providers" },
];

export default function Sidebar() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const result = await api.health();
        if (!cancelled) setHealth(result);
      } catch {
        if (!cancelled) setHealth({ status: "degraded", database: "unreachable" });
      }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const ok = health?.status === "ok";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        Claims Ring
        <small>Investigation Console</small>
      </div>
      <nav className="sidebar-nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-status" title={health?.error || ""}>
        <span className={"status-dot" + (ok ? "" : " degraded")} />
        {health ? (ok ? "Database connected" : "Database unreachable") : "Checking connection…"}
      </div>
    </aside>
  );
}
