package com.claimsring.api.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.claimsring.api.domain.ProviderDetail;
import com.claimsring.api.domain.ProviderWithStats;
import com.claimsring.api.exception.ApiException;
import com.claimsring.api.repository.ProviderRepository;

@RestController
@RequestMapping("/api/providers")
public class ProvidersController {

    private final ProviderRepository providerRepository;

    public ProvidersController(ProviderRepository providerRepository) {
        this.providerRepository = providerRepository;
    }

    @GetMapping
    public List<ProviderWithStats> listProviders() {
        return providerRepository.listProviders(100);
    }

    @GetMapping("/{id}")
    public ProviderDetail getProvider(@PathVariable String id) {
        ProviderDetail detail = providerRepository.getProviderById(id);
        if (detail == null) {
            throw new ApiException(404, "No provider found with id " + id + ".");
        }
        return detail;
    }
}
