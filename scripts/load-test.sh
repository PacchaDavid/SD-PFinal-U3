#!/bin/bash
# =============================================================================
# load-test.sh - Prueba de Carga para el Load Balancer
# Plataforma Distribuida de Streaming
# =============================================================================
# Envía solicitudes concurrentes para verificar balanceo y estabilidad.
# Uso: ./scripts/load-test.sh [--requests N] [--concurrent N] [--url URL]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }

TOTAL_REQUESTS=50
CONCURRENT=5
TARGET_URL="${LOAD_BALANCER_URL:-http://localhost:8000}"
TIMEOUT=10

# Parse args
for arg in "$@"; do
  case "$arg" in
    --requests=*) TOTAL_REQUESTS="${arg#*=}" ;;
    --concurrent=*) CONCURRENT="${arg#*=}" ;;
    --url=*) TARGET_URL="${arg#*=}" ;;
  esac
done

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  Load Test - Prueba de Carga                 ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
log_info "Target:      ${TARGET_URL}"
log_info "Requests:    ${TOTAL_REQUESTS}"
log_info "Concurrent:  ${CONCURRENT}"
log_info "Timeout:     ${TIMEOUT}s"
echo ""

# Verificar conectividad
if ! curl -s --max-time 3 "${TARGET_URL}/health" > /dev/null 2>&1; then
    log_warn "Target no disponible en ${TARGET_URL}. Usando simulación local."
fi

ENDPOINTS=(
    "${TARGET_URL}/health"
    "${TARGET_URL}/api/usuarios/actuator/health"
    "${TARGET_URL}/api/recomendaciones/api/recomendaciones"
)

SUCCESS=0
FAILED=0
TIMES_MS=()
START=$(date +%s%N)

echo -e "${CYAN}Ejecutando ${TOTAL_REQUESTS} solicitudes (${CONCURRENT} concurrentes)...${NC}"
echo ""

# Crear directorio temporal para resultados
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for ((batch = 0; batch < TOTAL_REQUESTS; batch += CONCURRENT)); do
    BATCH_PIDS=()
    BATCH_COUNT=$((CONCURRENT < TOTAL_REQUESTS - batch ? CONCURRENT : TOTAL_REQUESTS - batch))

    for ((i = 0; i < BATCH_COUNT; i++)); do
        idx=$(( (batch + i) % ${#ENDPOINTS[@]} ))
        url="${ENDPOINTS[$idx]}"
        OUT_FILE="${TMPDIR}/result_$((batch + i)).txt"
        (
            req_start=$(date +%s%N)
            status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
            req_end=$(date +%s%N)
            elapsed=$(( (req_end - req_start) / 1000000 ))
            echo "${status_code}:${elapsed}" > "$OUT_FILE"
        ) &
        BATCH_PIDS+=($!)
    done

    # Esperar batch
    for pid in "${BATCH_PIDS[@]}"; do
        wait "$pid" 2>/dev/null || true
    done
done

END=$(date +%s%N)
TOTAL_MS=$(( (END - START) / 1000000 ))

# Leer resultados
for f in "${TMPDIR}"/result_*.txt; do
    if [ -f "$f" ]; then
        IFS=':' read -r status elapsed < "$f"
        TIMES_MS+=("$elapsed")
        if [ "$status" = "200" ] || [ "$status" = "201" ]; then
            SUCCESS=$((SUCCESS + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    fi
done

# Calcular estadísticas
TOTAL=${#TIMES_MS[@]}
if [ "$TOTAL" -gt 0 ]; then
    SUM=0; MIN=99999; MAX=0
    for t in "${TIMES_MS[@]}"; do
        SUM=$((SUM + t))
        [ "$t" -lt "$MIN" ] && MIN=$t
        [ "$t" -gt "$MAX" ] && MAX=$t
    done
    AVG=$((SUM / TOTAL))
else
    MIN=0; MAX=0; AVG=0
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  Resultados"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Tiempo total:  ${TOTAL_MS}ms"
echo "  Requests:      ${TOTAL}"
echo "  Exitosos:      ${SUCCESS}"
echo "  Fallidos:      ${FAILED}"
echo "  Mínimo:        ${MIN}ms"
echo "  Máximo:        ${MAX}ms"
echo "  Promedio:      ${AVG}ms"
echo ""
log_success "Prueba de carga completada"
echo ""
