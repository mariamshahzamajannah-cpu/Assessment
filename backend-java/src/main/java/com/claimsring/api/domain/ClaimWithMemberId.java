package com.claimsring.api.domain;

/** A Claim plus the id of the member who filed it -- used inside FraudRingDetail. */
public record ClaimWithMemberId(
        String id,
        Double amount,
        String dateOfService,
        String dateFiled,
        String status,
        String diagnosisCode,
        String memberId) {
}
