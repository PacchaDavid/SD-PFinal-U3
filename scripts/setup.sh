#!/bin/bash
# =============================================================================
# setup.sh - Script de Configuración Inicial
# Plataforma Distribuida de Streaming
# =============================================================================
# Ejecutar una sola vez al clonar el repositorio en cada máquina.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  Configuración Inicial del Proyecto           ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Verificar Docker
log_info "Verificando Docker..."
if command -v docker &> /dev/null; then
    log_success "Docker $(docker --version)"
else
    log_error "Docker no instalado. Instálalo primero."
    exit 1
fi

# Verificar Docker Compose
log_info "Verificando Docker Compose..."
if docker compose version &> /dev/null; then
    log_success "Docker Compose $(docker compose version --short)"
else
    log_error "Docker Compose V2 no disponible."
    exit 1
fi

# Crear directorios necesarios
log_info "Creando directorios necesarios..."
mkdir -p logs

# Verificar que deploy.sh existe y es ejecutable
if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    log_success "deploy.sh listo"
else
    log_error "deploy.sh no encontrado"
    exit 1
fi

# Verificar estructura del proyecto
log_info "Verificando estructura del proyecto..."
required_dirs=(
    "frontend"
    "services/usuarios"
    "services/pagos"
    "services/recomendaciones"
    "infrastructure/event-monitor"
    "infrastructure/load-balancer"
    "infrastructure/circuit-breaker"
    "infrastructure/replication"
    "configs"
    "deployment/machine1"
    "deployment/machine2"
    "deployment/machine3"
    "deployment/machine4"
    "deployment/machine5"
    "docker"
    "scripts"
)

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        log_success "  ✓ $dir"
    else
        log_error "  ✗ $dir - No encontrado"
    fi
done

echo ""
log_success "Configuración inicial completada"
echo ""
echo "Próximos pasos:"
echo "  1. Configurar IPs en deployment/machine<ID>/.env"
echo "  2. Ejecutar: ./deploy.sh <machine_id>"
echo ""
