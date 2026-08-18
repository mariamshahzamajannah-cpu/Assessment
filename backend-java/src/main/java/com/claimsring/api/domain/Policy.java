package com.claimsring.api.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Policy(
        String id,
        String type,
        String startDate,
        Double premiumMonthly,
        String status) {
}
