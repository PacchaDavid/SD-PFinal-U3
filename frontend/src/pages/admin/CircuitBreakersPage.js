import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Skeleton, Table, TableHead,
  TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import {
  ReportProblem, LockOpen, Lock, Timeline, Refresh, CheckCircle,
  SignalWifi4Bar, SignalWifiOff,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

export default function CircuitBreakersPage() {
  const { connected } = useWebSocket();
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial REST load
  const fetchData = useCallback(async () => {
    try {
      // 1. Intentar desde el Circuit Breaker service directamente (datos reales)
      const cbRes = await fetch(`${config.CIRCUIT_BREAKER_URL}/circuits`);
      if (cbRes.ok) {
        const cbData = await cbRes.json();
        const cbList = Array.isArray(cbData) ? cbData : (Array.isArray(cbData.circuits) ? cbData.circuits : []);
        const mapped = cbList.map(cb => ({
          serviceName: cb.serviceName || cb.service || cb.service_name || cb.name || 'unknown',
          state: (cb.state || cb.status || 'CLOSED').toUpperCase(),
          failureCount: cb.failureCount ?? cb.failure_count ?? cb.fallos ?? 0,
          successCount: cb.successCount ?? cb.success_count ?? cb.exitos ?? 0,
          rejectionCount: cb.rejectionCount ?? cb.rejection_count ?? cb.rechazos ?? 0,
          threshold: cb.threshold ?? cb.failure_threshold ?? 5,
          stateChangedAt: cb.stateChangedAt || cb.state_changed_at || cb.last_updated || cb.timestamp || null,
        }));
        if (mapped.length > 0) {
          setCircuits(mapped);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback a Event Monitor
    }

    // 2. Fallback: Event Monitor /status
    try {
      const res = await fetch(`${config.EVENT_MONITOR_URL}/status`);
      const data = await res.json();
      const list = Array.isArray(data?.circuit_breakers) ? data.circuit_breakers : [];
      const mapped = list.map(cb => ({
        serviceName: cb.serviceName || cb.service || cb.circuitId || cb.circuit_id || cb.service_name || 'unknown',
        state: (cb.state || cb.status || 'CLOSED').toUpperCase(),
        failureCount: cb.failureCount ?? cb.failure_count ?? cb.fallos ?? 0,
        successCount: cb.successCount ?? cb.success_count ?? cb.exitos ?? 0,
        rejectionCount: cb.rejectionCount ?? cb.rejection_count ?? cb.rechazos ?? 0,
        threshold: cb.threshold ?? cb.failure_threshold ?? 5,
        stateChangedAt: cb.stateChangedAt || cb.state_changed_at || cb.last_updated || cb.timestamp || null,
      }));
      setCircuits(mapped);
    } catch {
      setCircuits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // WebSocket: receive circuit changes in real-time
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.CIRCUIT_CHANGE, (circuitData) => {
      const serviceName = circuitData.serviceName || circuitData.service || circuitData.circuitId || circuitData.circuit_id;
      if (!serviceName) return;

      setCircuits((prev) => {
        const idx = prev.findIndex(c => c.serviceName === serviceName);
        const entry = {
          serviceName,
          state: (circuitData.state || circuitData.newState || circuitData.status || 'CLOSED').toUpperCase(),
          failureCount: circuitData.failureCount ?? circuitData.fallos ?? 0,
          successCount: circuitData.successCount ?? circuitData.exitos ?? 0,
          rejectionCount: circuitData.rejectionCount ?? circuitData.rechazos ?? 0,
          threshold: circuitData.threshold ?? 5,
          stateChangedAt: circuitData.timestamp
            ? new Date((circuitData.timestamp.toString().length === 10 ? circuitData.timestamp * 1000 : circuitData.timestamp)).toISOString()
            : new Date().toISOString(),
        };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...entry };
          return updated;
        }
        return [...prev, entry];
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

  const circuitsClosed = circuits.filter(c => c.state === 'CLOSED').length;
  const circuitsOpen = circuits.filter(c => c.state === 'OPEN').length;
  const circuitsHalfOpen = circuits.filter(c => c.state === 'HALF_OPEN').length;

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
            {circuits.length > 0 ? `${circuits.length} circuitos monitoreados` : 'Sin datos de circuit breaker'}
          </Typography>
        </Box>
        <IconButton onClick={fetchData}><Refresh /></IconButton>
      </Box>

      {/* State Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['CLOSED', 'HALF_OPEN', 'OPEN'].map((state) => {
          const count = state === 'CLOSED' ? circuitsClosed : state === 'HALF_OPEN' ? circuitsHalfOpen : circuitsOpen;
          const colors = { CLOSED: 'success.main', HALF_OPEN: 'warning.main', OPEN: 'error.main' };
          return (
            <Grid item xs={4} key={state}>
              <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center', border: `1px solid ${colors[state]}33` }}>
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
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1, opacity: 0.5 }} />
                    <Typography color="success.light" fontWeight={600} sx={{ mb: 0.5 }}>
                      Todos los servicios saludables
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      No se han registrado fallos en los servicios. El Circuit Breaker Service aún no ha reportado datos,
                      pero todos los servicios responden correctamente a sus health checks.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : circuits.length > 0 && circuits.every(c => c.failureCount === 0 && c.state === 'CLOSED') ? (
                // All circuits are CLOSED with 0 failures
                circuits.map((cb, i) => (
                  <TableRow key={cb.serviceName || i} hover>
                    <TableCell><Typography variant="subtitle2" fontWeight={600}>{cb.serviceName}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        icon={<LockOpen sx={{ fontSize: 14 }} />}
                        label="CLOSED"
                        size="small"
                        color="success"
                        sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 80 }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" fontWeight={600}>0</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" fontWeight={600}>—</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary" fontWeight={600}>0</Typography></TableCell>
                    <TableCell><Chip label={cb.threshold ?? 5} size="small" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">—</Typography></TableCell>
                  </TableRow>
                ))
              ) : (
                circuits.map((cb, i) => (
                  <TableRow key={cb.serviceName || i} hover>
                    <TableCell><Typography variant="subtitle2" fontWeight={600}>{cb.serviceName}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        icon={getStateIcon(cb.state)}
                        label={cb.state || 'CLOSED'}
                        size="small"
                        color={getStateColor(cb.state)}
                        sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 80 }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="body2" color={cb.failureCount > 0 ? 'error.light' : 'text.secondary'} fontWeight={600}>{cb.failureCount}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="success.light" fontWeight={600}>{cb.successCount}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="warning.light" fontWeight={600}>{cb.rejectionCount}</Typography></TableCell>
                    <TableCell><Chip label={cb.threshold} size="small" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {cb.stateChangedAt ? formatDuration(new Date(cb.stateChangedAt)) : '—'}
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
