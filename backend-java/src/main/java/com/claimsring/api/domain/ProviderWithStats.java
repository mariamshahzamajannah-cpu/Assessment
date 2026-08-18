package com.claimsring.api.domain;

public record ProviderWithStats(
        Provider provider,
        int claimCount,
        double totalAmount,
        int memberCount) {
}
