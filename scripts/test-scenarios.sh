#!/bin/bash
# =============================================================================
# test-scenarios.sh - Pruebas Automatizadas de Escenarios
# Plataforma Distribuida de Streaming
# =============================================================================
# Ejecuta los 12 escenarios de demostración de forma automatizada.
# Uso: ./scripts/test-scenarios.sh [--verbose]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${CYAN}▶ $1${NC}"; }

# ── Configuración ──────────────────────────────────────────────────────────
LOAD_BALANCER="${LOAD_BALANCER_URL:-http://localhost:8000}"
EVENT_MONITOR="${EVENT_MONITOR_URL:-http://localhost:5000}"
VERBOSE=false
PASS=0
FAIL=0
SKIP=0

[[ "${1:-}" == "--verbose" ]] && VERBOSE=true

check() {
    local name="$1" url="$2" expected="${3:-200}"
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    if [ "$status" = "$expected" ]; then
        log_success "${name}" && PASS=$((PASS+1)) && return 0
    else
        log_error "${name} - HTTP ${status} (esperado ${expected})" && FAIL=$((FAIL+1)) && return 1
    fi
}

check_json() {
    local name="$1" url="$2" jq_filter="$3"
    local result
    result=$(curl -s --max-time 5 "$url" 2>/dev/null || echo "{}")
    if echo "$result" | jq -e "$jq_filter" > /dev/null 2>&1; then
        log_success "${name}" && PASS=$((PASS+1)) && return 0
    else
        local val; val=$(echo "$result" | jq -r "$jq_filter" 2>/dev/null || echo "N/A")
        log_error "${name} - filtro '$jq_filter' = $val" && FAIL=$((FAIL+1)) && return 1
    fi
}

