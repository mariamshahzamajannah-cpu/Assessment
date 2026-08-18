# Claims Ring API (Spring Boot / Java)

Java/Spring Boot port of the Claims Ring investigation-console API. Same REST
contract, same Cypher queries, same CognoDB (Neo4j Bolt) backing store as the
original Node/Express service -- just re-implemented with Spring MVC + the
plain Neo4j Java driver instead of Express + neo4j-driver (JS).

## Requirements
- Java 17+
- Maven 3.9+
- A CognoDB / Neo4j instance reachable over Bolt (see `../seed` to populate one)

## Run

```bash
export COGNODB_URI=bolt+s://your-instance-id.databases.cognodb.cloud
export COGNODB_USER=cognodb
export COGNODB_PASSWORD=your-password
mvn spring-boot:run
```

The server listens on `http://localhost:8080` by default (override with `PORT`).

## Build a jar

```bash
mvn clean package
java -jar target/fraud-ring-backend.jar
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity check |
| GET | `/api/members?search=` | Search members by name or id |
| GET | `/api/members/{id}` | Member detail + policies + claims + shared-identity connections |
| GET | `/api/members/{id}/network?hops=` | Variable-length neighborhood graph (1-3 hops) |
| GET | `/api/providers` | Providers with claim/member stats |
| GET | `/api/providers/{id}` | Provider detail + claims |
| GET | `/api/fraud-rings?minRingSize=` | Detected fraud rings (shared identity + shared provider) |
| GET | `/api/fraud-rings/{providerId}/{sharedNodeId}` | Ring detail with full evidence (members + claims) |

## Project layout

```
src/main/java/com/claimsring/api/
  FraudRingApplication.java   entry point
  config/                     Neo4j driver bean + CORS config
  domain/                     records mirroring the original TS domain types
  db/GraphMapper.java         Neo4j Value/Node -> plain object + record mapping
  repository/                 one class per original repository, same Cypher
  controller/                 one class per original Express router
  exception/                  ApiException + @RestControllerAdvice error mapping
```
