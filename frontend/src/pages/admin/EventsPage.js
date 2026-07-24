import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Skeleton, IconButton, Button,
} from '@mui/material';
import {
  CloudQueue, PlayArrow, Pause, Refresh, SignalWifi4Bar, SignalWifiOff,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

const EVENT_COLORS = {
  'heartbeat.received': 'success',
  'heartbeat.missed': 'error',
  'heartbeat.restored': 'success',
  'node.registered': 'info',
  'node.unregistered': 'error',
  'node.status_change': 'warning',
  'system.startup': 'info',
  'system.shutdown': 'error',
  'circuit.opened': 'error',
  'circuit.closed': 'success',
  'circuit.half_open': 'warning',
  'replication.started': 'info',
  'replication.completed': 'success',
  'replication.failed': 'error',
  'replication.ack': 'success',
  'service.up': 'success',
  'service.down': 'error',
  'service.degraded': 'warning',
};

function getEventColor(type) {
  return EVENT_COLORS[type] || (type?.includes('error') || type?.includes('failed') || type?.includes('down') || type?.includes('missed') ? 'error'
    : type?.includes('warning') || type?.includes('degraded') || type?.includes('half') ? 'warning'
    : type?.includes('success') || type?.includes('completed') || type?.includes('up') || type?.includes('restored') || type?.includes('closed') ? 'success'
    : 'info');
}

function getEventLabel(type) {
  return (type || '')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EventsPage() {
  const { connected } = useWebSocket();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const eventsRef = useRef([]);
  const listRef = useRef(null);

  // Initial REST load
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${config.EVENT_MONITOR_URL}/events?limit=50`);
      const data = await res.json();
      const eventList = Array.isArray(data) ? data : [];
      eventsRef.current = eventList;
      setEvents(eventList);
    } catch {
      const demo = generateDemoEvents();
      eventsRef.current = demo;
      setEvents(demo);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // WebSocket: receive new events in real-time
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.EVENT, (eventData) => {
      if (paused) return;
      // Prepend new event
      setEvents((prev) => {
        const updated = [eventData, ...prev].slice(0, 100);
        return updated;
      });
      // Auto-scroll to top
      if (listRef.current) {
        listRef.current.scrollTop = 0;
      }
    });

    return () => unsub();
  }, [paused]);

  // Fallback polling when WebSocket is not connected
  useEffect(() => {
    if (connected || paused) return;
    const interval = setInterval(fetchEvents, 4000);
    return () => clearInterval(interval);
  }, [connected, paused, fetchEvents]);

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Timeline de Eventos</Typography>
            <Chip
              icon={connected ? <SignalWifi4Bar sx={{ fontSize: 14 }} /> : <SignalWifiOff sx={{ fontSize: 14 }} />}
              label={connected ? 'En Vivo' : 'Polling'}
              size="small"
              color={connected ? 'success' : 'warning'}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {events.length} eventos — {connected ? 'actualización en tiempo real' : 'actualizando cada 4s'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={paused ? 'contained' : 'outlined'}
            startIcon={paused ? <PlayArrow /> : <Pause />}
            onClick={() => setPaused(!paused)}
            sx={{ borderRadius: 2, minWidth: 100 }}
          >
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <IconButton onClick={fetchEvents}><Refresh /></IconButton>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent
          ref={listRef}
          sx={{
            maxHeight: 'calc(100vh - 240px)',
            overflow: 'auto',
            p: 2,
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
          }}
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <Skeleton variant="circular" width={8} height={8} />
                <Skeleton variant="text" width={100} />
                <Skeleton variant="text" width={200} />
              </Box>
            ))
          ) : events.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CloudQueue sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">No hay eventos registrados</Typography>
              <Typography variant="caption" color="text.disabled">
                Los eventos aparecerán cuando los componentes del sistema comiencen a reportar
              </Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Timeline vertical line */}
              <Box sx={{
                position: 'absolute', left: 11, top: 0, bottom: 0,
                width: 2, bgcolor: 'rgba(255,255,255,0.06)',
              }} />

              {events.map((event, i) => {
                const eventType = event.type || event.eventType || 'info';
                const color = getEventColor(eventType);
                return (
                  <Box
                    key={event.id || i}
                    sx={{
                      position: 'relative',
                      mb: 2,
                      animation: `slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) both`,
                      animationDelay: `${Math.min(i * 15, 300)}ms`,
                    }}
                  >
                    {/* Timeline dot */}
                    <Box sx={{
                      position: 'absolute', left: -21, top: 6,
                      width: 10, height: 10, borderRadius: '50%',
                      bgcolor: color === 'error' ? '#ef4444'
                        : color === 'warning' ? '#fbbf24'
                        : color === 'success' ? '#34d399'
                        : '#60a5fa',
                      boxShadow: `0 0 8px ${
                        color === 'error' ? 'rgba(239,68,68,0.4)'
                        : color === 'warning' ? 'rgba(251,191,36,0.4)'
                        : color === 'success' ? 'rgba(52,211,153,0.4)'
                        : 'rgba(96,165,250,0.4)'
                      }`,
                      zIndex: 1,
                    }} />

                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3, flexWrap: 'wrap' }}>
                        <Chip
                          label={getEventLabel(eventType)}
                          size="small"
                          color={color}
                          sx={{ fontWeight: 600, fontSize: '0.65rem', height: 22 }}
                        />
                        <Typography variant="caption" color="text.secondary" fontFamily="JetBrains Mono" sx={{ fontSize: '0.65rem' }}>
                          {event.timestamp || event.hora || event._receivedAt
                            ? new Date(
                                (event.timestamp?.toString().length === 10 ? event.timestamp * 1000 : event.timestamp)
                                || event.hora || event._receivedAt
                              ).toLocaleTimeString()
                            : '—'}
                        </Typography>
                        {event.source && (
                          <Chip label={event.source} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
                        )}
                        {event.serviceName && (
                          <Chip label={event.serviceName} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
                        )}
                        {event.severity && event.severity !== 'info' && (
                          <Chip
                            label={event.severity}
                            size="small"
                            color={event.severity === 'error' ? 'error' : event.severity === 'warning' ? 'warning' : 'default'}
                            sx={{ height: 20, fontSize: '0.6rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {event.message || event.descripcion || event.description || getEventLabel(eventType)}
                      </Typography>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.disabled" fontFamily="JetBrains Mono" sx={{ fontSize: '0.6rem' }}>
                            {JSON.stringify(event.metadata).slice(0, 120)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function generateDemoEvents() {
  const types = [
    'heartbeat.received', 'heartbeat.missed', 'node.registered',
    'system.startup', 'circuit.opened', 'circuit.closed',
    'replication.completed', 'replication.ack', 'service.up', 'service.down',
  ];
  const messages = [
    'Heartbeat recibido — latencia 3ms',
    'Circuit Breaker cambiado a CLOSED',
    'Réplica 1 confirmó ACK (2/3)',
    'Solicitud procesada exitosamente',
    'Nodo recuperado después de timeout',
    'Latencia de replicación: 120ms',
    'Heartbeat perdido — timeout 5s',
    'Circuit Breaker cambiado a OPEN',
  ];
  const sources = ['usuarios', 'pagos', 'recomendaciones', 'event-monitor', 'load-balancer', 'circuit-breaker', 'replication', 'redis', 'frontend'];
  return Array.from({ length: 30 }, (_, i) => ({
    id: `demo-${i + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    source: sources[Math.floor(Math.random() * sources.length)],
    severity: Math.random() > 0.8 ? 'warning' : 'info',
    timestamp: Date.now() - i * 180000 + Math.random() * 60000,
  }));
}
