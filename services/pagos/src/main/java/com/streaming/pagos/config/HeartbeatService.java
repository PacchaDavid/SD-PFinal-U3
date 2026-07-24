package com.streaming.pagos.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@EnableScheduling
public class HeartbeatService {

    private static final Logger log = LoggerFactory.getLogger(HeartbeatService.class);

    @Value("${event-monitor.url}")
    private String eventMonitorUrl;

    @Value("${spring.application.name:unknown}")
    private String serviceName;

    @Value("${MACHINE_ID:0}")
    private int machineId;

    private final RestTemplate restTemplate;
    private String nodeId;
    private long startTime;

    public HeartbeatService() {
        this.restTemplate = new RestTemplate();
    }

    @PostConstruct
    public void init() {
        this.startTime = System.currentTimeMillis();
        this.nodeId = serviceName + "-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("HeartbeatService para {} (nodeId={})", serviceName, nodeId);
    }

    @Scheduled(fixedRateString = "${event-monitor.heartbeat-interval:2000}")
    public void sendHeartbeat() {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("node_id", nodeId);
            payload.put("node_name", serviceName);
            payload.put("service_name", serviceName);
            payload.put("machine_id", machineId);
            payload.put("status", "active");
            payload.put("timestamp", System.currentTimeMillis() / 1000.0);
            payload.put("uptime_seconds", (System.currentTimeMillis() - startTime) / 1000.0);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            String url = eventMonitorUrl + "/nodes/" + nodeId + "/heartbeat";
            restTemplate.postForEntity(url, request, String.class);

        } catch (ResourceAccessException e) {
            log.debug("Event Monitor no disponible");
        } catch (Exception e) {
            log.error("Error heartbeat: {}", e.getMessage());
        }
    }
}
