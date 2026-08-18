package com.claimsring.api.domain;

/** A Claim plus the full member who filed it -- used inside ProviderDetail. */
public record ClaimWithMember(
        String id,
        Double amount,
        String dateOfService,
        String dateFiled,
        String status,
        String diagnosisCode,
        Member member) {
}
