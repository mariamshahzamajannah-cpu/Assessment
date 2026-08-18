import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney } from "../utils/format.js";

function normalizeDashboard(data) {
  if (!data || typeof data !== "object") {
    return {
      totalMembers: 0,
      totalProviders: 0,
      totalClaims: 0,
      totalClaimAmount: 0,
      fraudRingCount: 0,
      topProviders: [],
    };
  }

  const rawTop =
    data.topProviders ??
    data.top_providers ??
    data.providers ??
    data.topProviderList ??
    [];

  const topProviders = (Array.isArray(rawTop) ? rawTop : []).map((row, index) => {
    // Same nested shape as /api/providers: { provider: {...}, claimCount, totalAmount }
    const p = row.provider && typeof row.provider === "object" ? row.provider : row;

    return {
      id: p.id ?? p.providerId ?? row.providerId ?? `provider-${index}`,
      name: p.name ?? p.providerName ?? "—",
      specialty: p.specialty ?? p.speciality ?? "—",
      claimCount: row.claimCount ?? p.claimCount ?? row.claim_count ?? 0,
      totalAmount: row.totalAmount ?? p.totalAmount ?? row.total_amount ?? 0,
    };
  });

  return {
    totalMembers: data.totalMembers ?? data.total_members ?? data.memberCount ?? 0,
    totalProviders: data.totalProviders ?? data.total_providers ?? data.providerCount ?? 0,
    totalClaims: data.totalClaims ?? data.total_claims ?? data.claimCount ?? 0,
    totalClaimAmount:
      data.totalClaimAmount ??
      data.total_claim_amount ??
      data.totalClaimedAmount ??
      data.totalAmount ??
      0,
    fraudRingCount:
      data.fraudRingCount ??
      data.fraud_ring_count ??
      data.flaggedRingCount ??
      data.ringCount ??
      0,
    topProviders,
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getDashboardStats();
        console.log("dashboard API response:", data);
        const normalized = normalizeDashboard(data);
        if (!cancelled) setStats(normalized);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Portfolio overview and highest-volume providers across the claims graph.</p>
      </header>

      {loading && <Loading label="Pulling portfolio stats…" />}
      <ErrorState error={error} />

      {stats && (
        <>
          <div className="stat-grid">
            <StatCard label="Members" value={stats.totalMembers ?? "—"} />
            <StatCard label="Providers" value={stats.totalProviders ?? "—"} />
            <StatCard label="Claims" value={stats.totalClaims ?? "—"} />
            <StatCard
              label="Total claim amount"
              value={formatMoney(stats.totalClaimAmount)}
              flag={(stats.totalClaimAmount ?? 0) > 500000}
            />
            <StatCard
              label="Fraud rings detected"
              value={stats.fraudRingCount ?? "—"}
              flag={(stats.fraudRingCount ?? 0) > 0}
            />
          </div>

          <h2 className="section-title">Top providers by claim volume</h2>
          <div className="card">
            {!stats.topProviders?.length ? (
              <EmptyState>No provider volume data yet.</EmptyState>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Specialty</th>
                    <th>Claims</th>
                    <th>Total amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProviders.map((p) => (
                    <tr key={p.id} className="link-row">
                      <td>
                        <Link className="plain-link" to={`/providers/${p.id}`}>
                          {p.name}
                        </Link>
                      </td>
                      <td>{p.specialty || "—"}</td>
                      <td>{p.claimCount ?? 0}</td>
                      <td>{formatMoney(p.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
