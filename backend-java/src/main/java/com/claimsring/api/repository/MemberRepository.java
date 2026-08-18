package com.claimsring.api.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.types.Node;
import org.springframework.stereotype.Repository;

import com.claimsring.api.db.GraphMapper;
import com.claimsring.api.domain.Claim;
import com.claimsring.api.domain.ClaimWithProvider;
import com.claimsring.api.domain.Member;
import com.claimsring.api.domain.MemberDetail;
import com.claimsring.api.domain.Policy;
import com.claimsring.api.domain.SharedConnection;

@Repository
public class MemberRepository {

    private final Driver driver;

    public MemberRepository(Driver driver) {
        this.driver = driver;
    }

    private static final String SEARCH_QUERY = """
            MATCH (m:Member)
            WHERE toLower(m.id) CONTAINS toLower($query)
               OR toLower(coalesce(m.name, '')) CONTAINS toLower($query)
            RETURN m
            ORDER BY m.name, m.id
            LIMIT $limit
            """;
            

    public List<Member> searchMembers(String query, int limit) {
        try (Session session = driver.session()) {
            Result result = session.run(SEARCH_QUERY, Map.of("query", query, "limit", limit));
            return result.list(r -> GraphMapper.nodeProps(r.get("m").asNode(), Member.class));
        }
    }

    private static final String MEMBER_DETAIL_QUERY = """
            MATCH (m:Member {id: $id})
            OPTIONAL MATCH (m)-[:HAS_POLICY]->(policy:Policy)
            OPTIONAL MATCH (m)-[:FILED]->(claim:Claim)-[:AGAINST]->(provider:Provider)
            RETURN m,
                   collect(DISTINCT policy) AS policies,
                   collect(DISTINCT { claim: claim, providerName: provider.name, providerId: provider.id }) AS claimRows
            """;

    /** member + policies + claims-with-provider-name, WITHOUT sharedConnections (added by the service/controller layer). */
    public MemberDetail getMemberById(String id) {
        try (Session session = driver.session()) {
            Result result = session.run(MEMBER_DETAIL_QUERY, Map.of("id", id));
            if (!result.hasNext()) {
                return null;
            }
            Record record = result.single();
            Node memberNode = record.get("m").isNull() ? null : record.get("m").asNode();
            if (memberNode == null) {
                return null;
            }

            List<Node> policyNodes = record.get("policies").asList(v -> v.isNull() ? null : v.asNode());
            List<Policy> policies = policyNodes.stream().filter(java.util.Objects::nonNull)
                    .map(n -> GraphMapper.nodeProps(n, Policy.class)).toList();

            List<ClaimWithProvider> claims = new ArrayList<>();
            for (var row : record.get("claimRows").asList(v -> v)) {
                var claimValue = row.get("claim");
                if (claimValue.isNull()) continue;
                Node claimNode = claimValue.asNode();
                Claim claim = GraphMapper.nodeProps(claimNode, Claim.class);
                String providerName = row.get("providerName").isNull() ? "Unknown provider" : row.get("providerName").asString();
                String providerId = row.get("providerId").isNull() ? "" : row.get("providerId").asString();
                claims.add(new ClaimWithProvider(claim.id(), claim.amount(), claim.dateOfService(),
                        claim.dateFiled(), claim.status(), claim.diagnosisCode(), providerName, providerId));
            }

            Member member = GraphMapper.nodeProps(memberNode, Member.class);
            return new MemberDetail(member, policies, claims, List.of());
        }
    }

    private static final String SHARED_CONNECTIONS_QUERY = """
            MATCH (m:Member {id: $id})-[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)<-[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]-(other:Member)
            WHERE other.id <> $id
            RETURN DISTINCT other, labels(shared)[0] AS sharedKind, shared
            """;

    /**
     * 2-hop traversal: other members who share an address, bank account, or
     * phone number with this member -- the building block the fraud-ring
     * query generalizes.
     */
    public List<SharedConnection> getSharedIdentityConnections(String id) {
        try (Session session = driver.session()) {
            Result result = session.run(SHARED_CONNECTIONS_QUERY, Map.of("id", id));
            List<SharedConnection> out = new ArrayList<>();
            for (Record r : result.list()) {
                Node sharedNode = r.get("shared").asNode();
                Map<String, Object> sharedProps = GraphMapper.nodeProps(sharedNode);
                String kind = r.get("sharedKind").asString();
                String label;
                if ("Address".equals(kind)) {
                    label = sharedProps.get("line1") + ", " + sharedProps.get("city");
                } else if ("BankAccount".equals(kind)) {
                    label = "Account \u00b7\u00b7\u00b7\u00b7" + sharedProps.get("last4");
                } else {
                    String number = String.valueOf(sharedProps.getOrDefault("number", ""));
                    String last4 = number.length() >= 4 ? number.substring(number.length() - 4) : number;
                    label = "Phone \u00b7\u00b7\u00b7\u00b7" + last4;
                }
                Member other = GraphMapper.nodeProps(r.get("other").asNode(), Member.class);
                out.add(new SharedConnection(other, kind, label));
            }
            return out;
        }
    }
}
