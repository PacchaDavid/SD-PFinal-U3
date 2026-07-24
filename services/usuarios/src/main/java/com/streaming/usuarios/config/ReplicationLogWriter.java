package com.streaming.usuarios.config;

import com.fasterxml.jackson.core.JsonProcessingException;
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

/**
 * Servicio que registra operaciones de escritura en el Replication Manager.
 *
 * Cada INSERT, UPDATE o DELETE en el microservicio se reporta al
 * Replication Manager, que se encarga de propagarlo a las réplicas
 * y gestionar el quorum.
 */
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
        log.info("ReplicationLogWriter configurado para {} → {}", serviceName, replicationManagerUrl);
    }

    /**
     * Registra una operación de escritura para replicación.
     *
     * @param operation Tipo de operación (INSERT, UPDATE, DELETE)
     * @param tableName Nombre de la tabla afectada
     * @param recordId  ID del registro afectado
     * @param data      Datos completos del registro en formato JSON
     */
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

            String url = replicationManagerUrl + "/api/replication/log";
            restTemplate.postForEntity(url, request, String.class);

            log.debug("Replicación registrada: {} en {} [id={}]", operation, tableName, recordId);

        } catch (ResourceAccessException e) {
            log.warn("Replication Manager no disponible: {}", e.getMessage());
        } catch (JsonProcessingException e) {
            log.error("Error serializando datos para replicación: {}", e.getMessage());
        } catch (Exception e) {
            log.error("Error registrando replicación: {}", e.getMessage());
        }
    }
}
