package com.claimsring.api.domain;

/** kind is one of "Address" | "BankAccount" | "Phone". */
public record SharedIdentityNode(
        String kind,
        String id,
        String label) {
}
