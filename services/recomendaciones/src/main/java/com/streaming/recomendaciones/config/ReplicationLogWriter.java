package com.streaming.recomendaciones.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ReplicationLogWriter {
    private static final Logger log = LoggerFactory.getLogger(ReplicationLogWriter.class);
    @Value("${replication.manager.url}") private String replicationManagerUrl;
    @Value("${spring.application.name:unknown}") private String serviceName;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() { log.info("ReplicationLogWriter para {}", serviceName); }

    public void logReplication(String op, String table, Object id, Object data) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("id", UUID.randomUUID().toString());
            payload.put("operation", op);
            payload.put("table_name", table);
            payload.put("record_id", String.valueOf(id));
            payload.put("service", serviceName);
            payload.put("data", objectMapper.writeValueAsString(data));
            payload.put("timestamp", System.currentTimeMillis() / 1000.0);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.postForEntity(
                replicationManagerUrl + "/api/replication/log",
                new HttpEntity<>(payload, headers), String.class);
        } catch (ResourceAccessException e) { log.debug("Replication Manager no disponible"); }
        catch (Exception e) { log.error("Error replicación: {}", e.getMessage()); }
    }
}
