import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Alert,
  Snackbar, Switch, FormControlLabel, Divider, TextField, MenuItem,
} from '@mui/material';
import {
  PowerSettingsNew, Refresh, Warning, Error as ErrorIcon,
  CheckCircle, WifiOff, Speed, Storage, FavoriteBorder,
} from '@mui/icons-material';
import config from '../../config';

const SERVICES = [
  { value: 'usuarios', label: 'Usuarios (8081)' },
  { value: 'pagos', label: 'Pagos (8083)' },
  { value: 'recomendaciones', label: 'Recomendaciones (8091)' },
];

export default function SimulationPage() {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedService, setSelectedService] = useState('usuarios');
  const [processing, setProcessing] = useState(null);

  const showMessage = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const simulateEvent = async (type, data = {}) => {
    setProcessing(type);
    try {
      await fetch(`${config.EVENT_MONITOR_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          serviceName: data.serviceName || selectedService,
          message: data.message || `Simulación: ${type}`,
          level: data.level || 'INFO',
          timestamp: new Date().toISOString(),
        }),
      });
      showMessage(`Evento "${type}" enviado para ${data.serviceName || selectedService}`);
    } catch {
      showMessage(`Simulado: ${type} — (sin conexión al Event Monitor)`, 'warning');
    } finally {
      setProcessing(null);
    }
  };

  const actions = [
    {
      group: 'Servicios',
      items: [
        { icon: <PowerSettingsNew />, label: 'Detener Servicio', color: 'error', action: () => simulateEvent('servicio_detenido', { level: 'ERROR', message: 'Servicio detenido por simulación' }) },
        { icon: <Refresh />, label: 'Reiniciar Servicio', color: 'warning', action: () => simulateEvent('servicio_iniciado', { level: 'INFO', message: 'Servicio reiniciado tras simulación' }) },
        { icon: <CheckCircle />, label: 'Servicio OK', color: 'success', action: () => simulateEvent('nodo_recuperado', { level: 'INFO', message: 'Servicio recuperado correctamente' }) },
      ],
    },
    {
      group: 'Heartbeats',
      items: [
        { icon: <FavoriteBorder />, label: 'Perder Heartbeat', color: 'error', action: () => simulateEvent('heartbeat_perdido', { level: 'WARNING', message: 'Heartbeat perdido — timeout de 5 segundos' }) },
        { icon: <FavoriteBorder />, label: 'Restaurar Heartbeat', color: 'success', action: () => simulateEvent('heartbeat_recibido', { level: 'INFO', message: 'Heartbeat restaurado — latencia normal' }) },
      ],
    },
    {
      group: 'Circuit Breaker',
      items: [
        { icon: <Warning />, label: 'Abrir Circuit Breaker', color: 'error', action: () => simulateEvent('circuit_abierto', { level: 'WARNING', message: 'Circuit Breaker cambiado a OPEN — umbral de fallos superado' }) },
        { icon: <CheckCircle />, label: 'Cerrar Circuit Breaker', color: 'success', action: () => simulateEvent('circuit_cerrado', { level: 'INFO', message: 'Circuit Breaker cambiado a CLOSED — recuperación exitosa' }) },
      ],
    },
    {
      group: 'Replicación',
      items: [
        { icon: <Storage />, label: 'Fallo Réplica', color: 'error', action: () => simulateEvent('replica_fallo', { level: 'ERROR', message: 'Réplica 2 sin respuesta — timeout de conexión' }) },
        { icon: <Storage />, label: 'Recuperar Réplica', color: 'success', action: () => simulateEvent('nodo_recuperado', { level: 'INFO', message: 'Réplica 2 recuperada — replicación reanudada' }) },
      ],
    },
    {
      group: 'Latencia',
      items: [
        { icon: <Speed />, label: 'Latencia Alta', color: 'warning', action: () => simulateEvent('latencia_alta', { level: 'WARNING', message: 'Latencia de replicación superior a 500ms' }) },
        { icon: <Speed />, label: 'Latencia Normal', color: 'success', action: () => simulateEvent('latencia_normal', { level: 'INFO', message: 'Latencia restaurada a valores normales' }) },
      ],
    },
  ];

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Simulación de Fallos</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Dispara eventos simulados para probar la respuesta del sistema en tiempo real
      </Typography>

      {/* Service Selector */}
      <Card sx={{ borderRadius: 2, mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>Servicio destino:</Typography>
          {SERVICES.map(s => (
            <Chip
              key={s.value}
              label={s.label}
              onClick={() => setSelectedService(s.value)}
              color={selectedService === s.value ? 'primary' : 'default'}
              variant={selectedService === s.value ? 'filled' : 'outlined'}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Box>
      </Card>

      {/* Action Grid */}
      {actions.map((group) => (
        <Box key={group.group} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary' }}>
            {group.group}
          </Typography>
          <Grid container spacing={1.5}>
            {group.items.map((item) => (
              <Grid item xs={6} sm={4} md={2.4} key={item.label}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={item.icon}
                  onClick={item.action}
                  disabled={processing === item.label}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: `rgba(${item.color === 'error' ? '239,68,68' : item.color === 'warning' ? '251,191,36' : item.color === 'success' ? '52,211,153' : '124,92,252'}, 0.2)`,
                    color: `${item.color}.${item.color === 'warning' ? 'main' : 'light'}`,
                    '&:hover': {
                      borderColor: `${item.color}.main`,
                      bgcolor: `rgba(${item.color === 'error' ? '239,68,68' : item.color === 'warning' ? '251,191,36' : item.color === 'success' ? '52,211,153' : '124,92,252'}, 0.08)`,
                    },
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    justifyContent: 'flex-start',
                  }}
                >
                  {item.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* Info */}
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Los eventos simulados se enviarán al Event Monitor y aparecerán en el Timeline y Logs del sistema.
        Si el Event Monitor no está disponible, la simulación se registrará localmente.
      </Alert>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
