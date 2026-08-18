import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney } from "../utils/format.js";

function normalizeProviders(data) {
  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.providers)) {
    list = data.providers;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  } else if (Array.isArray(data?.content)) {
    list = data.content;
  }

  return list.map((row, index) => {
    // Backend shape: { provider: { id, name, npi, specialty }, claimCount, totalAmount, ... }
    const p = row.provider && typeof row.provider === "object" ? row.provider : row;

    return {
      id: p.id ?? p.providerId ?? row.providerId ?? `provider-${index}`,
      name: p.name ?? p.providerName ?? "—",
      specialty: p.specialty ?? p.speciality ?? "—",
      npi: p.npi ?? p.NPI ?? "—",
      claimCount: row.claimCount ?? p.claimCount ?? row.claim_count ?? null,
      totalAmount: row.totalAmount ?? p.totalAmount ?? row.total_amount ?? null,
      memberCount: row.memberCount ?? null,
    };
  });
}

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.listProviders();
        const list = normalizeProviders(data);
        if (!cancelled) setProviders(list);
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
        <h1>Providers</h1>
        <p>
          Clinics and practitioners appearing in the claims graph. Open a record to review every
          claim filed against them.
        </p>
      </header>

      {loading && <Loading label="Loading provider roster…" />}
      <ErrorState error={error} />

      {!loading && providers.length === 0 && !error && (
        <EmptyState>No providers found in the graph.</EmptyState>
      )}

      {!loading && providers.length > 0 && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Specialty</th>
                <th>NPI</th>
                <th>Claims</th>
                <th>Total amount</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className="link-row"
                  onClick={() => navigate(`/providers/${p.id}`)}
                >
                  <td>
                    <Link
                      className="plain-link"
                      to={`/providers/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.specialty || "—"}</td>
                  <td>{p.npi || "—"}</td>
                  <td>{p.claimCount ?? "—"}</td>
                  <td>{formatMoney(p.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}