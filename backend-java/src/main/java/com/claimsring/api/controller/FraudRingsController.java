package com.claimsring.api.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.claimsring.api.domain.FraudRingDetail;
import com.claimsring.api.domain.FraudRingSummary;
import com.claimsring.api.exception.ApiException;
import com.claimsring.api.repository.FraudRepository;

@RestController
@RequestMapping("/api/fraud-rings")
public class FraudRingsController {

    private final FraudRepository fraudRepository;

    public FraudRingsController(FraudRepository fraudRepository) {
        this.fraudRepository = fraudRepository;
    }

    @GetMapping
    public List<FraudRingSummary> listFraudRings(
            @RequestParam(name = "minRingSize", required = false) Integer minRingSize) {
        int size = minRingSize == null ? 3 : Math.max(2, minRingSize);
        return fraudRepository.findFraudRings(size);
    }

    @GetMapping("/{providerId}/{sharedNodeId}")
    public FraudRingDetail getFraudRing(@PathVariable String providerId, @PathVariable String sharedNodeId) {
        FraudRingDetail detail = fraudRepository.getFraudRingDetail(providerId, sharedNodeId);
        if (detail == null) {
            throw new ApiException(404, "No ring found for that provider / shared-identity pair.");
        }
        return detail;
    }
}
