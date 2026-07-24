package com.streaming.usuarios.config;

import com.streaming.usuarios.model.User;
import com.streaming.usuarios.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Base de datos ya inicializada con {} usuarios", userRepository.count());
            return;
        }

        log.info("Inicializando datos de usuarios...");

        // Admin por defecto
        User admin = new User();
        admin.setUsername("admin");
        admin.setEmail("admin@streaming.com");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setFullName("Administrador del Sistema");
        admin.setRole("ADMIN");
        userRepository.save(admin);
        log.info("Admin creado: admin / admin123");

        // Usuarios de prueba
        User user1 = new User();
        user1.setUsername("usuario1");
        user1.setEmail("usuario1@streaming.com");
        user1.setPassword(passwordEncoder.encode("password123"));
        user1.setFullName("Usuario Uno");
        user1.setRole("USER");
        userRepository.save(user1);

        User user2 = new User();
        user2.setUsername("usuario2");
        user2.setEmail("usuario2@streaming.com");
        user2.setPassword(passwordEncoder.encode("password123"));
        user2.setFullName("Usuario Dos");
        user2.setRole("USER");
        userRepository.save(user2);

        log.info("Datos de usuarios inicializados: 3 usuarios creados");
    }
}
