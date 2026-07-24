#!/bin/bash
# =============================================================================
# health-check.sh - Verificación de Salud del Sistema
# Plataforma Distribuida de Streaming
# =============================================================================
# ./scripts/health-check.sh           # Verificar máquina actual
# ./scripts/health-check.sh 2         # Verificar máquina específica
# ./scripts/health-check.sh all       # Verificar todas las máquinas
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

check_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")

    if [ "$status" = "$expected_status" ]; then
        log_success "${name} (${url}) - HTTP ${status}"
        return 0
    elif [ "$status" = "000" ]; then
        log_error "${name} (${url}) - SIN RESPUESTA"
        return 1
    else
        log_warn "${name} (${url}) - HTTP ${status} (esperado ${expected_status})"
        return 2
    fi
}

check_docker_container() {
    local name=$1
    local status
    status=$(docker ps --filter "name=$name" --format "{{.Status}}" 2>/dev/null || echo "")

    if [ -n "$status" ]; then
        log_success "Container ${name}: ${status}"
        return 0
    else
        log_error "Container ${name}: NO EJECUTÁNDOSE"
        return 1
    fi
}

check_machine() {
    local machine_id=$1
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  Máquina ${machine_id}"
    echo "═══════════════════════════════════════════════"

    case $machine_id in
        1)
            check_endpoint "Frontend" "http://localhost:80/"
            ;;
        2)
            check_endpoint "Load Balancer" "http://localhost:8000/health"
            check_endpoint "Event Monitor" "http://localhost:8082/health"
            check_docker_container "streaming-redis"
            check_docker_container "streaming-event-monitor"
            check_docker_container "streaming-load-balancer"
            ;;
        3)
            check_endpoint "Usuarios Service" "http://localhost:8081/actuator/health"
            check_docker_container "streaming-usuarios-db-primary"
            check_docker_container "streaming-usuarios-db-replica1"
            check_docker_container "streaming-usuarios-db-replica2"
            check_docker_container "streaming-usuarios-db-replica3"
            check_docker_container "streaming-usuarios-replication"
            ;;
        4)
            check_endpoint "Recomendaciones Service" "http://localhost:8091/actuator/health"
            check_docker_container "streaming-recomendaciones-db-primary"
            check_docker_container "streaming-recomendaciones-db-replica1"
            check_docker_container "streaming-recomendaciones-db-replica2"
            check_docker_container "streaming-recomendaciones-db-replica3"
            check_docker_container "streaming-recomendaciones-replication"
            ;;
        5)
            check_endpoint "Pagos Service" "http://localhost:8083/actuator/health"
            check_docker_container "streaming-pagos-db-primary"
            check_docker_container "streaming-pagos-db-replica1"
            check_docker_container "streaming-pagos-db-replica2"
            check_docker_container "streaming-pagos-db-replica3"
            check_docker_container "streaming-pagos-replication"
            ;;
    esac
}

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  Health Check - Sistema Distribuido           ║"
echo "╚═══════════════════════════════════════════════╝"

MACHINE_ID=${1:-""}

if [ "$MACHINE_ID" = "all" ]; then
    for i in 1 2 3 4 5; do
        check_machine $i
    done
elif [ -n "$MACHINE_ID" ]; then
    check_machine "$MACHINE_ID"
else
    # Detectar máquina actual por perfil de docker compose
    for i in 1 2 3 4 5; do
        containers=$(docker ps --filter "label=com.docker.compose.project=distributed-streaming" \
            --filter "label=com.docker.compose.profile=machine${i}" -q 2>/dev/null)
        if [ -n "$containers" ]; then
            check_machine $i
            break
        fi
    done
    if [ -z "${MACHINE_ID_SET:-}" ]; then
        log_warn "No se pudo detectar la máquina actual. Especifica: $0 <1-5|all>"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo ""
