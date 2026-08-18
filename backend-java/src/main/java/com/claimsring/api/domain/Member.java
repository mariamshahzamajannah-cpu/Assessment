package com.claimsring.api.domain;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Member(
        String id,
        String name,
        String dob,
        @JsonAlias("ssn") String ssnLast4,
        String createdAt) {

    public Member {
        if (ssnLast4 != null && ssnLast4.length() > 4) {
            ssnLast4 = ssnLast4.substring(ssnLast4.length() - 4);
        }
    }
}
