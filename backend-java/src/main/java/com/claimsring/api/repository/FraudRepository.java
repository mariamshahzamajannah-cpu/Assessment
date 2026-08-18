package com.claimsring.api.repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
import com.claimsring.api.domain.ClaimWithMemberId;
import com.claimsring.api.domain.FraudRingDetail;
import com.claimsring.api.domain.FraudRingSummary;
import com.claimsring.api.domain.Member;
import com.claimsring.api.domain.Provider;
import com.claimsring.api.domain.SharedIdentityNode;

/**
 * FLAGSHIP QUERY. Finds groups of members who (a) all share the same identity
 * attribute node -- the same physical address, bank account, or phone number
 * -- and (b) all filed claims against the same provider. Single 4-hop Cypher
 * pattern (Provider &lt;- Claim &lt;- Member -&gt; sharedNode) grouped by
 * (provider, sharedNode). Directly ported from fraudRepository.ts.
 */
@Repository
public class FraudRepository {

    private final Driver driver;

    public FraudRepository(Driver driver) {
        this.driver = driver;
    }

    private static final String FIND_RINGS_QUERY = """
            MATCH (provider:Provider)<-[:AGAINST]-(claim:Claim)<-[:FILED]-(member:Member)
                  -[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
            WITH provider, shared, collect(DISTINCT member) AS members, collect(DISTINCT claim) AS claims
            WHERE size(members) >= $minRingSize
            RETURN provider,
                   shared,
                   labels(shared)[0] AS sharedKind,
                   members,
                   size(members) AS memberCount,
                   size(claims) AS claimCount,
                   reduce(total = 0.0, c IN claims | total + c.amount) AS totalClaimed
            ORDER BY memberCount DESC, totalClaimed DESC
            LIMIT 100
            """;

    private static final String RING_DETAIL_QUERY = """
            MATCH (provider:Provider) WHERE elementId(provider) = $providerId
            MATCH (shared) WHERE elementId(shared) = $sharedNodeId
            MATCH (provider)<-[:AGAINST]-(claim:Claim)<-[:FILED]-(member:Member)-[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
            RETURN provider, shared, labels(shared)[0] AS sharedKind, member, claim
            """;

    public List<FraudRingSummary> findFraudRings(int minRingSize) {
        try (Session session = driver.session()) {
            Result result = session.run(FIND_RINGS_QUERY, Map.of("minRingSize", minRingSize));
            List<FraudRingSummary> rings = new ArrayList<>();
            for (Record record : result.list()) {
                Node providerNode = record.get("provider").asNode();
                Node sharedNode = record.get("shared").asNode();
                String sharedKind = record.get("sharedKind").asString();
                List<Node> memberNodes = record.get("members").asList(v -> v.asNode());

                Provider provider = GraphMapper.nodeProps(providerNode, Provider.class);
                Map<String, Object> sharedProps = GraphMapper.nodeProps(sharedNode);
                List<Member> members = memberNodes.stream()
                        .map(n -> GraphMapper.nodeProps(n, Member.class)).toList();

                rings.add(new FraudRingSummary(
                        providerNode.elementId() + "::" + sharedNode.elementId(),
                        provider,
                        new SharedIdentityNode(sharedKind, sharedNode.elementId(), shortLabel(sharedKind, sharedProps)),
                        GraphMapper.asInt(GraphMapper.toPlain(record.get("memberCount").asObject())),
                        GraphMapper.asInt(GraphMapper.toPlain(record.get("claimCount").asObject())),
                        GraphMapper.asDouble(GraphMapper.toPlain(record.get("totalClaimed").asObject())),
                        members));
            }
            return rings;
        }
    }

    public FraudRingDetail getFraudRingDetail(String providerId, String sharedNodeId) {
        try (Session session = driver.session()) {
            Result result = session.run(RING_DETAIL_QUERY,
                    Map.of("providerId", providerId, "sharedNodeId", sharedNodeId));
            List<Record> records = result.list();
            if (records.isEmpty()) {
                return null;
            }

            Record first = records.get(0);
            Node providerNode = first.get("provider").asNode();
            Node sharedNode = first.get("shared").asNode();
            String sharedKind = first.get("sharedKind").asString();
            Map<String, Object> sharedProps = GraphMapper.nodeProps(sharedNode);

            Map<String, Member> membersById = new LinkedHashMap<>();
            List<ClaimWithMemberId> claims = new ArrayList<>();

            for (Record record : records) {
                Node memberNode = record.get("member").asNode();
                Node claimNode = record.get("claim").asNode();
                Member member = GraphMapper.nodeProps(memberNode, Member.class);
                membersById.put(memberNode.elementId(), member);
                Claim claim = GraphMapper.nodeProps(claimNode, Claim.class);
                claims.add(new ClaimWithMemberId(claim.id(), claim.amount(), claim.dateOfService(),
                        claim.dateFiled(), claim.status(), claim.diagnosisCode(), memberNode.elementId()));
            }

            List<Member> members = new ArrayList<>(membersById.values());
            double totalClaimed = claims.stream().mapToDouble(c -> c.amount() == null ? 0.0 : c.amount()).sum();

            return new FraudRingDetail(
                    providerId + "::" + sharedNodeId,
                    GraphMapper.nodeProps(providerNode, Provider.class),
                    new SharedIdentityNode(sharedKind, sharedNode.elementId(), shortLabel(sharedKind, sharedProps)),
                    members.size(),
                    claims.size(),
                    totalClaimed,
                    members,
                    claims);
        }
    }

    private String shortLabel(String kind, Map<String, Object> props) {
        if ("Address".equals(kind)) {
            return props.get("line1") + ", " + props.get("city") + " " + props.get("zip");
        }
        if ("BankAccount".equals(kind)) {
            return "Account \u00b7\u00b7\u00b7\u00b7" + props.get("last4");
        }
        String number = String.valueOf(props.getOrDefault("number", ""));
        String last4 = number.length() >= 4 ? number.substring(number.length() - 4) : number;
        return "Phone \u00b7\u00b7\u00b7\u00b7" + last4;
    }
}
