package com.claimsring.api.domain;

public record ProviderStat(
        Provider provider,
        int claimCount,
        double totalAmount) {
}
