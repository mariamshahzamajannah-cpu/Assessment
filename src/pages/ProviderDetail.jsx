import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney, formatDate } from "../utils/format.js";

function normalizeProviderDetail(data, fallbackId) {
  if (!data || typeof data !== "object") return null;

  const p = data.provider && typeof data.provider === "object" ? data.provider : data;
  const rawClaims = Array.isArray(data.claims) ? data.claims : [];
  const claims = rawClaims.map((row, index) => {
    const c = row.claim && typeof row.claim === "object" ? row.claim : row;
    const m = row.member && typeof row.member === "object" ? row.member : c.member ?? {};
    const first = m.firstName ?? m.first_name ?? "";
    const last = m.lastName ?? m.last_name ?? "";
    const memberName = [first, last].filter(Boolean).join(" ") || m.name || row.memberName || null;

    return {
      id: c.id ?? c.claimId ?? `claim-${index}`,
      claimNumber: c.claimNumber ?? c.claim_number ?? c.id ?? null,
      memberId: c.memberId ?? row.memberId ?? m.id ?? null,
      memberName,
      amount: c.amount ?? row.amount ?? null,
      filedDate: c.filedDate ?? c.dateFiled ?? c.date_filed ?? null,
      status: c.status ?? null,
      diagnosis: c.diagnosis ?? c.diagnosisCode ?? c.diagnosis_code ?? null,
    };
  });

  return {
    id: p.id ?? p.providerId ?? fallbackId,
    name: p.name ?? p.providerName ?? "Unknown provider",
    specialty: p.specialty ?? p.speciality ?? null,
    npi: p.npi ?? p.NPI ?? null,
    claims,
  };
}

export default function ProviderDetail() {
  const { id } = useParams();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getProvider(id);
        if (!cancelled) setProvider(normalizeProviderDetail(data, id));
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading label="Opening provider file…" />;
  if (error) return <ErrorState error={error} />;
  if (!provider) return <EmptyState>Provider not found.</EmptyState>;

  const claims = provider.claims || [];

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/providers">Providers</Link> / {provider.id}
      </div>
      <header className="page-header">
        <h1>{provider.name}</h1>
        <p>
          {provider.specialty || "Specialty unknown"}
          {provider.npi ? ` · NPI ${provider.npi}` : ""}
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{claims.length}</div>
          <div className="stat-label">Claims on file</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {formatMoney(claims.reduce((sum, c) => sum + (Number(c.amount) || 0), 0))}
          </div>
          <div className="stat-label">Total billed</div>
        </div>
      </div>

      <h2 className="section-title">Claims filed against this provider</h2>
      <div className="card">
        {claims.length === 0 ? (
          <EmptyState>No claims recorded for this provider.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Member</th>
                <th>Amount</th>
                <th>Filed</th>
                <th>Status</th>
                <th>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.claimNumber || c.id}</td>
                  <td>
                    {c.memberId ? (
                      <Link className="plain-link" to={`/members/${c.memberId}`}>
                        {c.memberName || c.memberId}
                      </Link>
                    ) : (
                      c.memberName || "—"
                    )}
                  </td>
                  <td>{formatMoney(c.amount)}</td>
                  <td>{formatDate(c.filedDate)}</td>
                  <td>{c.status || "—"}</td>
                  <td>{c.diagnosis || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
