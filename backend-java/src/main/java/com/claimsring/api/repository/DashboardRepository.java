package com.claimsring.api.repository;

import java.util.List;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.springframework.stereotype.Repository;

import com.claimsring.api.db.GraphMapper;
import com.claimsring.api.domain.DashboardStats;
import com.claimsring.api.domain.Provider;
import com.claimsring.api.domain.ProviderStat;

@Repository
public class DashboardRepository {

    private final Driver driver;

    public DashboardRepository(Driver driver) {
        this.driver = driver;
    }

    private static final String COUNTS_QUERY = """
            MATCH (m:Member) WITH count(m) AS memberCount
            MATCH (p:Provider) WITH memberCount, count(p) AS providerCount
            MATCH (c:Claim) WITH memberCount, providerCount, count(c) AS claimCount, sum(c.amount) AS totalClaimedAmount
            RETURN memberCount, providerCount, claimCount, coalesce(totalClaimedAmount, 0.0) AS totalClaimedAmount
            """;

    private static final String RING_COUNT_QUERY = """
            MATCH (provider:Provider)<-[:AGAINST]-(claim:Claim)<-[:FILED]-(member:Member)
                  -[:HAS_ADDRESS|HAS_BANK_ACCOUNT|HAS_PHONE]->(shared)
            WITH provider, shared, count(DISTINCT member) AS memberCount
            WHERE memberCount >= 3
            RETURN count(*) AS flaggedRingCount
            """;

    private static final String TOP_PROVIDERS_QUERY = """
            MATCH (p:Provider)<-[:AGAINST]-(c:Claim)
            RETURN p, count(c) AS claimCount, sum(c.amount) AS totalAmount
            ORDER BY totalAmount DESC
            LIMIT 5
            """;

    public DashboardStats getDashboardStats() {
        try (Session session = driver.session()) {
            Result countsResult = session.run(COUNTS_QUERY);
            Record countsRecord = countsResult.hasNext() ? countsResult.single() : null;

            Result ringResult = session.run(RING_COUNT_QUERY);
            Record ringRecord = ringResult.hasNext() ? ringResult.single() : null;

            Result topResult = session.run(TOP_PROVIDERS_QUERY);
            List<ProviderStat> topProviders = topResult.list(r -> new ProviderStat(
                    GraphMapper.nodeProps(r.get("p").asNode(), Provider.class),
                    GraphMapper.asInt(GraphMapper.toPlain(r.get("claimCount").asObject())),
                    GraphMapper.asDouble(GraphMapper.toPlain(r.get("totalAmount").asObject()))));

            return new DashboardStats(
                    countsRecord != null ? GraphMapper.asInt(GraphMapper.toPlain(countsRecord.get("memberCount").asObject())) : 0,
                    countsRecord != null ? GraphMapper.asInt(GraphMapper.toPlain(countsRecord.get("providerCount").asObject())) : 0,
                    countsRecord != null ? GraphMapper.asInt(GraphMapper.toPlain(countsRecord.get("claimCount").asObject())) : 0,
                    countsRecord != null ? GraphMapper.asDouble(GraphMapper.toPlain(countsRecord.get("totalClaimedAmount").asObject())) : 0.0,
                    ringRecord != null ? GraphMapper.asInt(GraphMapper.toPlain(ringRecord.get("flaggedRingCount").asObject())) : 0,
                    topProviders);
        }
    }
}
