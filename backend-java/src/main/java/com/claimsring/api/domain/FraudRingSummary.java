package com.claimsring.api.domain;

import java.util.List;

public record FraudRingSummary(
        String ringKey,
        Provider provider,
        SharedIdentityNode sharedIdentity,
        int memberCount,
        int claimCount,
        double totalClaimed,
        List<Member> members) {
}
