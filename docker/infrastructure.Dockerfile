# =============================================================================
# Infrastructure Dockerfile - Python Components
# =============================================================================
# =============================================================================
# Infrastructure Dockerfile - Python Components
# =============================================================================
# Build args (passed from docker-compose or build command):
#   COMPONENT - Component name (event-monitor, load-balancer, circuit-breaker, replication)
#   PORT      - Port for health check
# =============================================================================

FROM python:3.12-slim

ARG COMPONENT
ARG PORT=8000

RUN test -n "$COMPONENT" || (echo "ERROR: COMPONENT build arg is required" && exit 1)

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

COPY "infrastructure/${COMPONENT}/requirements.txt" ./
RUN pip install --no-cache-dir -r requirements.txt

COPY "infrastructure/${COMPONENT}/src/" ./src/

RUN chown -R app:app /app

USER app

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["python", "-m", "src.main"]
