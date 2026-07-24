package com.streaming.usuarios.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;

public class UpdateUserRequest {

    @JsonProperty("nombre")
    private String fullName;

    @Email(message = "Email inválido")
    private String email;

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
