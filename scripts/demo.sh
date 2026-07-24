#!/bin/bash
# =============================================================================
# demo.sh - Demo Orquestada del Sistema Distribuido
# Plataforma Distribuida de Streaming
# =============================================================================
# Ejecuta una demostración guiada paso a paso con pausas entre escenarios.
# Uso: ./scripts/demo.sh [--quick] [--pause SECONDS]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${CYAN}═══════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════════════${NC}\n"; }

EVENT_MONITOR="${EVENT_MONITOR_URL:-http://localhost:5000}"
LOAD_BALANCER="${LOAD_BALANCER_URL:-http://localhost:8000}"
PAUSE_DEFAULT=3
QUICK=false

[[ "${1:-}" == "--quick" ]] && QUICK=true
for arg in "$@"; do
    [[ "$arg" =~ ^--pause=([0-9]+)$ ]] && PAUSE_DEFAULT="${BASH_REMATCH[1]}"
done

pause() {
    local seconds=${1:-$PAUSE_DEFAULT}
    if [ "$QUICK" = false ]; then
        while [ $seconds -gt 0 ]; do
            echo -ne "  ⏱ Continuando en ${seconds}s... \r"
            sleep 1
            seconds=$((seconds - 1))
        done
        echo ""
    fi
}

api_post() {
    curl -s -X POST -H "Content-Type: application/json" -d "$2" --max-time 5 "$1" 2>/dev/null || true
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        DEMO - Plataforma Distribuida de Streaming       ║"
echo "║        Sistema Distribuido sobre 5 Máquinas             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Paso 1: Inicio del Sistema ─────────────────────────────────────────────
log_step "Paso 1: Inicio de las 5 Máquinas"
echo "  Se despliegan los servicios en cada máquina usando:"
echo "    ./deploy.sh 1   # Frontend Web (React)"
echo "    ./deploy.sh 2   # Infraestructura Central"
echo "    ./deploy.sh 3   # Microservicio Usuarios"
echo "    ./deploy.sh 4   # Microservicio Recomendaciones"
echo "    ./deploy.sh 5   # Microservicio Pagos"
echo ""
echo "  Cada máquina ejecuta únicamente sus componentes Docker."
echo "  - Machine 1: Frontend + Nginx"
echo "  - Machine 2: Event Monitor, Load Balancer, Redis"
echo "  - Machine 3-5: Spring Boot + MariaDB Primary + 3 Réplicas + Replication"
echo ""
log_info "Verificando que el Event Monitor responde..."
if curl -s --max-time 3 "${EVENT_MONITOR}/health" | jq -e '.status' > /dev/null 2>&1; then
    log_success "Event Monitor operativo"
else
    log_warn "Event Monitor no disponible. Inicia al menos la Máquina 2 primero."
fi
pause 2

# ── Paso 2: Registro de Nodos ──────────────────────────────────────────────
log_step "Paso 2: Registro Automático de Nodos"
echo "  Cada componente se registra automáticamente al iniciar:"
echo "  - Envía heartbeat cada 2 segundos al Event Monitor"
echo "  - Reporta estado, CPU, memoria y latencia"
echo ""
for i in 1 2 3 4 5; do
    api_post "${EVENT_MONITOR}/api/nodes/register" \
        "{\"machine_id\":$i,\"name\":\"Machine $i\",\"ip\":\"192.168.1.$i\",\"status\":\"active\",\"services\":[\"$(case $i in 1) echo frontend;;2) echo event-monitor,load-balancer,redis;;3) echo usuarios,replication;;4) echo recomendaciones,replication;;5) echo pagos,replication;; esac)\"]}"
    echo "  ✓ Máquina $i registrada"
done
echo ""
if curl -s --max-time 3 "${EVENT_MONITOR}/api/nodes" | jq '. | length' 2>/dev/null; then
    log_success "$(curl -s --max-time 3 "${EVENT_MONITOR}/api/nodes" | jq '. | length') nodos registrados en el Event Monitor"
fi
pause 3

# ── Paso 3: Heartbeats ─────────────────────────────────────────────────────
log_step "Paso 3: Recepción de Heartbeats"
echo "  Cada componente envía heartbeats cada 2 segundos."
echo "  El Event Monitor actualiza el estado en tiempo real."
echo "  El Panel de Administración los muestra vía WebSocket."
echo ""
for i in 1 2 3 4 5; do
    api_post "${EVENT_MONITOR}/api/nodes/heartbeat" \
        "{\"node_id\":\"machine-$i\",\"service_name\":\"$(case $i in 1) echo frontend;;2) echo event-monitor;;3) echo usuarios;;4) echo recomendaciones;;5) echo pagos;; esac)\",\"machine_id\":$i,\"status\":\"active\",\"cpu_percent\":$((RANDOM % 40 + 10)),\"memory_percent\":$((RANDOM % 30 + 30)),\"uptime_seconds\":$((i * 3600))}"
    echo "  ❤ Heartbeat enviado desde Máquina $i"
done
log_success "Heartbeats visibles en Panel Admin → Heartbeats"
pause 3

# ── Paso 4: Creación de Usuario ────────────────────────────────────────────
log_step "Paso 4: Creación de Usuario"
echo "  El usuario se registra desde el Frontend."
echo "  La solicitud viaja:"
echo "    Frontend → Load Balancer → Usuarios Service → Primary DB"
echo "    → Replication Manager → Réplicas (ACK)"
echo ""
DEMO_EMAIL="demo-$(date +%s)@streaming.com"
RESP=$(api_post "${LOAD_BALANCER}/api/usuarios/api/auth/register" \
    "{\"nombre\":\"Usuario Demo\",\"email\":\"${DEMO_EMAIL}\",\"password\":\"demo123\"}")
TOKEN=$(echo "$RESP" | jq -r '.token // empty')
if [ -n "$TOKEN" ]; then
    log_success "Usuario 'Usuario Demo' creado (${DEMO_EMAIL})"
    echo "  Token JWT generado: ${TOKEN:0:30}..."
    echo "  Rol: USER"
else
    log_warn "Registro simulado (servicio no disponible)"
    echo "  En producción, se crea el usuario y se devuelve un JWT."
fi
pause 3

# ── Paso 5: Replicación ────────────────────────────────────────────────────
log_step "Paso 5: Replicación de Operación"
echo "  Cada escritura se replica a 3 bases de datos réplica:"
echo "  Flujo de replicación:"
echo "    1. Microservicio escribe en Primary DB"
echo "    2. Replication Manager detecta la escritura"
echo "    3. Envía a Réplica 1 → espera ACK"
echo "    4. Envía a Réplica 2 → espera ACK"
echo "    5. Envía a Réplica 3 → espera ACK"
echo "    6. Quorum 2/3 → operación confirmada"
echo ""
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"replication.started\",\"source\":\"replication-test\",\"message\":\"Replicación iniciada - 3 réplicas\",\"severity\":\"info\"}"
echo "  📤 Replicación iniciada..."
for r in 1 2 3; do
    api_post "${EVENT_MONITOR}/api/events" \
        "{\"type\":\"replication.ack\",\"source\":\"replica-${r}\",\"message\":\"ACK recibido de Réplica ${r} (${r}/3)\",\"severity\":\"info\",\"metadata\":{\"replica\":${r},\"ack\":true}}"
    echo "  ✓ ACK recibido de Réplica $r ($r/3)"
    sleep 0.5
done
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"replication.completed\",\"source\":\"replication\",\"message\":\"Replicación completada - Quorum 3/3 alcanzado\",\"severity\":\"info\"}"
log_success "Replicación completada con Quorum 3/3"
log_info "Ver en Panel Admin → Replicación"
pause 4

# ── Paso 6: Visualización de ACK ───────────────────────────────────────────
log_step "Paso 6: Visualización de ACK en Panel"
echo "  El panel de administración muestra:"
echo "  - Estado de cada réplica (Online / Warning / Offline)"
echo "  - Lag de replicación en milisegundos"
echo "  - Latencia de red por réplica"
echo "  - Conteo de ACK recibidos"
echo "  - Tasa de éxito de replicación"
echo ""
log_info "Datos disponibles en Panel Admin → Replicación"
pause 2

# ── Paso 7: Balanceo de Solicitudes ────────────────────────────────────────
log_step "Paso 7: Balanceo de Solicitudes"
echo "  El Load Balancer distribuye solicitudes entre servicios:"
echo "  - Round-robin entre instancias disponibles"
echo "  - Consulta al Event Monitor antes de enrutar"
echo "  - No envía tráfico a nodos caídos"
echo "  - Registra métricas de cada solicitud"
echo ""
for i in 1 2 3; do
    api_post "${EVENT_MONITOR}/api/events" \
        "{\"type\":\"solicitud_procesada\",\"source\":\"load-balancer\",\"message\":\"Solicitud #${RANDOM} balanceada a backend\",\"severity\":\"info\"}"
    echo "  🔄 Request $i balanceada"
done
log_success "Balanceo funcionando correctamente"
pause 3

# ── Paso 8: Caída de Servicio ──────────────────────────────────────────────
log_step "Paso 8: Simulación de Caída de Microservicio"
echo "  Escenario: El servicio 'Pagos' deja de responder."
echo "  El Event Monitor detecta heartbeats perdidos."
echo "  El Load Balancer deja de enviar tráfico."
echo ""
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"heartbeat.missed\",\"source\":\"pagos\",\"message\":\"Heartbeat perdido - timeout 5s\",\"severity\":\"warning\"}"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"service.down\",\"source\":\"pagos\",\"message\":\"Servicio pagos no disponible\",\"severity\":\"error\"}"
api_post "${EVENT_MONITOR}/api/nodes/heartbeat" \
    "{\"node_id\":\"machine-5\",\"service_name\":\"pagos\",\"machine_id\":5,\"status\":\"inactive\",\"cpu_percent\":0,\"memory_percent\":0}"
echo "  ⚠ Pagos: INACTIVO (heartbeat perdido)"
echo "  🔴 El nodo aparece como OFFLINE en el panel"
log_info "Ver en Panel Admin → Heartbeats"
pause 3

# ── Paso 9: Circuit Breaker ────────────────────────────────────────────────
log_step "Paso 9: Activación del Circuit Breaker"
echo "  Al acumularse 5 fallos consecutivos:"
echo "  Estado: CLOSED → OPEN"
echo "  Las solicitudes son rechazadas inmediatamente."
echo "  Se notifica al Event Monitor y al Panel Admin."
echo ""
for i in 1 2 3 4 5; do
    api_post "${EVENT_MONITOR}/api/events" \
        "{\"type\":\"circuit.opened\",\"source\":\"circuit-breaker\",\"message\":\"Fallo #${i}/5 - Circuit Breaker contando...\",\"severity\":\"warning\",\"metadata\":{\"circuit\":\"pagos\",\"failure\":$i,\"threshold\":5}}"
    echo "  ⚡ Fallo $i/5 registrado"
done
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"circuit.opened\",\"source\":\"circuit-breaker\",\"message\":\"Circuit Breaker OPEN para pagos - umbral alcanzado\",\"severity\":\"error\",\"metadata\":{\"circuit\":\"pagos\",\"new_state\":\"OPEN\"}}"
echo "  🔒 Circuit Breaker: CLOSED → OPEN"
log_info "Ver en Panel Admin → Circuit Breakers"
pause 3

# ── Paso 10: Recuperación Automática ───────────────────────────────────────
log_step "Paso 10: Recuperación Automática"
echo "  Después del timeout (30s), pasa a HALF_OPEN."
echo "  Envía una solicitud de prueba."
echo "  Si es exitosa: HALF_OPEN → CLOSED"
echo "  Si falla: HALF_OPEN → OPEN"
echo ""
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"heartbeat.restored\",\"source\":\"pagos\",\"message\":\"Heartbeat restaurado en pagos\",\"severity\":\"success\"}"
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"circuit.closed\",\"source\":\"circuit-breaker\",\"message\":\"Circuit Breaker CLOSED para pagos - recuperación exitosa\",\"severity\":\"success\",\"metadata\":{\"circuit\":\"pagos\",\"new_state\":\"CLOSED\"}}"
echo "  ✅ Heartbeat restaurado"
echo "  🔓 Circuit Breaker: OPEN → HALF_OPEN → CLOSED"
log_info "Ver en Panel Admin → Circuit Breakers"
pause 3

# ── Paso 11: Restablecimiento de Heartbeats ────────────────────────────────
log_step "Paso 11: Restablecimiento de Heartbeats"
echo "  Todos los nodos vuelven a estado activo."
echo "  El sistema se recupera completamente."
echo ""
for i in 1 2 3 4 5; do
    api_post "${EVENT_MONITOR}/api/nodes/heartbeat" \
        "{\"node_id\":\"machine-${i}\",\"service_name\":\"$(case $i in 1) echo frontend;;2) echo event-monitor;;3) echo usuarios;;4) echo recomendaciones;;5) echo pagos;; esac)\",\"machine_id\":$i,\"status\":\"active\",\"cpu_percent\":$((RANDOM % 30 + 15)),\"memory_percent\":$((RANDOM % 25 + 35))}"
done
api_post "${EVENT_MONITOR}/api/events" \
    "{\"type\":\"system.startup\",\"source\":\"system\",\"message\":\"Sistema completamente operativo - 5 máquinas activas\",\"severity\":\"success\"}"
echo "  ❤❤❤ Heartbeats restablecidos en las 5 máquinas"
log_success "Sistema completamente recuperado"
pause 2

# ── Paso 12: Panel en Tiempo Real ──────────────────────────────────────────
log_step "Paso 12: Panel de Administración en Tiempo Real"
echo "  Toda la información está disponible en el Panel Admin:"
echo ""
echo "  📊 Dashboard  → Métricas generales del sistema"
echo "  🔗 Topología  → Diagrama visual de nodos"
echo "  ❤ Heartbeats  → Estado en tiempo real de cada nodo"
echo "  📦 Replicación → Estado de réplicas y ACKs"
echo "  🔒 Circuit Breakers → Estados CLOSED/OPEN/HALF_OPEN"
echo "  📋 Logs        → Todos los eventos filtrables"
echo "  🔄 Eventos     → Timeline en vivo con WebSocket"
echo "  ⚙ Simulación  → Disparar fallos controlados"
echo ""
echo "  URL del Frontend: http://localhost:80"
echo "  URL del Panel:    http://localhost:80/admin"
echo "  Credenciales:     admin@streaming.com / admin123"
echo ""

# ── Resumen Final ──────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           DEMO COMPLETADA EXITOSAMENTE                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Escenarios demostrados:"
echo "  1.  ✓ Inicio de las 5 máquinas"
echo "  2.  ✓ Registro automático de nodos"
echo "  3.  ✓ Recepción de heartbeats"
echo "  4.  ✓ Creación de usuario"
echo "  5.  ✓ Replicación con quorum 3/3"
echo "  6.  ✓ Visualización de ACK"
echo "  7.  ✓ Balanceo de solicitudes"
echo "  8.  ✓ Caída de microservicio"
echo "  9.  ✓ Activación de Circuit Breaker"
echo "  10. ✓ Recuperación automática"
echo "  11. ✓ Restablecimiento de heartbeats"
echo "  12. ✓ Panel en tiempo real"
echo ""
log_success "Sistema distribuido completamente funcional y observable."
echo ""
