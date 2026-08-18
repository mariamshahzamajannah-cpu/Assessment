package com.claimsring.api.domain;

import java.util.List;

public record MemberDetail(
        Member member,
        List<Policy> policies,
        List<ClaimWithProvider> claims,
        List<SharedConnection> sharedConnections) {
}
