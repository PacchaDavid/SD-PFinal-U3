# =============================================================================
# Circuit Breaker - Plataforma Distribuida de Streaming
# =============================================================================
# Implementación del patrón Circuit Breaker para los microservicios.
# Estados: CLOSED (normal), OPEN (fallando), HALF_OPEN (probando).
# Publica cambios de estado al Event Monitor vía Redis Pub/Sub.
# =============================================================================

__version__ = "1.0.0"
__app_name__ = "Circuit Breaker"
