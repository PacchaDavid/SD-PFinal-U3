import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Skeleton, Table, TableHead,
  TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import {
  ReportProblem, LockOpen, Lock, Timeline, Refresh, SignalWifi4Bar, SignalWifiOff,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

export default function CircuitBreakersPage() {
  const { connected } = useWebSocket();
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const circuitsRef = useRef([]);

  // Initial REST load
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${config.EVENT_MONITOR_URL}/api/circuits`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCircuits(list);
      circuitsRef.current = list;
    } catch {
      const demo = getDemoCircuits();
      setCircuits(demo);
      circuitsRef.current = demo;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket: receive circuit changes in real-time
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.CIRCUIT_CHANGE, (circuitData) => {
      const serviceName = circuitData.serviceName || circuitData.service || circuitData.circuitId || circuitData.circuit_id;
      if (!serviceName) return;

      setCircuits((prev) => {
        const idx = prev.findIndex(
          (c) => c.serviceName === serviceName || c.service === serviceName || c.id === serviceName
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            ...circuitData,
            state: circuitData.state || circuitData.newState || circuitData.status || updated[idx].state,
            failureCount: circuitData.failureCount ?? circuitData.fallos ?? updated[idx].failureCount,
            successCount: circuitData.successCount ?? circuitData.exitos ?? updated[idx].successCount,
            stateChangedAt: circuitData.timestamp
              ? new Date((circuitData.timestamp.toString().length === 10 ? circuitData.timestamp * 1000 : circuitData.timestamp)).toISOString()
              : new Date().toISOString(),
          };
          return updated;
        }
        // New circuit breaker
        return [...prev, { serviceName, state: circuitData.state || 'CLOSED', ...circuitData }];
      });
    });

    return () => unsub();
  }, []);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, [connected, fetchData]);

  const getStateColor = (state) => {
    switch ((state || '').toUpperCase()) {
      case 'CLOSED': return 'success';
      case 'HALF_OPEN': return 'warning';
      case 'OPEN': return 'error';
      default: return 'default';
    }
  };

  const getStateIcon = (state) => {
    switch ((state || '').toUpperCase()) {
      case 'CLOSED': return <LockOpen sx={{ fontSize: 14 }} />;
      case 'OPEN': return <Lock sx={{ fontSize: 14 }} />;
      case 'HALF_OPEN': return <Timeline sx={{ fontSize: 14 }} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Circuit Breakers</Typography>
            <Chip
              icon={connected ? <SignalWifi4Bar sx={{ fontSize: 14 }} /> : <SignalWifiOff sx={{ fontSize: 14 }} />}
              label={connected ? 'Tiempo Real' : 'Polling'}
              size="small"
              color={connected ? 'success' : 'warning'}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {circuits.length} circuitos monitoreados
          </Typography>
        </Box>
        <IconButton onClick={fetchData}><Refresh /></IconButton>
      </Box>

      {/* State Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['CLOSED', 'HALF_OPEN', 'OPEN'].map((state) => {
          const count = circuits.filter(c => (c.state || c.status || '').toUpperCase() === state).length;
          const colors = { CLOSED: 'success.main', HALF_OPEN: 'warning.main', OPEN: 'error.main' };
          return (
            <Grid item xs={4} key={state}>
              <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center', border: `1px solid ${colors[state]}` }}>
                <Typography variant="h3" fontWeight={800} color={colors[state]}>{count}</Typography>
                <Typography variant="caption" color="text.secondary">{state}</Typography>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Circuit Breaker Table */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Servicio</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fallos</TableCell>
                <TableCell>Éxitos</TableCell>
                <TableCell>Rechazos</TableCell>
                <TableCell>Threshold</TableCell>
                <TableCell>Tiempo en Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (<TableCell key={j}><Skeleton variant="text" /></TableCell>))}
                  </TableRow>
                ))
              ) : circuits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <ReportProblem sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No hay circuit breakers registrados</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                circuits.map((cb, i) => (
                  <TableRow key={cb.id || cb.serviceName || cb.service || i} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {cb.serviceName || cb.service || `Servicio ${i + 1}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStateIcon(cb.state || cb.status)}
                        label={cb.state || cb.status || 'CLOSED'}
                        size="small"
                        color={getStateColor(cb.state || cb.status)}
                        sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="error.light" fontWeight={600}>
                        {cb.failureCount ?? cb.fallos ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="success.light" fontWeight={600}>
                        {cb.successCount ?? cb.exitos ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="warning.light" fontWeight={600}>
                        {cb.rejectionCount ?? cb.rechazos ?? 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cb.threshold ?? 5} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {cb.stateChangedAt || cb.updatedAt
                          ? formatDuration(new Date(cb.stateChangedAt || cb.updatedAt))
                          : '—'}
                      </Typography>
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

function formatDuration(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

function getDemoCircuits() {
  return [
    { serviceName: 'usuarios', state: 'CLOSED', failureCount: 2, successCount: 145, rejectionCount: 0, threshold: 5, stateChangedAt: new Date(Date.now() - 300000).toISOString() },
    { serviceName: 'pagos', state: 'CLOSED', failureCount: 1, successCount: 89, rejectionCount: 0, threshold: 5, stateChangedAt: new Date(Date.now() - 600000).toISOString() },
    { serviceName: 'recomendaciones', state: 'HALF_OPEN', failureCount: 7, successCount: 203, rejectionCount: 12, threshold: 5, stateChangedAt: new Date(Date.now() - 45000).toISOString() },
  ];
}
