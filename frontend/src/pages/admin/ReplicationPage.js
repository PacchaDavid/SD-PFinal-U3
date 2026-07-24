import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Skeleton, Table, TableHead,
  TableBody, TableRow, TableCell, LinearProgress,
} from '@mui/material';
import {
  Storage, CheckCircle, Sync, SignalWifi4Bar, SignalWifiOff,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

export default function ReplicationPage() {
  const { connected } = useWebSocket();
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial REST load
  const fetchData = useCallback(async () => {
    try {
      const [replication, replEntries] = await Promise.all([
        fetch(`${config.EVENT_MONITOR_URL}/status`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/events?limit=20`).then(r => r.json()).catch(() => ({})),
      ]);
      setData(replication);
      setEntries(Array.isArray(replEntries) ? replEntries : []);
    } catch {
      setData(generateDemoData().replication);
      setEntries(generateDemoData().entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket: receive new replication events
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.REPLICATION, (replData) => {
      // Update entries if this is an entry
      if (replData.operation || replData.opType) {
        setEntries((prev) => {
          const updated = [replData, ...prev].slice(0, 50);
          return updated;
        });
      }
      // Update replication summary
      if (replData.ackCount !== undefined || replData.totalOps !== undefined) {
        setData((prev) => ({
          ...(prev || {}),
          ...replData,
          ackRate: replData.ackRate ?? prev?.ackRate,
          totalOps: replData.totalOps ?? prev?.totalOps,
        }));
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

  const repl = data || {};
  const replicas = repl.replicas || [
    { id: 1, name: 'Réplica 1', status: 'online', lag: 12, latency: 3 },
    { id: 2, name: 'Réplica 2', status: 'online', lag: 8, latency: 5 },
    { id: 3, name: 'Réplica 3', status: 'warning', lag: 45, latency: 12 },
  ];
  const ackRate = repl.ackRate ?? 87;
  const totalOps = repl.totalOps ?? 156;

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Estado de Replicación</Typography>
        <Chip
          icon={connected ? <SignalWifi4Bar sx={{ fontSize: 14 }} /> : <SignalWifiOff sx={{ fontSize: 14 }} />}
          label={connected ? 'Tiempo Real' : 'Polling'}
          size="small"
          color={connected ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <Sync sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>{totalOps}</Typography>
            <Typography variant="caption" color="text.secondary">Operaciones Totales</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>{ackRate}%</Typography>
            <Typography variant="caption" color="text.secondary">Tasa de ACK</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
            <Storage sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={800}>{replicas.length}</Typography>
            <Typography variant="caption" color="text.secondary">Réplicas Configuradas</Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Replica Cards */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Réplicas</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {replicas.map((replica) => (
          <Grid item xs={12} sm={6} md={4} key={replica.id || replica.name}>
            <Card sx={{ borderRadius: 2, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>{replica.name}</Typography>
                <Chip
                  label={replica.status}
                  size="small"
                  color={replica.status === 'online' ? 'success' : replica.status === 'warning' ? 'warning' : 'error'}
                  sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                />
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Lag de replicación</Typography>
                  <Typography variant="caption" fontWeight={600}>{replica.lag ?? 0}ms</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, ((replica.lag ?? 0) / 100) * 100)}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)' }}
                  color={replica.status === 'online' ? 'success' : 'warning'}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Latencia</Typography>
                <Typography variant="caption" fontWeight={600}>{replica.latency ?? '—'}ms</Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Entries */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Entradas Recientes</Typography>
        <Chip label={entries.length + ' registros'} size="small" variant="outlined" />
      </Box>
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
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
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No hay entradas de replicación</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.slice(0, 15).map((entry, i) => (
                  <TableRow key={entry.id || i} hover>
                    <TableCell><Typography variant="caption" fontFamily="JetBrains Mono">{entry.id || `#${i + 1}`}</Typography></TableCell>
                    <TableCell>{entry.serviceName || entry.service || '—'}</TableCell>
                    <TableCell>
                      <Chip label={entry.operation || entry.opType || 'INSERT'} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.status || 'PENDING'}
                        size="small"
                        color={entry.status === 'REPLICATED' ? 'success' : entry.status === 'FAILED' ? 'error' : 'warning'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontWeight={600}>
                        {entry.ackCount ?? entry.acks ?? 0}/3
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {entry.createdAt || entry.timestamp ? new Date(entry.createdAt || entry.timestamp).toLocaleTimeString() : '—'}
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

function generateDemoData() {
  return {
    replication: { ackRate: 87, totalOps: 156, replicas: [
      { id: 1, name: 'Réplica 1', status: 'online', lag: 12, latency: 3 },
      { id: 2, name: 'Réplica 2', status: 'online', lag: 8, latency: 5 },
      { id: 3, name: 'Réplica 3', status: 'warning', lag: 45, latency: 12 },
    ]},
    entries: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      serviceName: ['usuarios', 'pagos', 'recomendaciones'][i % 3],
      operation: ['INSERT', 'UPDATE', 'DELETE'][i % 3],
      status: i === 7 ? 'FAILED' : ['REPLICATED', 'REPLICATED', 'PENDING'][i % 3],
      ackCount: i === 7 ? 0 : [3, 3, 1][i % 3],
      createdAt: new Date(Date.now() - i * 120000).toISOString(),
    })),
  };
}
