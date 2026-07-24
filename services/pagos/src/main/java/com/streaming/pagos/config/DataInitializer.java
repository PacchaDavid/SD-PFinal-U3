package com.streaming.pagos.config;

import com.streaming.pagos.model.Payment;
import com.streaming.pagos.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final PaymentRepository paymentRepository;

    public DataInitializer(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Override
    public void run(String... args) {
        if (paymentRepository.count() > 0) {
            log.info("Base de pagos ya inicializada");
            return;
        }

        Payment p1 = new Payment();
        p1.setUserId(1L);
        p1.setDescription("Suscripción Mensual - Plan Básico");
        p1.setAmount(new BigDecimal("9.99"));
        p1.setStatus("COMPLETED");
        p1.setPaymentMethod("CREDIT_CARD");
        paymentRepository.save(p1);

        Payment p2 = new Payment();
        p2.setUserId(2L);
        p2.setDescription("Suscripción Anual - Plan Premium");
        p2.setAmount(new BigDecimal("99.99"));
        p2.setStatus("COMPLETED");
        p2.setPaymentMethod("DEBIT_CARD");
        paymentRepository.save(p2);

        Payment p3 = new Payment();
        p3.setUserId(1L);
        p3.setDescription("Alquiler Película - Nueva Era");
        p3.setAmount(new BigDecimal("4.99"));
        p3.setStatus("PENDING");
        p3.setPaymentMethod("CREDIT_CARD");
        paymentRepository.save(p3);

        log.info("Datos de pagos inicializados: 3 pagos creados");
    }
}
