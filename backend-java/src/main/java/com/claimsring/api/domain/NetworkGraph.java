package com.claimsring.api.domain;

import java.util.List;

public record NetworkGraph(
        List<NetworkNode> nodes,
        List<NetworkEdge> edges) {
}
