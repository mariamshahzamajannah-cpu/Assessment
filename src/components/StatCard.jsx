export default function StatCard({ label, value, flag = false }) {
  return (
    <div className={"stat-card" + (flag ? " flag" : "")}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
