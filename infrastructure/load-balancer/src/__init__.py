# =============================================================================
# Load Balancer - Plataforma Distribuida de Streaming
# =============================================================================
# Balanceador de carga para los microservicios del sistema.
# Recibe requests en el puerto 8000 y las enruta a los servicios
# backend (usuarios, pagos, recomendaciones) usando round-robin.
# =============================================================================

__version__ = "1.0.0"
__app_name__ = "Load Balancer"
