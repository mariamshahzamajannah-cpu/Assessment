import { riskLevel } from "../utils/format.js";

export default function RiskBadge({ memberCount }) {
  const level = riskLevel(memberCount);
  const label = level === "high" ? "High risk" : level === "medium" ? "Elevated" : "Watch";
  return <span className={`badge risk-${level}`}>{label}</span>;
}
