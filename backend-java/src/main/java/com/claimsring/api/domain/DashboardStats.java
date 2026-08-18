package com.claimsring.api.domain;

import java.util.List;

public record DashboardStats(
        int memberCount,
        int providerCount,
        int claimCount,
        double totalClaimedAmount,
        int flaggedRingCount,
        List<ProviderStat> topProviders) {
}
