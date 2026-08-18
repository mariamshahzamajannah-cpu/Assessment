package com.claimsring.api.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.neo4j.driver.Driver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final Driver driver;

    public HealthController(Driver driver) {
        this.driver = driver;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        try {
            driver.verifyConnectivity();
            body.put("status", "ok");
            body.put("database", "connected");
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            body.put("status", "degraded");
            body.put("database", "unreachable");
            body.put("error", e.getMessage());
            return ResponseEntity.status(503).body(body);
        }
    }
}
