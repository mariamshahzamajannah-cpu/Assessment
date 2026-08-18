package com.claimsring.api.db;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.neo4j.driver.types.Node;
import org.neo4j.driver.types.Relationship;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Recursively converts Neo4j driver types (Node, Relationship, temporal
 * values) into plain Java objects/maps safe to serialize as JSON, and pulls
 * node properties into caller-supplied domain records. Equivalent of
 * backend/src/db/mappers.ts's toPlain()/nodeProps().
 */
public final class GraphMapper {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private GraphMapper() {

    }

    /**
     * Convenience: pull node.properties as a plain map and bind it straight
     * into a caller's domain record (Member/Provider/Claim/...). Equivalent
     * of mappers.ts's generic nodeProps&lt;T&gt;(node) helper.
     */
    public static <T> T nodeProps(Node node, Class<T> type) {
        return MAPPER.convertValue(nodeProps(node), type);
    }

    @SuppressWarnings("unchecked")
    public static Object toPlain(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Node node) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", node.elementId());
            out.put("labels", node.labels());
            out.put("properties", toPlain(node.asMap()));
            return out;
        }
        if (value instanceof Relationship rel) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", rel.elementId());
            out.put("type", rel.type());
            out.put("startId", rel.startNodeElementId());
            out.put("endId", rel.endNodeElementId());
            out.put("properties", toPlain(rel.asMap()));
            return out;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                out.put(String.valueOf(e.getKey()), toPlain(e.getValue()));
            }
            return out;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(GraphMapper::toPlain).toList();
        }
        // java.time.* temporal values (Neo4j driver auto-converts Date/DateTime/
        // Duration into these) all render sensibly via toString(), matching the
        // TS mapper's temporal branch.
        String typeName = value.getClass().getName();
        if (typeName.startsWith("java.time.")) {
            return value.toString();
        }
        return value; // String, Long, Double, Boolean pass through untouched.
    }

    /** Node properties as a plain, JSON-safe map. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> nodeProps(Node node) {
        return (Map<String, Object>) toPlain(node.asMap());
    }

    /** Convenience helpers for pulling a single scalar out of toPlain() output. */
    public static int asInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    public static double asDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number n) return n.doubleValue();
        return Double.parseDouble(String.valueOf(value));
    }

    public static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
