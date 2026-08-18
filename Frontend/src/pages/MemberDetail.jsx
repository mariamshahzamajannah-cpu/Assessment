import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import Avatar from "../components/Avatar.jsx";
import RiskBadge from "../components/RiskBadge.jsx";
import GraphView from "../components/GraphView.jsx";
import StatCard from "../components/StatCard.jsx";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney, formatDate } from "../utils/format.js";

/**
 * Backend shape (MembersController#getMember -> MemberDetail):
 *   {
 *     member: { id, firstName, lastName, dob, ssnLast4, createdAt },
 *     policies: [{ id, type, startDate, premiumMonthly, status }],
 *     claims: [{ id, amount, dateOfService, dateFiled, status, diagnosisCode, providerName, providerId }],
 *     sharedConnections: [{ member: {...Member}, sharedKind, sharedLabel }]
 *   }
 * sharedConnections is the fraud-relevant bit: OTHER members who share an
 * address, bank account, or phone with this one. A couple of alternate/nested
 * shapes are still handled defensively.
 */
function normalizeMember(data, fallbackId) {
  if (!data || typeof data !== "object") return null;

  const m = data.member && typeof data.member === "object" ? data.member : data;

  const first = m.firstName ?? m.first_name ?? "";
  const last = m.lastName ?? m.last_name ?? "";
  const name = [first, last].filter(Boolean).join(" ") || m.name || m.memberName || "—";

  const policiesRaw = data.policies ?? m.policies ?? [];
  const policies = (Array.isArray(policiesRaw) ? policiesRaw : []).map((row, i) => {
    const p = row.policy && typeof row.policy === "object" ? row.policy : row;
    return {
      id: p.id ?? p.policyId ?? `pol-${i}`,
      type: p.type ?? p.policyType ?? "—",
      status: p.status ?? null,
      startDate: p.startDate ?? p.start_date ?? null,
      premiumMonthly: p.premiumMonthly ?? p.premium_monthly ?? null,
    };
  });

  const claimsRaw = data.claims ?? m.claims ?? [];
  const claims = (Array.isArray(claimsRaw) ? claimsRaw : []).map((row, i) => {
    const c = row.claim && typeof row.claim === "object" ? row.claim : row;
    return {
      id: c.id ?? c.claimId ?? `clm-${i}`,
      amount: c.amount ?? row.amount ?? null,
      dateOfService: c.dateOfService ?? c.date_of_service ?? null,
      dateFiled: c.dateFiled ?? c.filedDate ?? c.date_filed ?? null,
      status: c.status ?? null,
      diagnosisCode: c.diagnosisCode ?? c.diagnosis_code ?? null,
      providerId: c.providerId ?? row.providerId ?? null,
      providerName: c.providerName ?? row.providerName ?? null,
    };
  });

  const sharedRaw = data.sharedConnections ?? data.shared_connections ?? m.sharedConnections ?? [];
  const sharedConnections = (Array.isArray(sharedRaw) ? sharedRaw : []).map((row, i) => {
    const other = row.member && typeof row.member === "object" ? row.member : row.other ?? {};
    const otherFirst = other.firstName ?? other.first_name ?? "";
    const otherLast = other.lastName ?? other.last_name ?? "";
    const otherName = [otherFirst, otherLast].filter(Boolean).join(" ") || other.name || "—";

    return {
      key: `${other.id ?? i}-${row.sharedKind ?? row.kind ?? i}`,
      memberId: other.id ?? other.memberId ?? null,
      memberName: otherName,
      kind: row.sharedKind ?? row.kind ?? row.sharedType ?? "Identity",
      label: row.sharedLabel ?? row.label ?? row.sharedValue ?? "—",
    };
  });

  return {
    id: m.id ?? m.memberId ?? data.id ?? fallbackId,
    name,
    dob: m.dob ?? m.dateOfBirth ?? m.date_of_birth ?? null,
    ssnLast4: m.ssnLast4 ?? m.ssn_last4 ?? m.ssn ?? null,
    createdAt: m.createdAt ?? m.created_at ?? null,
    policies,
    claims,
    sharedConnections,
  };
}

function normalizeNetwork(data) {
  if (!data || typeof data !== "object") {
    return { nodes: [], edges: [] };
  }

  const nodesRaw = data.nodes ?? [];
  const edgesRaw = data.edges ?? [];

  const nodes = (Array.isArray(nodesRaw) ? nodesRaw : []).map((n, i) => ({
    id: n.id ?? `node-${i}`,
    labels: Array.isArray(n.labels) ? n.labels : n.label ? [n.label] : [],
    caption: n.caption ?? n.id ?? "—",
  }));

  const edges = (Array.isArray(edgesRaw) ? edgesRaw : []).map((e, i) => ({
    id: e.id ?? `edge-${i}`,
    source: e.source,
    target: e.target,
    type: e.type ?? "",
  }));

  return { nodes, edges };
}

const KIND_LABEL = {
  Address: "Shared address",
  BankAccount: "Shared bank account",
  Phone: "Shared phone",
};

