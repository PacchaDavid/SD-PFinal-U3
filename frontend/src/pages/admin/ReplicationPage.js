import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Skeleton, Table, TableHead,
  TableBody, TableRow, TableCell, LinearProgress,
} from '@mui/material';
import {
  Storage, CheckCircle, Sync, SignalWifi4Bar, SignalWifiOff,
  Warning as WarningIcon, Error as ErrorIcon, GroupWork,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

const SERVICE_NAMES = {
  usuarios: { label: 'Usuarios', port: 8081, db: 'streaming_usuarios' },
  pagos: { label: 'Pagos', port: 8083, db: 'streaming_pagos' },
  recomendaciones: { label: 'Recomendaciones', port: 8091, db: 'streaming_recomendaciones' },
};

export default function ReplicationPage() {
  const { connected } = useWebSocket();
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial REST load
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        fetch(`${config.EVENT_MONITOR_URL}/status`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/events?limit=30`).then(r => r.json()).catch(() => ({})),
      ]);
      setData(statusRes);

      // Filter replication events
      const eventList = Array.isArray(eventsRes) ? eventsRes : (Array.isArray(eventsRes?.events) ? eventsRes.events : []);
      const replEvents = eventList
        .filter(e => (e.type || '').toLowerCase().includes('replic'))
        .slice(0, 20);
      setEntries(replEvents.length > 0 ? replEvents : eventList.slice(0, 15));
    } catch {
      setData({});
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // WebSocket: receive new replication events
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.REPLICATION, (replData) => {
      setEntries((prev) => [replData, ...prev].slice(0, 50));
      if (replData.ackCount !== undefined || replData.totalOps !== undefined) {
        setData((prev) => ({ ...(prev || {}), ...replData }));
      }
    });

    return () => unsub();
  }, []);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, [connected, fetchData]);

  if (loading && !data) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} key={i}><Skeleton variant="rounded" height={160} sx={{ borderRadius: 2 }} /></Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Replicación y Quorum</Typography>
        <Chip
          icon={connected ? <SignalWifi4Bar sx={{ fontSize: 14 }} /> : <SignalWifiOff sx={{ fontSize: 14 }} />}
          label={connected ? 'Tiempo Real' : 'Polling'}
          size="small"
          color={connected ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Quorum Info Card */}
      <Card sx={{ borderRadius: 2, mb: 3, p: 2, border: '1px solid rgba(52,211,153,0.15)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ textAlign: 'center', minWidth: 100 }}>
            <GroupWork sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h3" fontWeight={800} color="success.main">2/3</Typography>
            <Typography variant="caption" color="text.secondary">Quorum mínimo</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>¿Cómo funciona el Quorum?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.6 }}>
              Cada operación de escritura se replica a <strong>3 bases de datos réplica</strong>.
              El <strong>Replication Manager</strong> espera confirmación (ACK) de al menos <strong>2 de las 3 réplicas</strong>
              para considerar la operación como exitosa.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="3/3 ACK → REPLICATED" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip icon={<WarningIcon sx={{ fontSize: 14 }} />} label="2/3 ACK → PARTIAL (quorum mínimo)" size="small" color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip icon={<ErrorIcon sx={{ fontSize: 14 }} />} label="&lt;2 ACK → FAILED" size="small" color="error" variant="outlined" sx={{ fontWeight: 600 }} />
            </Box>
          </Box>
        </Box>
      </Card>

      {/* Services Replication Status */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Servicios y Réplicas</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Object.entries(SERVICE_NAMES).map(([key, svc]) => (
          <Grid item xs={12} md={4} key={key}>
            <Card sx={{ borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, textTransform: 'capitalize' }}>{svc.label}</Typography>

              {/* Primary DB */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Primary DB</Typography>
                <Chip label="🟢 Online" size="small" color="success" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
              </Box>

              {/* Quorum status bar */}
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Quorum</Typography>
                  <Typography variant="caption" fontWeight={700} color="success.main">2/3 mínimo — 3/3 online</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)' }}
                  color="success"
                />
              </Box>

              {/* Replicas */}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Réplicas</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[1, 2, 3].map(r => (
                  <Chip
                    key={r}
                    icon={<CheckCircle sx={{ fontSize: 12 }} />}
                    label={`Réplica ${r}`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                  />
                ))}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Replication Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <Sync sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>{entries.length}</Typography>
            <Typography variant="caption" color="text.secondary">Operaciones Replicadas</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>—</Typography>
            <Typography variant="caption" color="text.secondary">Tasa de ACK</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <Storage sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>3</Typography>
            <Typography variant="caption" color="text.secondary">Réplicas por Servicio</Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Replication Entries */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Entradas de Replicación</Typography>
        <Chip label={entries.length + ' registros'} size="small" variant="outlined" />
      </Box>
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID / Entry</TableCell>
                <TableCell>Servicio</TableCell>
                <TableCell>Operación</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>ACKs</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><Skeleton variant="text" /></TableCell>))}
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Storage sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary" sx={{ mb: 1 }}>No hay entradas de replicación</Typography>
                    <Box sx={{ textAlign: 'left', maxWidth: 500, mx: 'auto' }}>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
                        Las entradas aparecerán cuando se realicen operaciones de escritura.
                      </Typography>
                      <Typography variant="caption" fontWeight={600} color="primary.light" sx={{ display: 'block', mb: 0.5 }}>
                        📋 Para probar la replicación en vivo:
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                        1. Abre el Frontend en <strong>http://localhost:80</strong>
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                        2. Inicia sesión como <strong>admin@streaming.com</strong> / <strong>admin123</strong>
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                        3. Ve a <strong>Catálogo</strong> y agrega una película a tu lista
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                        4. <strong>O</strong> abre la <strong>Simulación</strong> y dispara eventos de replicación
                      </Typography>
                      <Typography variant="caption" color="success.light" sx={{ display: 'block' }}>
                        5. Vuelve aquí — las entradas aparecerán en tiempo real vía WebSocket
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                entries.slice(0, 20).map((entry, i) => (
                  <TableRow key={entry.id || i} hover>
                    <TableCell><Typography variant="caption" fontFamily="JetBrains Mono" sx={{ fontSize: '0.7rem' }}>{entry.id || entry.entry_id || `#${i + 1}`}</Typography></TableCell>
                    <TableCell>{entry.serviceName || entry.service || entry.source || '—'}</TableCell>
                    <TableCell>
                      <Chip label={entry.operation || entry.opType || entry.type || 'REPLICATION'} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.status || 'PENDING'}
                        size="small"
                        color={entry.status === 'REPLICATED' ? 'success' : (entry.status || '').includes('FAIL') ? 'error' : 'warning'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontWeight={600}>
                        {entry.ackCount ?? entry.acks ?? entry.ack_count ?? 0}/3
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" fontFamily="JetBrains Mono" sx={{ fontSize: '0.65rem' }}>
                        {entry.createdAt || entry.timestamp || entry._receivedAt
                          ? new Date(
                              (entry.timestamp?.toString().length === 10 ? entry.timestamp * 1000 : entry.timestamp)
                              || entry.createdAt || entry._receivedAt
                            ).toLocaleTimeString()
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
