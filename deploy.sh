#!/bin/bash
# =============================================================================
# deploy.sh - Script de Despliegue Unificado
# Plataforma Distribuida de Streaming
# =============================================================================
# Uso: ./deploy.sh <machine_id>
# Ejemplo: ./deploy.sh 1  # Despliega Máquina 1 (Frontend)
#          ./deploy.sh 2  # Despliega Máquina 2 (Infraestructura)
# =============================================================================

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables globales para cleanup
_MACHINE_ID=""
_ENV_FILE=""

# =============================================================================
# Funciones de utilidad
# =============================================================================
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Cleanup: detener servicios al presionar Ctrl+C
# =============================================================================
cleanup() {
    echo ""
    log_warn "╔═══════════════════════════════════════════╗"
    log_warn "║  Ctrl+C detectado — Deteniendo servicios  ║"
    log_warn "╚═══════════════════════════════════════════╝"
    echo ""

    if [ -n "$_MACHINE_ID" ] && [ -n "$_ENV_FILE" ]; then
        local profile="machine${_MACHINE_ID}"
        log_info "Deteniendo Máquina ${_MACHINE_ID} (perfil: ${profile})..."
        docker compose --env-file "$_ENV_FILE" --profile "$profile" down --remove-orphans 2>/dev/null || true
        log_success "Servicios de Máquina ${_MACHINE_ID} detenidos"
    else
        log_info "No hay servicios activos que detener"
    fi

    echo ""
    log_info "Saliendo..."
    exit 0
}

# =============================================================================
# Validaciones iniciales
# =============================================================================
validate_env() {
    local machine_id=$1
    local env_file="deployment/machine${machine_id}/.env"
    local example_file="deployment/machine${machine_id}/.env.example"

    if [ ! -f "$env_file" ]; then
        if [ -f "$example_file" ]; then
            log_info "Creando $env_file desde $example_file..."
            cp "$example_file" "$env_file"
            log_success "Archivo .env creado: $env_file"
        else
            log_error "Archivo .env no encontrado: $env_file"
            log_error "Tampoco existe el .env.example: $example_file"
            exit 1
        fi
    fi

    log_info "Usando configuración: $env_file"
    source "$env_file"

    # Establecer archivo env para Docker Compose
    ENV_FILE="deployment/machine${machine_id}/.env"

    # Validar que docker está instalado
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado"
        exit 1
    fi

    # Validar que docker compose está disponible
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose (V2) no está disponible"
        exit 1
    fi
}

# =============================================================================
# Despliegue de servicios
# =============================================================================
deploy_machine() {
    local machine_id=$1
    local profile="machine${machine_id}"

    log_info "=========================================="
    log_info "Desplegando Máquina ${machine_id}"
    log_info "Perfil Docker Compose: ${profile}"
    log_info "Archivo .env: ${ENV_FILE}"
    log_info "=========================================="

    # Limpiar contenedores previos de este perfil
    log_info "Limpiando contenedores previos..."
    docker compose --env-file "$ENV_FILE" --profile "$profile" down --remove-orphans 2>/dev/null || true

    # Construir imágenes (con cache para builds rápidos)
    log_info "Construyendo imágenes..."
    docker compose --env-file "$ENV_FILE" --profile "$profile" build --parallel

    # Iniciar servicios
    log_info "Iniciando servicios..."
    docker compose --env-file "$ENV_FILE" --profile "$profile" up -d

    log_success "Máquina ${machine_id} desplegada exitosamente"
}

