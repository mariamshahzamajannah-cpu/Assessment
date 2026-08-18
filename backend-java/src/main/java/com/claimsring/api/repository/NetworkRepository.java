package com.claimsring.api.repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.types.Node;
import org.neo4j.driver.types.Path;
import org.neo4j.driver.types.Relationship;
import org.springframework.stereotype.Repository;

import com.claimsring.api.db.GraphMapper;
import com.claimsring.api.domain.NetworkEdge;
import com.claimsring.api.domain.NetworkGraph;
import com.claimsring.api.domain.NetworkNode;

/**
 * Variable-length neighborhood query for the free-form "Explore" graph view.
 * Bounded at 3 hops and 300 relationships so a busy hub node can't blow the
 * response size or the query budget. Ported from networkRepository.ts.
 */
@Repository
public class NetworkRepository {

    private static final Map<String, String> CAPTION_FIELDS = Map.of(
            "Member", "lastName",
            "Provider", "name",
            "Address", "line1",
            "BankAccount", "last4",
            "Phone", "number",
            "Policy", "type",
            "Claim", "id");

    private final Driver driver;

    public NetworkRepository(Driver driver) {
        this.driver = driver;
    }

    public NetworkGraph getMemberNetwork(String memberId, int hops) {
        int boundedHops = Math.min(Math.max(hops, 1), 3);
        String cypher = """
                MATCH (center:Member {id: $memberId})
                CALL {
                  WITH center
                  MATCH path = (center)-[*1..%d]-(other)
                  RETURN path
                  LIMIT 300
                }
                RETURN path
                """.formatted(boundedHops);

        try (Session session = driver.session()) {
            Result result = session.run(cypher, Map.of("memberId", memberId));
            List<Record> records = result.list();
            if (records.isEmpty()) {
                return null;
            }

            Map<String, NetworkNode> nodesById = new LinkedHashMap<>();
            Map<String, NetworkEdge> edgesById = new LinkedHashMap<>();

            for (Record record : records) {
                Path path = record.get("path").asPath();
                for (Path.Segment segment : path) {
                    for (Node node : new Node[] { segment.start(), segment.end() }) {
                        nodesById.computeIfAbsent(node.elementId(), id -> new NetworkNode(
                                node.elementId(),
                                toStringList(node.labels()),
                                captionFor(node),
                                GraphMapper.nodeProps(node)));
                    }
                    Relationship rel = segment.relationship();
                    edgesById.computeIfAbsent(rel.elementId(), id -> new NetworkEdge(
                            rel.elementId(), rel.type(), rel.startNodeElementId(), rel.endNodeElementId()));
                }
            }

            return new NetworkGraph(List.copyOf(nodesById.values()), List.copyOf(edgesById.values()));
        }
    }

    private List<String> toStringList(Iterable<String> labels) {
        List<String> out = new java.util.ArrayList<>();
        labels.forEach(out::add);
        return out;
    }

    private String captionFor(Node node) {
        String label = node.labels().iterator().hasNext() ? node.labels().iterator().next() : "";
        String field = CAPTION_FIELDS.getOrDefault(label,
                node.keys().iterator().hasNext() ? node.keys().iterator().next() : null);
        if (field == null || node.get(field).isNull()) {
            return label;
        }
        return node.get(field).asObject().toString();
    }
}
