package com.streaming.usuarios.service;

import com.streaming.usuarios.config.ReplicationLogWriter;
import com.streaming.usuarios.dto.AuthResponse;
import com.streaming.usuarios.dto.LoginRequest;
import com.streaming.usuarios.dto.RegisterRequest;
import com.streaming.usuarios.dto.UpdateUserRequest;
import com.streaming.usuarios.dto.UserResponse;
import com.streaming.usuarios.model.User;
import com.streaming.usuarios.repository.UserRepository;
import com.streaming.usuarios.security.JwtProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final ReplicationLogWriter replicationLog;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtProvider jwtProvider,
                       ReplicationLogWriter replicationLog) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.replicationLog = replicationLog;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = request.getUsername();
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("El username ya está en uso");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("El email ya está registrado");
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(username);  // nombre del frontend se usa como fullName
        user.setRole("USER");

        user = userRepository.save(user);

        // Notificar replicación
        replicationLog.logReplication("INSERT", "users", user.getId(), user);

        String token = jwtProvider.generateToken(user.getUsername(), user.getRole(), user.getId());
        log.info("Usuario registrado: {}", user.getUsername());

        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId());
    }

    public AuthResponse login(LoginRequest request) {
        // Login por email (el frontend envía email, no username)
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Credenciales inválidas"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Credenciales inválidas");
        }

        String token = jwtProvider.generateToken(user.getUsername(), user.getRole(), user.getId());
        log.info("Login exitoso: {} (email: {})", user.getUsername(), request.getEmail());

        return new AuthResponse(token, user.getUsername(), user.getRole(), user.getId());
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        return UserResponse.fromEntity(user);
    }

    public UserResponse getUserByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        return UserResponse.fromEntity(user);
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setUsername(request.getFullName());
            user.setFullName(request.getFullName());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            if (!request.getEmail().equals(user.getEmail()) &&
                    userRepository.existsByEmail(request.getEmail())) {
                throw new RuntimeException("El email ya está registrado");
            }
            user.setEmail(request.getEmail());
        }

        user = userRepository.save(user);
        replicationLog.logReplication("UPDATE", "users", user.getId(), user);
        log.info("Usuario actualizado: {}", user.getUsername());

        return UserResponse.fromEntity(user);
    }

    public long getUserCount() {
        return userRepository.count();
    }
}