function connectionIcon(kind) {
  if (kind === "Address") {
    return (
      <path d="M3 9.5 10 4l7 5.5V17a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z" />
    );
  }
  if (kind === "BankAccount") {
    return (
      <path d="M10 3 2 7v1.5h16V7zM3.5 9.5v6H5v-6zm4 0v6h1.5v-6zm4 0v6h1.5v-6zm4 0v6H17v-6zM2 16.5h16V18H2z" />
    );
  }
  return (
    <path d="M6 3h5l1 3-2 1.5a9 9 0 0 0 4.5 4.5L16 10l3 1v5c0 .8-.7 1.4-1.5 1.3C10.8 16.4 4.6 10.2 3.7 4.5 3.6 3.7 4.2 3 5 3z" />
  );
}

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [network, setNetwork] = useState(null);
  const [hops, setHops] = useState(2);
  const [error, setError] = useState(null);
  const [netError, setNetError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [netLoading, setNetLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getMember(id);
        const normalized = normalizeMember(data, id);
        if (!cancelled) setMember(normalized);
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setNetLoading(true);
      setNetError(null);
      try {
        const data = await api.getMemberNetwork(id, hops);
        const normalized = normalizeNetwork(data);
        if (!cancelled) setNetwork(normalized);
      } catch (err) {
        if (!cancelled) setNetError(err);
      } finally {
        if (!cancelled) setNetLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, hops]);

  if (loading) return <Loading label="Opening member dossier…" />;
  if (error) return <ErrorState error={error} />;
  if (!member) return <EmptyState>Member not found.</EmptyState>;

  const policies = member.policies || [];
  const claims = member.claims || [];
  const shared = member.sharedConnections || [];
  const totalBilled = claims.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/members">Members</Link> / {member.id}
      </div>

      <header className="page-header member-header">
        <Avatar name={member.name} seed={member.id} size="lg" />
        <div>
          <h1>{member.name}</h1>
          <p className="member-meta-line">
            <span className="mono-cell">{member.id}</span>
            {member.dob ? <span> · DOB {formatDate(member.dob)}</span> : null}
            {member.ssnLast4 ? <span> · SSN •••‑••‑{member.ssnLast4}</span> : null}
            {member.createdAt ? <span> · On file since {formatDate(member.createdAt)}</span> : null}
          </p>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard label="Policies" value={policies.length} />
        <StatCard label="Claims filed" value={claims.length} />
        <StatCard label="Total billed" value={formatMoney(totalBilled)} flag={totalBilled > 50000} />
        <StatCard label="Shared-identity links" value={shared.length} flag={shared.length > 0} />
      </div>

      <div className="two-col">
        <div>
          <h2 className="section-title">Policies</h2>
          <div className="card">
            {policies.length === 0 ? (
              <EmptyState>No policies on file.</EmptyState>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Start date</th>
                    <th>Monthly premium</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id}>
                      <td>{p.type}</td>
                      <td>
                        {p.status ? (
                          <span className={`badge risk-${String(p.status).toLowerCase() === "active" ? "low" : "medium"}`}>
                            {p.status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{formatDate(p.startDate)}</td>
                      <td>{p.premiumMonthly != null ? formatMoney(p.premiumMonthly) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="section-title">Claims filed</h2>
          <div className="card">
            {claims.length === 0 ? (
              <EmptyState>No claims filed.</EmptyState>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date of service</th>
                    <th>Amount</th>
                    <th>Diagnosis</th>
                    <th>Status</th>
                    <th>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.dateOfService)}</td>
                      <td>{formatMoney(c.amount)}</td>
                      <td className="mono-cell">{c.diagnosisCode || "—"}</td>
                      <td>{c.status || "—"}</td>
                      <td>
                        {c.providerId ? (
                          <Link className="plain-link" to={`/providers/${c.providerId}`}>
                            {c.providerName || c.providerId}
                          </Link>
                        ) : (
                          c.providerName || "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="section-title">
            Shared identity links {shared.length > 0 && <RiskBadge memberCount={shared.length} />}
          </h2>
          <div className="card">
            {shared.length === 0 ? (
              <EmptyState>No shared address, bank, or phone links recorded.</EmptyState>
            ) : (
              <ul className="connection-list">
                {shared.map((s) => (
                  <li key={s.key} className="connection-item">
                    <svg className="connection-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      {connectionIcon(s.kind)}
                    </svg>
                    <div className="connection-body">
                      <div className="connection-kind">{KIND_LABEL[s.kind] || s.kind}</div>
                      <div className="connection-value">{s.label}</div>
                    </div>
                    {s.memberId ? (
                      <Link className="btn connection-link" to={`/members/${s.memberId}`}>
                        {s.memberName}
                      </Link>
                    ) : (
                      <span className="connection-value">{s.memberName}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Network neighborhood</h2>
          <div className="form-row">
            <label htmlFor="hops">Hops</label>
            <select
              id="hops"
              value={hops}
              onChange={(e) => setHops(Number(e.target.value))}
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </div>
          {netLoading && <Loading label="Tracing connections…" />}
          <ErrorState error={netError} />
          {!netLoading && network && (
            <GraphView graph={network} centerId={member.id} />
          )}
        </div>
      </div>
    </div>
  );
}
