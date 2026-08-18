# Claims Ring — Insurance Fraud Investigation Console

A web application for investigating **insurance-claim fraud rings** — groups of members
who quietly share an address, a bank account, or a phone number and then file claims
against the same medical provider. Built on **CognoDB** (openCypher over Bolt) as the
graph data layer, a **Spring Boot / Java** API, and a **React (Vite)** frontend.

> Fraud investigation is exactly the kind of problem that stops being convenient the
> moment you leave a single table — see [Why a graph database?](#why-a-graph-database)
> below.

## Table of contents

- [Why a graph database?](#why-a-graph-database)
- [Data model](#data-model)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Setup](#setup)
  - [1. Create a CognoDB instance](#1-create-a-cognodb-instance)
  - [2. Load seed data](#2-load-seed-data)
  - [3. Run the backend](#3-run-the-backend)
  - [4. Run the frontend](#4-run-the-frontend)
- [The queries, explained](#the-queries-explained)
- [API reference](#api-reference)
- [Screenshots](#screenshots)
- [Credential hygiene](#credential-hygiene)

## Why a graph database?

An insurance claim, on its own, looks fine: a member, a provider, an amount, a
diagnosis code. Fraud rings don't show up in any single claim — they show up in the
**connections between claims that look unrelated on the surface**: three "different"
members who all happen to list the same apartment as their home address, and who all
happen to have filed against the same physiotherapy clinic.

In a relational schema, finding that pattern means:

- A self-join of `members` to `members` through `addresses` (or `bank_accounts`, or
  `phones` — and then a `UNION` across all three, because "shared identity" isn't one
  column, it's three different join paths).
- A second join from those member pairs out to `claims` and `providers`, to check that
  the shared-identity members also collided on the *same* provider.
- A `GROUP BY (provider, shared_attribute)` with a `HAVING COUNT(DISTINCT member) >= 3`
  to turn "pairs that match" into "rings of three or more."
- Rewriting most of that query if the investigator wants a 3-hop neighborhood instead of
  a 2-hop one, because SQL doesn't have a native concept of "however many hops it
  takes" — you either write a fixed number of joins per hop, or drop into a recursive
  CTE.

In CognoDB this is one Cypher pattern, because the relationship *is* the thing being
queried, not something reconstructed at query time via a foreign key:

```cypher
MATCH (provider:Provider)<-[:AGAINST]-(claim:Claim)<-[:FILED]-(member:Member)
      -[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
WITH provider, shared, collect(DISTINCT member) AS members, collect(DISTINCT claim) AS claims
WHERE size(members) >= $minRingSize
RETURN provider, shared, members, claims
```

Two things a relational database is genuinely awkward at, that this app leans on
directly:

1. **Variable-length, direction-agnostic traversal.** The "explore this member's
   neighborhood" view (`/api/members/:id/network?hops=`) walks 1–3 hops outward through
   *any* relationship type with `(center)-[*1..3]-(other)`. Bounding this in SQL means
   writing (and maintaining) a different query per hop depth, or a recursive CTE that
   still can't mix relationship "types" as cleanly as a label check.
2. **Pattern-shaped grouping, not column-shaped grouping.** The fraud-ring query groups
   by *the shape of a relationship path* (provider + shared node), not by a column that
   already exists on one row. That's the natural unit of a graph query and an unnatural
   one for `GROUP BY`.

The trade-off is real and worth naming: a graph store is a worse fit than Postgres for
this app's *transactional* writes (filing a claim, updating a policy status) — those are
plain row inserts with no interesting connectivity. The app leans on CognoDB
specifically for the *investigation* half of the workload, where the value is in the
edges, not the rows.

## Data model

```
                 (:Member)
                 /  |   \  \________________________
        HAS_POLICY  |    \___________________        \
                FILED|  HAS_ADDRESS \ HAS_BANK_ACCOUNT \ HAS_PHONE
                     ▼      ▼         ▼                 ▼
             (:Claim)   (:Address) (:BankAccount)   (:Phone)
                  |
              AGAINST
                  ▼
            (:Provider)

        (:Member)-[:HAS_POLICY]->(:Policy)
```

| Node | Key properties | Notes |
| --- | --- | --- |
| `Member` | `id`, `name`, `dob`, `ssn` (last-4 only) | the insured person |
| `Provider` | `id`, `name`, `npi`, `specialty` | the party being billed |
| `Claim` | `id`, `amount`, `dateOfService`, `dateFiled`, `status`, `diagnosisCode` | one filed claim |
| `Policy` | `id`, `type`, `startDate`, `premiumMonthly`, `status` | a member's coverage |
| `Address` | `line1`, `city`, `zip` | a shared **identity attribute**, not owned 1:1 by a member |
| `BankAccount` | `last4` | ditto |
| `Phone` | `number` | ditto |

| Relationship | Direction | Meaning |
| --- | --- | --- |
| `(:Member)-[:HAS_POLICY]->(:Policy)` | Member → Policy | a member's coverage |
| `(:Member)-[:FILED]->(:Claim)` | Member → Claim | who filed the claim |
| `(:Claim)-[:AGAINST]->(:Provider)` | Claim → Provider | who the claim was billed to |
| `(:Member)-[:HAS_ADDRESS]->(:Address)` | Member → Address | a member's address |
| `(:Member)-[:HAS_BANK_ACCOUNT]->(:BankAccount)` | Member → BankAccount | a member's payout account |
| `(:Member)-[:HAS_PHONE]->(:Phone)` | Member → Phone | a member's contact number |

The deliberate modeling choice: `Address`, `BankAccount`, and `Phone` are their own
nodes rather than properties on `Member`. That's what lets two members "share" one —
multiple `Member` nodes pointing at the *same* `Address` node is the fraud signal the
whole app is built around. If those were columns on `members`, "do these two rows have
the same string" is a much noisier and slower question at any real scale than "do these
two nodes point at the same node."

## Architecture

```
frontend-js (React + Vite + d3-force)
       │  REST/JSON, fetch()
       ▼
backend-java (Spring Boot)
  controller/  → repository/  → Neo4j Java driver (Bolt)
       │
       ▼
CognoDB (managed graph DB, openCypher over Bolt 5.x)
```

- **Frontend** — `frontend-js/`, plain React (no TypeScript) with React Router for
  pages and `d3-force` for the force-directed neighborhood graph. Talks to the backend
  over a small typed REST client (`src/api/client.js`).
- **Backend** — `backend-java/`, Spring Boot + the official `neo4j-java-driver`. One
  `@RestController` per resource, one `@Repository` per resource holding the raw,
  parameterized Cypher, and a `@RestControllerAdvice` that turns driver-level failures
  (auth, unreachable instance, bad Cypher) into honest HTTP error responses instead of
  raw stack traces.
- **Database** — CognoDB Cloud, connected to over Bolt with the standard Neo4j driver —
  no custom SDK required.

## Project structure

```
backend-java/
  src/main/java/com/claimsring/api/
    FraudRingApplication.java   entry point
    config/                     Neo4j driver bean + CORS config
    domain/                     records for API responses
    db/GraphMapper.java         Neo4j Value/Node -> plain object mapping
    repository/                 one class per resource, holds the Cypher
    controller/                 one class per resource, thin REST layer
    exception/                  ApiException + centralized error mapping
  src/main/resources/application.yml
  pom.xml

frontend-js/
  src/
    api/client.js                REST client
    components/                  GraphView (d3-force), RiskBadge, Sidebar, StateViews, ...
    pages/                       Dashboard, Members, MemberDetail, Providers,
                                 ProviderDetail, FraudRings, FraudRingDetail
    styles/tokens.css            design tokens
    utils/format.js              money / date / risk-level formatting
  vite.config.js
  package.json
```

## Setup

### 1. Create a CognoDB instance

1. Sign up at [console.cognodb.com/signup](https://console.cognodb.com/signup) (free
   tier, no credit card).
2. From the console, create a free (`c0`) instance and pick a region — it provisions in
   under a minute.
3. Copy the connection URI (`bolt+s://<instance-id>.databases.cognodb.cloud`) and the
   generated password for the `cognodb` user. **The password is shown once** — save it
   somewhere your app can read as an environment variable, not in a file you'll commit.

### 2. Load seed data

```bash
cd seed
pip install -r requirements.txt
export COGNODB_URI=bolt+s://your-instance-id.databases.cognodb.cloud
export COGNODB_USER=cognodb
export COGNODB_PASSWORD=your-password
python seed.py
```

Loads ~45 members, 12 providers, policies, and claims, plus four **deliberate fraud
rings** — groups of 3+ members sharing one address/bank-account/phone node who all
filed against the same provider — so the queries below have something to find. Safe to
re-run (everything is `MERGE`-keyed); pass `--reset` to wipe the graph first. See
[`seed/README.md`](seed/README.md) for details.

### 3. Run the backend

```bash
cd backend-java
export COGNODB_URI=bolt+s://your-instance-id.databases.cognodb.cloud
export COGNODB_USER=cognodb
export COGNODB_PASSWORD=your-password
mvn spring-boot:run
```

Server listens on `http://localhost:8080` (override with `PORT`).



### 4. Run the frontend

```bash
cd frontend-js
npm install
cp .env.example .env   # point VITE_API_BASE_URL at the backend above
npm run dev
```

Opens on `http://localhost:5173`.

## The queries, explained

**1. Fraud ring detection — the flagship query (multi-hop + relational-unfriendly).**
`FraudRepository.FIND_RINGS_QUERY`, 4-hop pattern:

```cypher
MATCH (provider:Provider)<-[:AGAINST]-(claim:Claim)<-[:FILED]-(member:Member)
      -[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
WITH provider, shared, collect(DISTINCT member) AS members, collect(DISTINCT claim) AS claims
WHERE size(members) >= $minRingSize
RETURN provider, shared, labels(shared)[0] AS sharedKind, members,
       size(members) AS memberCount, size(claims) AS claimCount,
       reduce(total = 0.0, c IN claims | total + c.amount) AS totalClaimed
ORDER BY memberCount DESC, totalClaimed DESC
LIMIT 100
```

Walks Provider ← Claim ← Member → shared-identity-node in one pattern, groups by
`(provider, shared)`, and keeps only groups with 3+ distinct members. This is the query
described in [Why a graph database?](#why-a-graph-database) above.

**2. Shared-identity connections — 2-hop traversal.**
`MemberRepository.SHARED_CONNECTIONS_QUERY`:

```cypher
MATCH (m:Member {id: $id})-[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
      <-[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]-(other:Member)
WHERE other.id <> $id
RETURN DISTINCT other, labels(shared)[0] AS sharedKind, shared
```

The building block the ring query generalizes: "who else points at the same identity
node as this member?"

**3. Variable-length neighborhood — the Explore graph view.**
`NetworkRepository.getMemberNetwork`, hop depth bounded to 1–3 and capped at 300 paths:

```cypher
MATCH (center:Member {id: $memberId})
CALL {
  WITH center
  MATCH path = (center)-[*1..3]-(other)
  RETURN path
  LIMIT 300
}
RETURN path
```

Powers the force-directed graph on the member detail page. A variable-length,
direction-agnostic walk like this has no fixed-join equivalent in SQL.

**4. Dashboard aggregates.** `DashboardRepository` — portfolio-wide counts, a rough
in-line ring count, and top providers by claim volume, all parameterized and running
against the live graph rather than a precomputed table.

All queries above run through `session.run(cypher, Map.of(...))` with named parameters
— no string concatenation anywhere in the Cypher layer.

## API reference

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity check |
| GET | `/api/dashboard` | Portfolio stats + top providers |
| GET | `/api/members?search=` | Search members by name or id |
| GET | `/api/members/{id}` | Member detail + policies + claims + shared-identity connections |
| GET | `/api/members/{id}/network?hops=` | Variable-length neighborhood graph (1–3 hops) |
| GET | `/api/providers` | Providers with claim/member stats |
| GET | `/api/providers/{id}` | Provider detail + claims |
| GET | `/api/fraud-rings?minRingSize=` | Detected fraud rings |
| GET | `/api/fraud-rings/{providerId}/{sharedNodeId}` | Ring detail with full evidence |

## Screenshots