# =============================================================================
# Verificación de servicios
# =============================================================================
check_services() {
    local machine_id=$1
    local profile="machine${machine_id}"

    log_info "Verificando estado de servicios..."
    sleep 5

    docker compose --env-file "$ENV_FILE" --profile "$profile" ps

    local unhealthy_count
    unhealthy_count=$(docker compose --env-file "$ENV_FILE" --profile "$profile" ps --format json | python3 -c "
import sys, json
unhealthy = 0
for line in sys.stdin:
    try:
        status = json.loads(line).get('Health', '')
        if status == 'unhealthy':
            unhealthy += 1
    except:
        pass
print(unhealthy)
" 2>/dev/null || echo "0")

    if [ "$unhealthy_count" -gt 0 ]; then
        log_warn "${unhealthy_count} servicio(s) con estado 'unhealthy'"
    else
        log_success "Todos los servicios saludables"
    fi
}

# =============================================================================
# Registro en Event Monitor
# =============================================================================
register_node() {
    local machine_id=$1
    local env_file="deployment/machine${machine_id}/.env"
    source "$env_file"

    local event_monitor_url="${EVENT_MONITOR_URL:-http://localhost:8082}"

    log_info "Registrando nodo en Event Monitor..."

    local payload=$(cat <<EOF
{
    "node_id": "machine-${machine_id}",
    "node_name": "${MACHINE_NAME:-Machine ${machine_id}}",
    "service_name": "machine",
    "machine_id": ${machine_id},
    "host": "${MACHINE_IP:-unknown}",
    "port": 0,
    "tags": {
        "ip": "${MACHINE_IP:-unknown}",
        "role": "${MACHINE_NAME:-Machine ${machine_id}}"
    }
}
EOF
)

    # Intentar registro (no crítico si falla)
    curl -s -X POST "${event_monitor_url}/nodes" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>/dev/null || log_warn "No se pudo registrar en Event Monitor (arrancará después)"
}

# =============================================================================
# Main
# =============================================================================
main() {
    # Mostrar banner
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║  Plataforma Distribuida de Streaming          ║"
    echo "║  Script de Despliegue Unificado               ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""

    # Validar argumentos
    if [ $# -lt 1 ]; then
        echo "Uso: $0 <machine_id> [options]"
        echo ""
        echo "Machine IDs:"
        echo "  1  - Frontend Web"
        echo "  2  - Infraestructura Central (Event Monitor, Load Balancer, Redis)"
        echo "  3  - Microservicio Usuarios"
        echo "  4  - Microservicio Recomendaciones"
        echo "  5  - Microservicio Pagos"
        echo ""
        echo "Options:"
        echo "  --stop          Detener servicios de esta máquina"
        echo "  --skip-build    Omitir construcción de imágenes"
        echo "  --skip-health   Omitir verificación de salud"
        echo ""
        exit 1
    fi

    local machine_id=$1
    local stop_services=false
    local skip_build=false
    local skip_health=false

    # Parsear opciones adicionales
    shift
    for arg in "$@"; do
        case $arg in
            --stop) stop_services=true ;;
            --skip-build) skip_build=true ;;
            --skip-health) skip_health=true ;;
            *) log_warn "Opción desconocida: $arg" ;;
        esac
    done

    # Validar machine_id
    if ! [[ "$machine_id" =~ ^[1-5]$ ]]; then
        log_error "Machine ID debe ser 1, 2, 3, 4 o 5"
        exit 1
    fi

    # Guardar IDs globales para cleanup
    _MACHINE_ID="$machine_id"
    _ENV_FILE="deployment/machine${machine_id}/.env"

    # Trap para Ctrl+C (SIGINT) y terminación (SIGTERM)
    trap cleanup SIGINT SIGTERM

    # Validar entorno
    validate_env "$machine_id"

    # --stop: detener servicios y salir
    if [ "$stop_services" = true ]; then
        log_info "Deteniendo servicios de Máquina ${machine_id}..."
        docker compose --env-file "$ENV_FILE" --profile "machine${machine_id}" down --remove-orphans
        log_success "Máquina ${machine_id} detenida"
        exit 0
    fi

    # Desplegar
    if [ "$skip_build" = false ]; then
        deploy_machine "$machine_id"
    else
        log_info "Omitiendo construcción de imágenes"
        docker compose --env-file "$ENV_FILE" --profile "machine${machine_id}" up -d
    fi

    # Verificar
    if [ "$skip_health" = false ]; then
        check_services "$machine_id"
    fi

    # Registrar nodo
    register_node "$machine_id"

    # Remover trap: Ctrl+C ya no detiene servicios después del despliegue exitoso
    trap - SIGINT SIGTERM

    echo ""
    log_success "═══════════════════════════════════════════"
    log_success "Máquina ${machine_id} operativa"
    log_success "═══════════════════════════════════════════"
    echo ""

    # Mostrar resumen de puertos
    echo "Puertos expuestos:"
    case $machine_id in
        1) echo "  Frontend:    http://localhost:80" ;;
        2) echo "  Load Balancer: http://localhost:8000"
           echo "  Event Monitor: http://localhost:8082"
           echo "  Redis:         localhost:6379" ;;
        3) echo "  Usuarios:    http://localhost:8081"
           echo "  DB Primary:  localhost:3307"
           echo "  DB Replica1: localhost:3308"
           echo "  DB Replica2: localhost:3309"
           echo "  DB Replica3: localhost:3310" ;;
        4) echo "  Recomendaciones: http://localhost:8091"
           echo "  DB Primary:  localhost:3311"
           echo "  DB Replica1: localhost:3312"
           echo "  DB Replica2: localhost:3313"
           echo "  DB Replica3: localhost:3314" ;;
        5) echo "  Pagos:       http://localhost:8083"
           echo "  DB Primary:  localhost:3315"
           echo "  DB Replica1: localhost:3316"
           echo "  DB Replica2: localhost:3317"
           echo "  DB Replica3: localhost:3318" ;;
    esac
    echo ""
}

# Ejecutar
main "$@"
