package com.streaming.pagos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class PaymentRequest {

    @NotNull(message = "userId es requerido")
    private Long userId;

    @NotBlank(message = "Descripción es requerida")
    private String description;

    @NotNull(message = "Monto es requerido")
    @Positive(message = "Monto debe ser positivo")
    private BigDecimal amount;

    private String paymentMethod = "CREDIT_CARD";

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
}
