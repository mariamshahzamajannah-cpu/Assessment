package com.claimsring.api.domain;

import java.util.List;

public record ProviderDetail(
        Provider provider,
        int claimCount,
        double totalAmount,
        int memberCount,
        List<ClaimWithMember> claims) {
}
