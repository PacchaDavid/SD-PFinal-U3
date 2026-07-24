# =============================================================================
# Microservice Dockerfile - Java Spring Boot
# =============================================================================
# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

ARG SERVICE_NAME
WORKDIR /app

COPY services/${SERVICE_NAME}/pom.xml ./
RUN mvn dependency:go-offline -B

COPY services/${SERVICE_NAME}/src ./src
RUN mvn package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S spring && adduser -S spring -G spring

WORKDIR /app

COPY --from=builder /app/target/*.jar ./service.jar

RUN chown -R spring:spring /app

USER spring

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "service.jar"]
