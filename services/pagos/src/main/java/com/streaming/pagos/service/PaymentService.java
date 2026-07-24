package com.streaming.pagos.service;

import com.streaming.pagos.config.ReplicationLogWriter;
import com.streaming.pagos.dto.PaymentRequest;
import com.streaming.pagos.dto.PaymentResponse;
import com.streaming.pagos.model.Payment;
import com.streaming.pagos.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final ReplicationLogWriter replicationLog;

    public PaymentService(PaymentRepository paymentRepository, ReplicationLogWriter replicationLog) {
        this.paymentRepository = paymentRepository;
        this.replicationLog = replicationLog;
    }

    @Transactional
    public PaymentResponse createPayment(PaymentRequest request) {
        Payment payment = new Payment();
        payment.setUserId(request.getUserId());
        payment.setDescription(request.getDescription());
        payment.setAmount(request.getAmount());
        payment.setPaymentMethod(request.getPaymentMethod());
        payment.setStatus("PENDING");

        payment = paymentRepository.save(payment);

        replicationLog.logReplication("INSERT", "payments", payment.getId(), payment);

        log.info("Pago creado: {} para usuario {}", payment.getId(), payment.getUserId());
        return PaymentResponse.fromEntity(payment);
    }

    @Transactional
    public PaymentResponse processPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new RuntimeException("Pago no encontrado: " + paymentId));

        // Simular procesamiento de pago (exitoso en 90% de casos)
        boolean success = Math.random() > 0.1;
        if (success) {
            payment.setStatus("COMPLETED");
            payment.setPaidAt(LocalDateTime.now());
        } else {
            payment.setStatus("FAILED");
        }

        payment = paymentRepository.save(payment);

        replicationLog.logReplication("UPDATE", "payments", payment.getId(), payment);

        log.info("Pago {} procesado: {}", paymentId, payment.getStatus());
        return PaymentResponse.fromEntity(payment);
    }

    public List<PaymentResponse> getUserPayments(Long userId) {
        return paymentRepository.findByUserId(userId).stream()
                .map(PaymentResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public PaymentResponse getPayment(Long id) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pago no encontrado"));
        return PaymentResponse.fromEntity(payment);
    }

    public List<PaymentResponse> getAllPayments() {
        return paymentRepository.findAll().stream()
                .map(PaymentResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
