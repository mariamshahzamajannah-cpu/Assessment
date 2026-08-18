const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://assessment-emdq.onrender.com";

export class ApiRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new ApiRequestError(0, "Can't reach the Claims Ring server. Check your connection and try again.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiRequestError(res.status, message);
  }

  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  searchMembers: (query) => request(`/api/members?search=${encodeURIComponent(query)}`),
  getMember: (id) => request(`/api/members/${encodeURIComponent(id)}`),
  getMemberNetwork: (id, hops) =>
    request(`/api/members/${encodeURIComponent(id)}/network?hops=${hops}`),
  listProviders: () => request("/api/providers"),
  getProvider: (id) => request(`/api/providers/${encodeURIComponent(id)}`),
  listFraudRings: (minRingSize) => request(`/api/fraud-rings?minRingSize=${minRingSize}`),
  getFraudRing: (providerId, sharedNodeId) =>
    request(`/api/fraud-rings/${encodeURIComponent(providerId)}/${encodeURIComponent(sharedNodeId)}`),
  getDashboardStats: () => request("/api/dashboard"),
};