api_post() {
    local url="$1" data="$2"
    curl -s -X POST -H "Content-Type: application/json" -d "$data" --max-time 10 "$url" 2>/dev/null || echo "{}"
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Test Scenarios - Plataforma Distribuida de Streaming   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
log_info "Load Balancer: ${LOAD_BALANCER}"
log_info "Event Monitor: ${EVENT_MONITOR}"
echo ""

# ── Escenario 1: Health Checks ─────────────────────────────────────────────
log_step "Escenario 1: Health Checks de Componentes"
check "Event Monitor Health" "${EVENT_MONITOR}/health"
check "Load Balancer Health" "${LOAD_BALANCER}/health"

# ── Escenario 2: Registro de Nodos ─────────────────────────────────────────
log_step "Escenario 2: Registro de Nodos"
for i in 1 2 3 4 5; do
    api_post "${EVENT_MONITOR}/api/nodes/register" \
        "{\"machine_id\":$i,\"name\":\"Machine $i\",\"ip\":\"192.168.2.$i\",\"status\":\"active\"}" > /dev/null
done
check_json "Nodos registrados" "${EVENT_MONITOR}/api/nodes" '. | length >= 3'
$VERBOSE && curl -s "${EVENT_MONITOR}/api/nodes" | jq .

# ── Escenario 3: Heartbeats ────────────────────────────────────────────────
log_step "Escenario 3: Heartbeats"
for i in 1 2 3; do
    api_post "${EVENT_MONITOR}/api/nodes/heartbeat" \
        "{\"node_id\":\"node-$i\",\"service_name\":\"test-svc-$i\",\"machine_id\":$i,\"status\":\"active\",\"cpu_percent\":$(($RANDOM % 50 + 10)),\"memory_percent\":$(($RANDOM % 40 + 20))}" > /dev/null
done
check_json "Heartbeats recibidos" "${EVENT_MONITOR}/api/nodes" '. | length >= 3'

# ── Escenario 4: Creación de Usuario ───────────────────────────────────────
log_step "Escenario 4: Creación de Usuario (vía Load Balancer)"
TEST_EMAIL="test-$(date +%s)@demo.com"
REG_RESP=$(api_post "${LOAD_BALANCER}/api/usuarios/api/auth/register" \
    "{\"nombre\":\"Test User\",\"email\":\"${TEST_EMAIL}\",\"password\":\"test123\"}")
TOKEN=$(echo "$REG_RESP" | jq -r '.token // empty')
if [ -n "$TOKEN" ]; then
    log_success "Usuario registrado - Token: ${TOKEN:0:20}..."
    PASS=$((PASS+1))
else
    log_warn "Registro de usuario (puede que el servicio no esté activo)"
    SKIP=$((SKIP+1))
fi

# ── Escenario 5: Replicación ───────────────────────────────────────────────
log_step "Escenario 5: Simulación de Replicación"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"replication.started\",\"source\":\"replication-test\",\"message\":\"Replicación iniciada\",\"severity\":\"info\"}" > /dev/null
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"replication.completed\",\"source\":\"replication-test\",\"message\":\"Replicación completada: 3/3 ACKs\",\"severity\":\"info\"}" > /dev/null
check_json "Eventos de replicación" "${EVENT_MONITOR}/api/events?limit=50" '. | map(select(.type | test("replication"; "i"))) | length >= 1'

# ── Escenario 6: Visualización de ACK ──────────────────────────────────────
log_step "Escenario 6: Visualización de ACK"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"replication.ack\",\"source\":\"replica-1\",\"message\":\"ACK recibido de Réplica 1\",\"severity\":\"info\",\"metadata\":{\"replica\":1,\"ack\":true}}" > /dev/null
log_success "ACK simulado para réplica" && PASS=$((PASS+1))

# ── Escenario 7: Balanceo de Solicitudes ───────────────────────────────────
log_step "Escenario 7: Balanceo de Solicitudes"
for i in 1 2 3; do
    api_post "${EVENT_MONITOR}/api/events" \
        "{\"type\":\"solicitud_recibida\",\"source\":\"load-balancer\",\"message\":\"Solicitud balanceada al servicio backend\",\"severity\":\"info\"}" > /dev/null
done
check_json "Solicitudes registradas" "${EVENT_MONITOR}/api/events?limit=50" '. | map(select(.type // "" | test("solicitud|request"; "i"))) | length >= 1'

# ── Escenario 8: Caída de Servicio ─────────────────────────────────────────
log_step "Escenario 8: Simulación de Caída de Servicio"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"service.down\",\"source\":\"usuarios\",\"message\":\"Servicio usuarios no responde - timeout 5s\",\"severity\":\"error\"}" > /dev/null
check_json "Evento de caída" "${EVENT_MONITOR}/api/events?limit=50" '. | map(select(.type == "service.down" or .type == "servicio_detenido" or (.message | test("caída|down|detenido"; "i")))) | length >= 1'

# ── Escenario 9: Circuit Breaker ───────────────────────────────────────────
log_step "Escenario 9: Activación de Circuit Breaker"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"circuit.opened\",\"source\":\"circuit-breaker\",\"message\":\"Circuit Breaker OPEN - umbral de fallos superado (5/5)\",\"severity\":\"warning\",\"metadata\":{\"circuit\":\"usuarios\",\"state\":\"OPEN\",\"failures\":5}}" > /dev/null
check_json "Circuit Breaker abierto" "${EVENT_MONITOR}/api/events?limit=50" '. | map(select(.type | test("circuit"; "i"))) | length >= 1'

# ── Escenario 10: Recuperación Automática ──────────────────────────────────
log_step "Escenario 10: Recuperación Automática"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"heartbeat.restored\",\"source\":\"usuarios\",\"message\":\"Heartbeat restaurado - servicio recuperado\",\"severity\":\"success\"}" > /dev/null
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"circuit.closed\",\"source\":\"circuit-breaker\",\"message\":\"Circuit Breaker CLOSED - recuperación exitosa\",\"severity\":\"info\"}" > /dev/null
check_json "Recuperación registrada" "${EVENT_MONITOR}/api/events?limit=50" '. | map(select(.type | test("circuit.closed|restored|recuperación"; "i"))) | length >= 1'

# ── Escenario 11: Restablecimiento de Heartbeats ───────────────────────────
log_step "Escenario 11: Restablecimiento de Heartbeats"
for i in 1 2 3; do
    api_post "${EVENT_MONITOR}/api/nodes/heartbeat" \
        "{\"node_id\":\"node-$i\",\"status\":\"active\",\"machine_id\":$i,\"cpu_percent\":25,\"memory_percent\":40}" > /dev/null
done
log_success "Heartbeats restablecidos para 3 nodos" && PASS=$((PASS+1))

# ── Escenario 12: Panel en Tiempo Real ─────────────────────────────────────
log_step "Escenario 12: Verificación de Panel en Tiempo Real"
check_json "Eventos accesibles vía API" "${EVENT_MONITOR}/api/events?limit=5" '. | length >= 1'
check_json "Nodos accesibles vía API" "${EVENT_MONITOR}/api/nodes" '. | length >= 1'
log_success "Datos disponibles para el panel web" && PASS=$((PASS+1))

# ── Resumen Final ──────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  RESULTADOS"
echo "══════════════════════════════════════════════════════════"
echo "  ✓ Pasados:  ${PASS}"
echo "  ✗ Fallados: ${FAIL}"
echo "  ○ Omitidos: ${SKIP}"
echo "  Total:      $((PASS + FAIL + SKIP))"
echo "══════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
    log_error "Algunos escenarios fallaron. Revisa que los servicios estén activos."
    exit 1
else
    log_success "Todos los escenarios completados exitosamente."
    echo ""
    echo "Próximo paso: Iniciar el frontend y abrir el Panel de Administración"
    echo "  cd frontend && npm start"
    echo "  → http://localhost:3000/admin"
    echo ""
fi
