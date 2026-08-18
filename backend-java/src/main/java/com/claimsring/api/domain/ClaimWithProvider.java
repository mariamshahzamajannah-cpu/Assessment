package com.claimsring.api.domain;

/** A Claim plus the provider it was filed against -- used inside MemberDetail. */
public record ClaimWithProvider(
        String id,
        Double amount,
        String dateOfService,
        String dateFiled,
        String status,
        String diagnosisCode,
        String providerName,
        String providerId) {
}
