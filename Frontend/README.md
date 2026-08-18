# Claims Ring — Investigation Console (Frontend)

Plain JavaScript React app (Vite) for the Claims Ring fraud-detection
console. Talks to either the Spring Boot backend (`../backend-java`) or the
original Node backend (`../backend`) — both expose the same REST contract.

## Run

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your running backend
npm run dev
```

Opens on `http://localhost:5173`. The backend must be running (default
`http://localhost:8080`) and its CORS origin must include this origin.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Dashboard** | Portfolio stats + top providers by claim volume |
| `/members` | **Members** | Search by name/id |
| `/members/:id` | **Member detail** | Policies, claims, shared identities + force-directed network graph |
| `/providers` | **Providers** | Provider roster |
| `/providers/:id` | **Provider detail** | Every claim filed against the provider |
| `/fraud-rings` | **Fraud Rings** | Groups sharing an identity attribute who claimed against the same provider |
| `/fraud-rings/:providerId/:sharedNodeId` | **Ring detail** | Members, claims, and optional ring graph |

## Project structure

```
src/
  api/client.js          REST client (matches backend contract)
  components/
    GraphView.jsx        d3-force neighborhood graph
    RiskBadge.jsx        High / Elevated / Watch
    Sidebar.jsx          Nav + DB health indicator
    StatCard.jsx
    StateViews.jsx       Loading / Error / Empty
  pages/                 All routes above
  styles/tokens.css      Claims-ledger design tokens
  utils/format.js        Money, dates, risk level
  App.jsx                Shell + React Router
  main.jsx
  index.css
```

## Expected API responses (for backend implementers)

- `GET /api/health` → `{ status: "ok", database: "connected" }`
- `GET /api/dashboard` → `{ totalMembers, totalProviders, totalClaims, totalClaimAmount, fraudRingCount, topProviders: [{ id, name, specialty, claimCount, totalAmount }] }`
- `GET /api/members?search=` → `[{ id, name, dob, ssn }]`
- `GET /api/members/:id` → `{ id, name, dob, ssn, policies: [...], claims: [...], sharedIdentities: [{ type, value, id }] }`
- `GET /api/members/:id/network?hops=` → `{ nodes: [{ id, labels, caption }], edges: [{ id, source, target, type }] }`
- `GET /api/providers` → `[{ id, name, specialty, npi, claimCount, totalAmount }]`
- `GET /api/providers/:id` → `{ id, name, specialty, npi, claims: [{ id, claimNumber, memberId, memberName, amount, filedDate, status, diagnosis }] }`
- `GET /api/fraud-rings?minRingSize=` → `[{ providerId, providerName, sharedType, sharedNodeId, sharedValue, memberCount, totalAmount, members: [{ id, name }] }]`
- `GET /api/fraud-rings/:providerId/:sharedNodeId` → full ring dossier (+ optional `graph`)
