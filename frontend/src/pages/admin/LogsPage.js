import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, MenuItem, Chip, Table,
  TableHead, TableBody, TableRow, TableCell, InputAdornment, IconButton,
  Skeleton, Select, FormControl, InputLabel, Grid, Badge,
} from '@mui/material';
import {
  Search, Clear, EventNote, Refresh, SignalWifi4Bar, SignalWifiOff,
} from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

const LEVELS = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
const SERVICES = ['todos', 'frontend', 'usuarios', 'pagos', 'recomendaciones', 'event-monitor', 'load-balancer', 'circuit-breaker', 'replication', 'redis'];

export default function LogsPage() {
  const { connected } = useWebSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('todos');
  const [newLogsCount, setNewLogsCount] = useState(0);
  const logsRef = useRef([]);

  // Initial REST load
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (levelFilter) params.append('level', levelFilter);
      if (serviceFilter && serviceFilter !== 'todos') params.append('service', serviceFilter);

      const res = await fetch(`${config.EVENT_MONITOR_URL}/events?${params}`);
      const data = await res.json();
      // Handle both array format and { events: [...] } object format
      const list = Array.isArray(data) ? data : (Array.isArray(data.events) ? data.events : []);
      setLogs(list);
      logsRef.current = list;
    } catch {
      setLogs(generateDemoLogs());
      logsRef.current = generateDemoLogs();
    } finally {
      setLoading(false);
    }
  }, [levelFilter, serviceFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // WebSocket: receive new events as log entries
  useEffect(() => {
    const unsub = on(SOCKET_EVENTS.EVENT, (eventData) => {
      // Convert event to log format
      const logEntry = {
        id: eventData.id || `ws-${Date.now()}`,
        level: (eventData.severity || 'info').toUpperCase(),
        serviceName: eventData.source || eventData.serviceName || 'system',
        message: eventData.message || '',
        timestamp: eventData.timestamp
          ? (eventData.timestamp.toString().length === 10 ? eventData.timestamp * 1000 : eventData.timestamp)
          : Date.now(),
        type: eventData.type,
      };

      setLogs((prev) => {
        // Apply filters client-side
        if (levelFilter && logEntry.level !== levelFilter) return prev;
        if (serviceFilter !== 'todos' && logEntry.serviceName !== serviceFilter) return prev;
        return [logEntry, ...prev].slice(0, 200);
      });
      setNewLogsCount((prev) => prev + 1);
    });

    return () => unsub();
  }, [levelFilter, serviceFilter]);

  // Clear new logs badge after 3 seconds
  useEffect(() => {
    if (newLogsCount === 0) return;
    const timer = setTimeout(() => setNewLogsCount(0), 3000);
    return () => clearTimeout(timer);
  }, [newLogsCount]);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchLogs, 6000);
    return () => clearInterval(interval);
  }, [connected, fetchLogs]);

  // Apply search filter (client-side)
  const filteredLogs = logs.filter((log) => {
    if (search && !JSON.stringify(log).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getLevelColor = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'ERROR': return 'error';
      case 'WARNING': case 'WARN': return 'warning';
      case 'INFO': return 'info';
      case 'DEBUG': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Logs del Sistema</Typography>
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
            {filteredLogs.length} registros — {connected ? 'actualización en tiempo real' : 'actualizando cada 6s'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {newLogsCount > 0 && (
            <Chip
              label={`+${newLogsCount} nuevos`}
              size="small"
              color="primary"
              sx={{ fontWeight: 600, fontSize: '0.7rem', animation: 'pulse-glow 1s ease-out' }}
            />
          )}
          <IconButton onClick={fetchLogs}><Refresh /></IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth size="small" placeholder="Buscar en logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><Clear fontSize="small" /></IconButton></InputAdornment> : null,
            }}
          />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Nivel</InputLabel>
            <Select value={levelFilter} label="Nivel" onChange={(e) => { setLevelFilter(e.target.value); setNewLogsCount(0); }}>
              <MenuItem value="">Todos</MenuItem>
              {LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Servicio</InputLabel>
            <Select value={serviceFilter} label="Servicio" onChange={(e) => { setServiceFilter(e.target.value); setNewLogsCount(0); }}>
              {SERVICES.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Logs Table */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0, maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 80 }}>Nivel</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Servicio</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Tiempo</TableCell>
                <TableCell>Mensaje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (<TableCell key={j}><Skeleton variant="text" /></TableCell>))}
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <EventNote sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No hay logs que coincidan</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log, i) => (
                  <TableRow
                    key={log.id || i}
                    hover
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      animation: i < 5 ? 'fade-up 0.3s ease both' : 'none',
                      animationDelay: `${i * 20}ms`,
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={log.level || 'INFO'}
                        size="small"
                        color={getLevelColor(log.level)}
                        sx={{ fontWeight: 600, fontSize: '0.65rem', minWidth: 60 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontWeight={500}>{log.serviceName || log.source || log.service || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" fontFamily="JetBrains Mono" sx={{ fontSize: '0.65rem' }}>
                        {log.timestamp || log.hora || log.createdAt || log._receivedAt
                          ? new Date(log.timestamp || log.hora || log.createdAt || log._receivedAt).toLocaleTimeString()
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {log.message || log.descripcion || log.description || '—'}
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

function generateDemoLogs() {
  const messages = [
    'Servicio iniciado correctamente',
    'Heartbeat recibido del nodo usuarios',
    'Circuit Breaker cambiado a OPEN',
    'Réplica 1 confirmó ACK',
    'Nuevo usuario registrado',
    'Pago procesado exitosamente',
    'Heartbeat perdido del nodo pagos',
    'Replicación completada: 3/3 ACKs',
    'Nodo recuperado después de timeout',
    'Circuit Breaker cambiado a HALF_OPEN',
  ];
  const services = ['usuarios', 'pagos', 'recomendaciones', 'event-monitor', 'load-balancer', 'circuit-breaker', 'replication', 'redis'];
  const levels = ['INFO', 'INFO', 'INFO', 'WARNING', 'ERROR'];

  return Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    level: levels[Math.floor(Math.random() * levels.length)],
    serviceName: services[Math.floor(Math.random() * services.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    timestamp: new Date(Date.now() - i * 120000 + Math.random() * 60000).toISOString(),
  }));
}
