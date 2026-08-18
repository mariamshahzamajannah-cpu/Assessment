import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import Avatar from "../components/Avatar.jsx";
import { Loading, ErrorState, EmptyState } from "../components/StateViews.jsx";
import { formatDate } from "../utils/format.js";

/**
 * Backend shape (MembersController#searchMembers -> List<Member>):
 *   [{ id, firstName, lastName, dob, ssnLast4, createdAt }, ...]
 * A couple of alternate/nested shapes are handled defensively, but the
 * fields above are what the API actually returns.
 */
function normalizeMembers(data) {
  let list = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.members)) {
    list = data.members;
  } else if (Array.isArray(data?.content)) {
    list = data.content;
  } else if (data && typeof data === "object" && (data.id || data.member)) {
    list = [data];
  }

  return list.map((row, index) => {
    const m = row.member && typeof row.member === "object" ? row.member : row;

    const first = m.firstName ?? m.first_name ?? "";
    const last = m.lastName ?? m.last_name ?? "";
    const name = [first, last].filter(Boolean).join(" ") || m.name || m.memberName || "—";

    return {
      id: m.id ?? m.memberId ?? row.memberId ?? `member-${index}`,
      name,
      dob: m.dob ?? m.dateOfBirth ?? m.date_of_birth ?? null,
      ssnLast4: m.ssnLast4 ?? m.ssn_last4 ?? m.ssn ?? null,
      createdAt: m.createdAt ?? m.created_at ?? null,
    };
  });
}

export default function Members() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!submitted) {
      setMembers([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.searchMembers(submitted);
        const list = normalizeMembers(data);
        if (!cancelled) setMembers(list);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [submitted]);

  function onSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) setSubmitted(q);
  }

  return (
    <div>
      <header className="page-header">
        <h1>Members</h1>
        <p>
          Search policy holders by name or member ID. Open a record to inspect policies, claims,
          and shared-identity links.
        </p>
      </header>

      <form className="search-bar search-bar-icon" onSubmit={onSubmit}>
        <svg className="search-bar-icon-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.2 13.2 17.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Name or member ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search members"
        />
        <button type="submit">Search</button>
      </form>

      {loading && <Loading label="Searching case file…" />}
      <ErrorState error={error} />

      {!loading && submitted && members.length === 0 && !error && (
        <EmptyState>No members matched “{submitted}”.</EmptyState>
      )}

      {!loading && members.length > 0 && (
        <div className="card">
          <div className="card-eyebrow">
            {members.length} match{members.length === 1 ? "" : "es"} for “{submitted}”
          </div>
          <table className="data-table member-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Member ID</th>
                <th>DOB</th>
                <th>SSN</th>
                <th>On file since</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr
                  key={m.id}
                  className="link-row"
                  style={{ "--row-delay": `${Math.min(i, 8) * 25}ms` }}
                  onClick={() => navigate(`/members/${m.id}`)}
                >
                  <td>
                    <Link
                      className="plain-link member-name-cell"
                      to={`/members/${m.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Avatar name={m.name} seed={m.id} size="sm" />
                      <span>{m.name}</span>
                    </Link>
                  </td>
                  <td className="mono-cell">{m.id}</td>
                  <td>{formatDate(m.dob)}</td>
                  <td className="mono-cell">{m.ssnLast4 ? `•••‑••‑${m.ssnLast4}` : "—"}</td>
                  <td>{formatDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!submitted && !loading && (
        <EmptyState>Enter a name or ID above to search the member graph.</EmptyState>
      )}
    </div>
  );
}
