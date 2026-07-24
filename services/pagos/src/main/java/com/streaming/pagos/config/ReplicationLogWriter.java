package com.streaming.pagos.config;

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

    @Value("${replication.manager.url}")
    private String replicationManagerUrl;

    @Value("${spring.application.name:unknown}")
    private String serviceName;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public ReplicationLogWriter() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        log.info("ReplicationLogWriter para {} → {}", serviceName, replicationManagerUrl);
    }

    public void logReplication(String operation, String tableName, Object recordId, Object data) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("id", UUID.randomUUID().toString());
            payload.put("operation", operation);
            payload.put("table_name", tableName);
            payload.put("record_id", String.valueOf(recordId));
            payload.put("service", serviceName);
            payload.put("data", objectMapper.writeValueAsString(data));
            payload.put("timestamp", System.currentTimeMillis() / 1000.0);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            restTemplate.postForEntity(
                    replicationManagerUrl + "/api/replication/log",
                    request, String.class);
        } catch (ResourceAccessException e) {
            log.debug("Replication Manager no disponible");
        } catch (Exception e) {
            log.error("Error registrando replicación: {}", e.getMessage());
        }
    }
}
