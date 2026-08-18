package com.claimsring.api.domain;

public record NetworkEdge(
        String id,
        String type,
        String source,
        String target) {
}
