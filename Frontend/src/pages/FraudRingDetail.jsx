import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import RiskBadge from "../components/RiskBadge.jsx";
import GraphView from "../components/GraphView.jsx";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney, formatDate } from "../utils/format.js";

function normalizeRingDetail(data, providerId, sharedNodeId) {
  if (!data || typeof data !== "object") {
    return {
      providerId,
      providerName: providerId,
      sharedType: "identity",
      sharedNodeId,
      sharedValue: sharedNodeId,
      memberCount: 0,
      totalAmount: 0,
      members: [],
      claims: [],
      graph: null,
    };
  }

  const provider =
    data.provider && typeof data.provider === "object" ? data.provider : null;
  const shared =
    data.sharedNode && typeof data.sharedNode === "object"
      ? data.sharedNode
      : data.shared && typeof data.shared === "object"
        ? data.shared
        : null;

  const membersRaw = data.members ?? data.memberList ?? [];
  const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m, i) => {
    const node = m.member && typeof m.member === "object" ? m.member : m;
    return {
      id: node.id ?? m.memberId ?? `m-${i}`,
      name: node.name ?? m.memberName ?? node.id ?? "—",
      claimCount: m.claimCount ?? m.claim_count ?? null,
    };
  });

  const claimsRaw = data.claims ?? data.claimList ?? [];
  const claims = (Array.isArray(claimsRaw) ? claimsRaw : []).map((c, i) => {
    const claim = c.claim && typeof c.claim === "object" ? c.claim : c;
    const member = c.member && typeof c.member === "object" ? c.member : null;
    return {
      id: claim.id ?? c.claimId ?? `c-${i}`,
      claimNumber: claim.claimNumber ?? claim.claim_number ?? claim.id,
      amount: claim.amount ?? c.amount ?? null,
      filedDate: claim.filedDate ?? claim.filed_date ?? null,
      status: claim.status ?? null,
      memberId: c.memberId ?? member?.id ?? null,
      memberName: c.memberName ?? member?.name ?? null,
    };
  });

  let graph = data.graph ?? data.network ?? null;
  if (graph && (graph.nodes || graph.edges)) {
    graph = {
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges)
        ? graph.edges
        : Array.isArray(graph.links)
          ? graph.links
          : [],
    };
  } else {
    graph = null;
  }

  return {
    providerId: data.providerId ?? provider?.id ?? providerId,
    providerName: data.providerName ?? provider?.name ?? providerId,
    sharedType:
      data.sharedType ??
      shared?.type ??
      (Array.isArray(shared?.labels) ? shared.labels[0] : null) ??
      "identity",
    sharedNodeId: data.sharedNodeId ?? shared?.id ?? sharedNodeId,
    sharedValue:
      data.sharedValue ??
      shared?.street ??
      shared?.accountNumber ??
      shared?.number ??
      shared?.value ??
      sharedNodeId,
    memberCount: data.memberCount ?? data.member_count ?? members.length,
    totalAmount: data.totalAmount ?? data.total_amount ?? 0,
    members,
    claims,
    graph,
  };
}

export default function FraudRingDetail() {
  const { providerId, sharedNodeId } = useParams();
  const [ring, setRing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getFraudRing(providerId, sharedNodeId);
        console.log("fraud-ring detail API response:", data);
        const normalized = normalizeRingDetail(data, providerId, sharedNodeId);
        if (!cancelled) setRing(normalized);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId, sharedNodeId]);

  if (loading) return <Loading label="Reconstructing ring dossier…" />;
  if (error) return <ErrorState error={error} />;
  if (!ring) return <EmptyState>Fraud ring not found.</EmptyState>;

  const size = ring.memberCount ?? ring.members.length;

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/fraud-rings">Fraud Rings</Link> / {ring.providerName || providerId}
      </div>

      <header className="page-header">
        <h1>
          Ring vs {ring.providerName || providerId} <RiskBadge memberCount={size} />
        </h1>
        <p>
          {size} members share {ring.sharedType || "an identity attribute"}
          {ring.sharedValue ? ` (${ring.sharedValue})` : ""} and filed claims against the same
          provider.
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{size}</div>
          <div className="stat-label">Members in ring</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ring.claims.length || "—"}</div>
          <div className="stat-label">Claims in ring</div>
        </div>
        <div className="stat-card flag">
          <div className="stat-value">{formatMoney(ring.totalAmount)}</div>
          <div className="stat-label">Combined claim amount</div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h2 className="section-title">Members</h2>
          <div className="card">
            {ring.members.length === 0 ? (
              <EmptyState>No member list returned.</EmptyState>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>ID</th>
                    <th>Claims in ring</th>
                  </tr>
                </thead>
                <tbody>
                  {ring.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link className="plain-link" to={`/members/${m.id}`}>
                          {m.name || m.id}
                        </Link>
                      </td>
                      <td>{m.id}</td>
                      <td>{m.claimCount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="section-title">Claims</h2>
          <div className="card">
            {ring.claims.length === 0 ? (
              <EmptyState>No claim detail returned for this ring.</EmptyState>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Claim #</th>
                    <th>Member</th>
                    <th>Amount</th>
                    <th>Filed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ring.claims.map((c) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h2 className="section-title">Ring network</h2>
          {ring.graph ? (
            <GraphView graph={ring.graph} centerId={ring.sharedNodeId} />
          ) : (
            <div className="card">
              <EmptyState>
                Backend did not return a graph payload for this ring. Open a member dossier for
                network view.
              </EmptyState>
            </div>
          )}

          <h2 className="section-title">Shared attribute</h2>
          <div className="card">
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Type</td>
                  <td>{ring.sharedType || "—"}</td>
                </tr>
                <tr>
                  <td>Value</td>
                  <td>{ring.sharedValue || "—"}</td>
                </tr>
                <tr>
                  <td>Node ID</td>
                  <td>{ring.sharedNodeId}</td>
                </tr>
                <tr>
                  <td>Provider</td>
                  <td>
                    <Link className="plain-link" to={`/providers/${ring.providerId}`}>
                      {ring.providerName || ring.providerId}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}