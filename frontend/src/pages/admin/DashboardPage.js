import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Skeleton, Paper,
} from '@mui/material';
import {
  Dns, Memory, Storage, CloudQueue, Speed,
  People, MovieCreation,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

const STATUS_COLORS = { online: '#34d399', warning: '#fbbf24', offline: '#ef4444' };

export default function DashboardPage() {
  const { connected } = useWebSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const eventsRef = useRef([]);

  // Initial REST load
  const fetchInitialData = useCallback(async () => {
    try {
      const [nodes, circuits, replication, events, health] = await Promise.all([
        fetch(`${config.EVENT_MONITOR_URL}/api/nodes`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/api/circuits`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/api/replication`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/api/events?limit=50`).then(r => r.json()).catch(() => ({})),
        fetch(`${config.EVENT_MONITOR_URL}/health`).then(r => r.json()).catch(() => ({})),
      ]);
      const fullData = { nodes, circuits, replication, events, health };
      setData(fullData);

      // Build chart from events
      const eventList = Array.isArray(events) ? events : [];
      eventsRef.current = eventList;
      setChartData(buildChartData(eventList));
    } catch {
      // Still use demo data if everything fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    // Update chart when new event arrives via WebSocket
    const unsubEvent = on(SOCKET_EVENTS.EVENT, (eventData) => {
      eventsRef.current = [eventData, ...eventsRef.current].slice(0, 100);
      setChartData(buildChartData(eventsRef.current));
    });

    // Refresh full dashboard data when system_status arrives
    const unsubStatus = on(SOCKET_EVENTS.SYSTEM_STATUS, () => {
      // Light refresh — don't block UI
      fetchInitialData();
    });

    return () => {
      unsubEvent();
      unsubStatus();
    };
  }, [fetchInitialData]);

  // Fallback: REST polling when WebSocket not connected
  useEffect(() => {
    if (connected) return; // WebSocket handles updates
    const interval = setInterval(fetchInitialData, 8000);
    return () => clearInterval(interval);
  }, [connected, fetchInitialData]);

  if (loading && !data) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const onlineCount = nodes.filter(n => n.status === 'online' || n.status === 'active').length;
  const warningCount = nodes.filter(n => n.status === 'warning' || n.status === 'degraded').length;
  const offlineCount = nodes.filter(n => n.status === 'offline' || n.status === 'inactive').length;
  const totalNodes = nodes.length || 8;

  const metricCards = [
    { label: 'Servicios Activos', value: `${onlineCount}/${totalNodes}`, icon: <Dns />, color: 'success.main', bg: 'rgba(52,211,153,0.08)' },
    { label: 'Circuit Breakers', value: data?.circuits?.length || 0, icon: <Speed />, color: 'warning.main', bg: 'rgba(251,191,36,0.08)' },
    { label: 'Eventos (24h)', value: events.length, icon: <CloudQueue />, color: 'info.main', bg: 'rgba(96,165,250,0.08)' },
    { label: 'Réplicas', value: data?.replication?.replicas || 3, icon: <Storage />, color: 'secondary.main', bg: 'rgba(255,107,157,0.08)' },
    { label: 'Usuarios', value: data?.health?.totalUsers || '—', icon: <People />, color: 'primary.main', bg: 'rgba(124,92,252,0.08)' },
    { label: 'Películas', value: data?.health?.totalMovies || '—', icon: <MovieCreation />, color: 'success.light', bg: 'rgba(110,231,183,0.08)' },
  ];

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard del Sistema</Typography>
        <Chip
          label={connected ? '🔌 Tiempo Real' : '⏳ REST Polling'}
          size="small"
          color={connected ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metricCards.map((card, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Card
              sx={{
                p: 2, borderRadius: 2, textAlign: 'center',
                border: `1px solid ${card.bg}`,
                '&:hover': { borderColor: card.color },
                animation: `fade-up 0.4s ease both`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <Box sx={{ color: card.color, mb: 0.5 }}>{card.icon}</Box>
              <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                {card.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts + Status */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 2, p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
              Actividad del Sistema
              {connected && <span className="status-dot online" style={{ marginLeft: 8, verticalAlign: 'middle' }} />}
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" stroke="#5a5a72" fontSize={11} />
                <YAxis stroke="#5a5a72" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    bgcolor: '#12121a', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: '#f1f1f6',
                  }}
                />
                <Area type="monotone" dataKey="events" stroke="#7c5cfc" fill="url(#colorEvents)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, p: 2, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Estado de Servicios</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { name: 'Online', count: onlineCount, color: STATUS_COLORS.online },
                { name: 'Warning', count: warningCount, color: STATUS_COLORS.warning },
                { name: 'Offline', count: offlineCount, color: STATUS_COLORS.offline },
              ].map((item) => (
                <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                    <Typography variant="body2">{item.name}</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{item.count}</Typography>
                </Box>
              ))}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" color="text.secondary">Total Nodos</Typography>
                <Typography variant="h4" fontWeight={800}>{totalNodes}</Typography>
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Conexión</Typography>
                <Chip
                  label={connected ? 'WebSocket Activo' : 'REST Polling'}
                  size="small"
                  color={connected ? 'success' : 'warning'}
                  sx={{ mt: 0.5, fontWeight: 600, fontSize: '0.7rem' }}
                />
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function buildChartData(events) {
  if (!Array.isArray(events) || events.length === 0) {
    // Return default empty chart buckets
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 3600000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      events: 0,
    }));
  }

  const now = Date.now();
  const data = [];
  for (let i = 11; i >= 0; i--) {
    const startTime = now - (i + 1) * 3600000;
    const endTime = now - i * 3600000;
    const count = events.filter((e) => {
      const t = new Date(e.timestamp || e.hora || e.createdAt || 0).getTime();
      return t >= startTime && t < endTime;
    }).length;
    data.push({
      time: new Date(endTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      events: count,
    });
  }
  return data;
}
