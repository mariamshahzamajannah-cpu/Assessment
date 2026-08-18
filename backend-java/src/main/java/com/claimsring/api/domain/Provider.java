package com.claimsring.api.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Provider(
        String id,
        String name,
        String npi,
        String specialty) {
}
