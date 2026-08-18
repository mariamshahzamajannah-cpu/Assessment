package com.claimsring.api.domain;

public record SharedConnection(
        Member member,
        String sharedKind,
        String sharedLabel) {
}
