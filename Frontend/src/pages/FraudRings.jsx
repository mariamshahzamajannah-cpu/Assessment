import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import RiskBadge from "../components/RiskBadge.jsx";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatMoney } from "../utils/format.js";

function normalizeRings(data) {
  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.rings)) {
    list = data.rings;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  } else if (Array.isArray(data?.content)) {
    list = data.content;
  }

  return list.map((row, index) => {
    const provider =
      row.provider && typeof row.provider === "object" ? row.provider : null;
    const shared =
      row.sharedNode && typeof row.sharedNode === "object"
        ? row.sharedNode
        : row.shared && typeof row.shared === "object"
          ? row.shared
          : null;

    const providerId =
      row.providerId ?? provider?.id ?? row.provider_id ?? `prov-${index}`;
    const sharedNodeId =
      row.sharedNodeId ??
      shared?.id ??
      row.shared_node_id ??
      row.sharedId ??
      `shared-${index}`;

    const membersRaw = row.members ?? row.memberList ?? [];
    const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m, i) => {
      if (m && typeof m === "object") {
        return {
          id: m.id ?? m.memberId ?? `m-${i}`,
          name: m.name ?? m.memberName ?? m.id ?? "—",
        };
      }
      return { id: String(m), name: String(m) };
    });

    return {
      providerId,
      providerName:
        row.providerName ?? provider?.name ?? row.provider_name ?? providerId,
      sharedType:
        row.sharedType ??
        shared?.type ??
        (Array.isArray(shared?.labels) ? shared.labels[0] : null) ??
        row.shared_type ??
        "identity",
      sharedNodeId,
      sharedValue:
        row.sharedValue ??
        shared?.street ??
        shared?.accountNumber ??
        shared?.number ??
        shared?.value ??
        sharedNodeId,
      memberCount: row.memberCount ?? row.member_count ?? members.length ?? 0,
      totalAmount: row.totalAmount ?? row.total_amount ?? null,
      members,
    };
  });
}

export default function FraudRings() {
  const [minSize, setMinSize] = useState(3);
  const [rings, setRings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.listFraudRings(minSize);
        console.log("fraud-rings API response:", data);
        const list = normalizeRings(data);
        if (!cancelled) setRings(list);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [minSize]);

  return (
    <div>
      <header className="page-header">
        <h1>Fraud Rings</h1>
        <p>
          Groups of members who share an identity attribute (address, bank account, or phone) and
          who all filed claims against the same provider.
        </p>
      </header>

      <div className="form-row">
        <label htmlFor="minRingSize">Minimum ring size</label>
        <select
          id="minRingSize"
          value={minSize}
          onChange={(e) => setMinSize(Number(e.target.value))}
        >
          <option value={2}>2+</option>
          <option value={3}>3+</option>
          <option value={4}>4+</option>
          <option value={5}>5+</option>
          <option value={6}>6+</option>
        </select>
      </div>

      {loading && <Loading label="Scanning for coordinated rings…" />}
      <ErrorState error={error} />

      {!loading && rings.length === 0 && !error && (
        <EmptyState>No fraud rings found at this minimum size.</EmptyState>
      )}

      {!loading &&
        rings.map((ring) => {
          const size = ring.memberCount ?? ring.members?.length ?? 0;
          const href = `/fraud-rings/${encodeURIComponent(ring.providerId)}/${encodeURIComponent(ring.sharedNodeId)}`;

          return (
            <Link
              key={`${ring.providerId}-${ring.sharedNodeId}`}
              to={href}
              className="card ring-card"
            >
              <div className="ring-top">
                <h3>{ring.providerName || ring.providerId}</h3>
                <RiskBadge memberCount={size} />
              </div>
              <div className="ring-meta">
                Shared {ring.sharedType || "identity"} · {ring.sharedValue || ring.sharedNodeId} ·{" "}
                {size} members
                {ring.totalAmount != null ? ` · ${formatMoney(ring.totalAmount)}` : ""}
              </div>
              {ring.members?.length > 0 && (
                <div className="ring-members">
                  {ring.members.slice(0, 8).map((m) => (
                    <span key={m.id} className="chip">
                      {m.name || m.id}
                    </span>
                  ))}
                  {ring.members.length > 8 && (
                    <span className="chip">+{ring.members.length - 8} more</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
    </div>
  );
}