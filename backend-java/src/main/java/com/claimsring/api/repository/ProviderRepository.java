package com.claimsring.api.repository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.types.Node;
import org.springframework.stereotype.Repository;

import com.claimsring.api.db.GraphMapper;
import com.claimsring.api.domain.Claim;
import com.claimsring.api.domain.ClaimWithMember;
import com.claimsring.api.domain.Member;
import com.claimsring.api.domain.Provider;
import com.claimsring.api.domain.ProviderDetail;
import com.claimsring.api.domain.ProviderWithStats;

@Repository
public class ProviderRepository {

    private final Driver driver;

    public ProviderRepository(Driver driver) {
        this.driver = driver;
    }

    private static final String LIST_QUERY = """
            MATCH (p:Provider)
            OPTIONAL MATCH (p)<-[:AGAINST]-(c:Claim)<-[:FILED]-(m:Member)
            RETURN p,
                   count(DISTINCT c) AS claimCount,
                   coalesce(sum(c.amount), 0.0) AS totalAmount,
                   count(DISTINCT m) AS memberCount
            ORDER BY claimCount DESC
            LIMIT $limit
            """;

    public List<ProviderWithStats> listProviders(int limit) {
        try (Session session = driver.session()) {
            Result result = session.run(LIST_QUERY, Map.of("limit", limit));
            List<ProviderWithStats> out = new ArrayList<>();
            for (Record r : result.list()) {
                out.add(new ProviderWithStats(
                        GraphMapper.nodeProps(r.get("p").asNode(), Provider.class),
                        GraphMapper.asInt(GraphMapper.toPlain(r.get("claimCount").asObject())),
                        GraphMapper.asDouble(GraphMapper.toPlain(r.get("totalAmount").asObject())),
                        GraphMapper.asInt(GraphMapper.toPlain(r.get("memberCount").asObject()))));
            }
            return out;
        }
    }

    private static final String DETAIL_QUERY = """
            MATCH (p:Provider {id: $id})
            OPTIONAL MATCH (p)<-[:AGAINST]-(c:Claim)<-[:FILED]-(m:Member)
            RETURN p, collect(DISTINCT { claim: c, member: m }) AS rows
            """;

    public ProviderDetail getProviderById(String id) {
        try (Session session = driver.session()) {
            Result result = session.run(DETAIL_QUERY, Map.of("id", id));
            if (!result.hasNext()) {
                return null;
            }
            Record record = result.single();
            if (record.get("p").isNull()) {
                return null;
            }
            Node providerNode = record.get("p").asNode();

            List<ClaimWithMember> claims = new ArrayList<>();
            for (var row : record.get("rows").asList(v -> v)) {
                var claimValue = row.get("claim");
                var memberValue = row.get("member");
                if (claimValue.isNull() || memberValue.isNull()) continue;
                Claim claim = GraphMapper.nodeProps(claimValue.asNode(), Claim.class);
                Member member = GraphMapper.nodeProps(memberValue.asNode(), Member.class);
                claims.add(new ClaimWithMember(claim.id(), claim.amount(), claim.dateOfService(),
                        claim.dateFiled(), claim.status(), claim.diagnosisCode(), member));
            }

            double totalAmount = claims.stream().mapToDouble(c -> c.amount() == null ? 0.0 : c.amount()).sum();
            Set<String> distinctMembers = new HashSet<>();
            claims.forEach(c -> distinctMembers.add(c.member().id()));

            return new ProviderDetail(
                    GraphMapper.nodeProps(providerNode, Provider.class),
                    claims.size(),
                    totalAmount,
                    distinctMembers.size(),
                    claims);
        }
    }
}
