import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Skeleton,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import {
  FavoriteBorder, Storage, ReportProblem, EventNote, CheckCircle, Sync,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

export default function DashboardPage() {
  const { connected } = useWebSocket();
  const [data, setData] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hbMetrics, setHbMetrics] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, statusRes, eventsRes] = await Promise.all([
        fetch(`${config.EVENT_MONITOR_URL}/metrics`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/status`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/events?limit=20`).then(r => r.json()).catch(() => ({})),
      ]);
      setHbMetrics(metricsRes);
      setCircuits(Array.isArray(statusRes?.circuit_breakers) ? statusRes.circuit_breakers : []);
      const eventList = Array.isArray(eventsRes) ? eventsRes : (Array.isArray(eventsRes?.events) ? eventsRes.events : []);
      setRecentEvents(eventList.slice(0, 15));
      setData(statusRes);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // WebSocket updates
  useEffect(() => {
    const unsubMetrics = on(SOCKET_EVENTS.METRICS, (m) => {
      if (m) setHbMetrics(prev => ({ ...prev, ...m }));
    });
    const unsubCircuit = on(SOCKET_EVENTS.CIRCUIT_CHANGE, (c) => {
      setCircuits(prev => {
        const svc = c.serviceName || c.service || c.circuitId;
        if (!svc) return prev;
        const idx = prev.findIndex(x => (x.serviceName || x.service) === svc);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...c, state: c.state || c.newState || updated[idx].state };
          return updated;
        }
        return [...prev, { serviceName: svc, state: c.state || 'CLOSED', ...c }];
      });
    });
    const unsubEvent = on(SOCKET_EVENTS.EVENT, (e) => {
      setRecentEvents(prev => [e, ...prev].slice(0, 15));
    });
    return () => { unsubMetrics(); unsubCircuit(); unsubEvent(); };
  }, []);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [connected, fetchData]);

  if (loading && !data) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} key={i}><Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} /></Grid>
        ))}
      </Grid>
    );
  }

  const activeNodes = hbMetrics?.active_nodes ?? data?.nodes?.active_nodes ?? 0;
  const totalNodes = hbMetrics?.total_nodes ?? data?.nodes?.total_nodes ?? 0;
  const totalHeartbeats = hbMetrics?.total_heartbeats ?? 0;
  const circuitsClosed = circuits.filter(c => (c.state || '').toUpperCase() === 'CLOSED').length;
  const circuitsOpen = circuits.filter(c => (c.state || '').toUpperCase() === 'OPEN').length;
  const circuitsHalfOpen = circuits.filter(c => (c.state || '').toUpperCase() === 'HALF_OPEN').length;

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Panel de Monitoreo</Typography>
        <Chip
          label={connected ? '🔌 Tiempo Real' : '⏳ REST Polling'}
          size="small"
          color={connected ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Top Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(52,211,153,0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FavoriteBorder sx={{ fontSize: 32, color: 'success.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={800}>{activeNodes}/{totalNodes}</Typography>
                <Typography variant="caption" color="text.secondary">Nodos Activos · {totalHeartbeats} heartbeats</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(96,165,250,0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Sync sx={{ fontSize: 32, color: 'info.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={800}>{data?.nodes?.total_nodes || 0}</Typography>
                <Typography variant="caption" color="text.secondary">Operaciones Replicadas</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(251,191,36,0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ReportProblem sx={{ fontSize: 32, color: 'warning.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={800}>{circuits.length || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Circuitos: {circuitsClosed}C · {circuitsOpen ? `${circuitsOpen}O` : ''} {circuitsHalfOpen ? `${circuitsHalfOpen}H` : ''}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(124,92,252,0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EventNote sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={800}>{data?.events_total || 0}</Typography>
                <Typography variant="caption" color="text.secondary">Eventos del Sistema</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Two-column layout: Circuit Breakers + Quorum/Replication */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Circuit Breakers */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Circuit Breakers</Typography>
                <Chip
                  icon={<ReportProblem sx={{ fontSize: 14 }} />}
                  label={circuits.length > 0 ? `${circuitsClosed} CLOSED · ${circuitsOpen} OPEN · ${circuitsHalfOpen} HALF_OPEN` : 'Sin datos'}
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                />
              </Box>
              {circuits.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1, opacity: 0.6 }} />
                  <Typography color="success.light" fontWeight={600}>Todos los servicios saludables</Typography>
                  <Typography variant="caption" color="text.secondary">No se han detectado fallos — todos los circuitos están CLOSED</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Servicio</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Fallos</TableCell>
                      <TableCell>Éxitos</TableCell>
                      <TableCell>Threshold</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {circuits.map((cb, i) => (
                      <TableRow key={cb.serviceName || cb.service || i} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{cb.serviceName || cb.service || `CB ${i + 1}`}</Typography></TableCell>
                        <TableCell>
                          <Chip
                            label={cb.state || 'CLOSED'}
                            size="small"
                            color={(cb.state || '').toUpperCase() === 'OPEN' ? 'error' : (cb.state || '').toUpperCase() === 'HALF_OPEN' ? 'warning' : 'success'}
                            sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 70 }}
                          />
                        </TableCell>
                        <TableCell><Typography variant="body2" color={cb.failureCount > 0 ? 'error.light' : 'text.secondary'} fontWeight={600}>{cb.failureCount ?? cb.fallos ?? 0}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="success.light" fontWeight={600}>{cb.successCount ?? cb.exitos ?? 0}</Typography></TableCell>
                        <TableCell><Chip label={cb.threshold ?? 5} size="small" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Replication / Quorum */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Replicación y Quorum</Typography>
                <Chip icon={<Storage sx={{ fontSize: 14 }} />} label="3 réplicas por servicio" size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
              </Box>

              {/* Quorum Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2, p: 2, bgcolor: 'rgba(52,211,153,0.06)', borderRadius: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800} color="success.main">2/3</Typography>
                  <Typography variant="caption" color="text.secondary">Quorum mínimo</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Estado del Quorum</Typography>
                  <Typography variant="caption" color="text.secondary">
                    El Replication Manager requiere al menos 2 de 3 réplicas para confirmar una operación.
                    Si 2 réplicas confirman (ACK), la operación se considera exitosa.
                  </Typography>
                </Box>
              </Box>

              {/* Services with replication */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Servicio</TableCell>
                    <TableCell>Primary DB</TableCell>
                    <TableCell>Réplicas</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {['usuarios', 'recomendaciones', 'pagos'].map(svc => (
                    <TableRow key={svc} hover>
                      <TableCell><Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{svc}</Typography></TableCell>
                      <TableCell><Chip icon={<Storage sx={{ fontSize: 12 }} />} label="Online" size="small" color="success" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem' }} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {[1, 2, 3].map(r => (
                            <Chip key={r} label={`R${r}`} size="small" color="success" sx={{ fontWeight: 600, fontSize: '0.6rem', height: 20 }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell><Chip label="Quorum OK" size="small" color="success" sx={{ fontWeight: 600, fontSize: '0.65rem' }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Events / Logs */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Eventos Recientes</Typography>
            <Chip label={`${recentEvents.length} eventos`} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 80 }}>Nivel</TableCell>
                <TableCell sx={{ width: 100 }}>Servicio</TableCell>
                <TableCell sx={{ width: 80 }}>Hora</TableCell>
                <TableCell>Mensaje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No hay eventos recientes — el sistema está estable</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                recentEvents.map((ev, i) => (
                  <TableRow key={ev.id || i} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Chip
                        label={ev.severity || ev.level || 'INFO'}
                        size="small"
                        color={(ev.severity || ev.level || '').toUpperCase() === 'ERROR' ? 'error' : (ev.severity || ev.level || '').toUpperCase() === 'WARNING' ? 'warning' : 'info'}
                        sx={{ fontWeight: 600, fontSize: '0.6rem', height: 20 }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="caption" fontWeight={500}>{ev.source || ev.serviceName || ev.service || '—'}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" fontFamily="JetBrains Mono" sx={{ fontSize: '0.65rem' }}>
                        {ev.timestamp || ev._receivedAt
                          ? new Date((ev.timestamp?.toString().length === 10 ? ev.timestamp * 1000 : ev.timestamp) || ev._receivedAt).toLocaleTimeString()
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{ev.message || ev.descripcion || '—'}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
