package com.streaming.usuarios.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Servicio que envía heartbeats periódicamente vía Redis Pub/Sub.
 *
 * Publica en el canal "heartbeats" para que el Event Monitor
 * los consuma y los reenvíe por WebSocket al panel de administración.
 */
@Service
@EnableScheduling
public class HeartbeatService {

    private static final Logger log = LoggerFactory.getLogger(HeartbeatService.class);

    @Value("${spring.application.name:unknown}")
    private String serviceName;

    @Value("${MACHINE_ID:0}")
    private int machineId;

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private String nodeId;
    private long startTime;

    public HeartbeatService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        this.startTime = System.currentTimeMillis();
        this.nodeId = serviceName + "-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("HeartbeatService iniciado para {} (nodeId={}, redis={})",
                serviceName, nodeId, redisTemplate != null);
    }

    @Scheduled(fixedRateString = "${event-monitor.heartbeat-interval:2000}")
    public void sendHeartbeat() {
        if (redisTemplate == null) {
            log.warn("RedisTemplate no disponible, omitiendo heartbeat");
            return;
        }

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("node_id", nodeId);
            payload.put("node_name", serviceName);
            payload.put("service_name", serviceName);
            payload.put("machine_id", machineId);
            payload.put("status", "active");
            payload.put("timestamp", System.currentTimeMillis() / 1000.0);
            payload.put("uptime_seconds", (System.currentTimeMillis() - startTime) / 1000.0);

            Map<String, Object> metrics = new HashMap<>();
            metrics.put("service", serviceName);
            metrics.put("java_version", System.getProperty("java.version"));
            payload.put("custom_metrics", metrics);

            String json = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend("heartbeats", json);

        } catch (Exception e) {
            log.error("Error publicando heartbeat en Redis: {}", e.getMessage());
        }
    }
}
