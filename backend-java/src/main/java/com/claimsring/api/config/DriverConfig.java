package com.claimsring.api.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Config;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Creates the single, shared Neo4j Bolt driver instance for the app.
 * Equivalent of backend/src/db/driver.ts's getDriver() -- a pooled driver,
 * built once and reused for every request-scoped session.
 */
@Configuration
public class DriverConfig {

    @Value("${cognodb.uri}")
    private String uri;

    @Value("${cognodb.user}")
    private String user;

    @Value("${cognodb.password}")
    private String password;

    @Bean(destroyMethod = "close")
    public Driver neo4jDriver() {
        return GraphDatabase.driver(
                uri,
                AuthTokens.basic(user, password),
                Config.builder()
                        .withMaxConnectionPoolSize(20)
                        .withConnectionAcquisitionTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .build());
    }
}
