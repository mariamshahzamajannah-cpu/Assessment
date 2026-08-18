package com.claimsring.api.domain;

import java.util.List;
import java.util.Map;

public record NetworkNode(
        String id,
        List<String> labels,
        String caption,
        Map<String, Object> properties) {
}
