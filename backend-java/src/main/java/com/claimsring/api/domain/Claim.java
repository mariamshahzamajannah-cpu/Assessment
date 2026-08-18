package com.claimsring.api.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Claim(
        String id,
        Double amount,
        String dateOfService,
        String dateFiled,
        String status,
        String diagnosisCode) {
}
