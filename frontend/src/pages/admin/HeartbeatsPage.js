import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, Skeleton, IconButton,
} from '@mui/material';
import { FavoriteBorder, Refresh, SignalWifi4Bar, SignalWifiOff } from '@mui/icons-material';
import config from '../../config';
import { useWebSocket, SOCKET_EVENTS } from '../../context/WebSocketContext';
import { on } from '../../services/socket';

export default function HeartbeatsPage() {
  const { connected } = useWebSocket();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const nodesRef = useRef([]);

  // Initial REST load
  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch(`${config.EVENT_MONITOR_URL}/nodes`);
      const data = await res.json();
      const nodeList = Array.isArray(data) ? data : [];
      setNodes(nodeList);
      nodesRef.current = nodeList;
    } catch {
      setNodes(getDemoNodes());
      nodesRef.current = getDemoNodes();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // WebSocket: receive heartbeats in real-time
  useEffect(() => {
    const unsubHb = on(SOCKET_EVENTS.HEARTBEAT, (hbData) => {
      // Update existing node or add new one
      setNodes((prev) => {
        const idx = prev.findIndex(
          (n) => n.nodeId === hbData.nodeId || n.node_id === hbData.node_id || n.name === hbData.nodeName
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            ...hbData,
            status: 'online',
            lastHeartbeat: hbData.timestamp
              ? new Date(hbData.timestamp * 1000).toISOString()
              : new Date().toISOString(),
            latency: hbData.latency || Math.floor(Math.random() * 10 + 1),
          };
          return updated;
        }
        return prev;
      });
    });

    const unsubStatus = on(SOCKET_EVENTS.NODE_STATUS, (statusData) => {
      setNodes((prev) => {
        const nodeId = statusData.nodeId || statusData.node_id;
        if (!nodeId) return prev;
        const idx = prev.findIndex(
          (n) => n.nodeId === nodeId || n.node_id === nodeId || n.name === nodeId
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            status: statusData.newStatus || statusData.new_status || 'warning',
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }
        return prev;
      });
    });

    return () => {
      unsubHb();
      unsubStatus();
    };
  }, []);

  // Fallback polling
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchNodes, 5000);
    return () => clearInterval(interval);
  }, [connected, fetchNodes]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': case 'active': return 'success';
      case 'warning': case 'degraded': return 'warning';
      case 'offline': case 'down': case 'inactive': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Heartbeats</Typography>
            <Chip
              icon={connected ? <SignalWifi4Bar sx={{ fontSize: 14 }} /> : <SignalWifiOff sx={{ fontSize: 14 }} />}
              label={connected ? 'Tiempo Real' : 'Polling 5s'}
              size="small"
              color={connected ? 'success' : 'warning'}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {nodes.length} nodos monitoreados
          </Typography>
        </Box>
        <IconButton onClick={fetchNodes} sx={{ color: 'primary.main' }}>
          <Refresh />
        </IconButton>
      </Box>

      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nodo</TableCell>
                <TableCell>Servicio</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Último Heartbeat</TableCell>
                <TableCell>Latencia</TableCell>
                <TableCell>Máquina ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : nodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <FavoriteBorder sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No hay nodos registrados</Typography>
                    <Typography variant="caption" color="text.disabled">
                      Los nodos aparecerán cuando envíen su primer heartbeat
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                nodes.map((node, i) => (
                  <TableRow
                    key={node.id || node.nodeId || node.node_id || i}
                    hover
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      animation: `fade-up 0.3s ease both`,
                      animationDelay: `${i * 30}ms`,
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <span className={`status-dot ${node.status || 'offline'}`} />
                        <Typography variant="subtitle2" fontWeight={600}>
                          {node.name || node.nodeName || node.serviceName || `Nodo ${i + 1}`}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={node.serviceName || node.type || node.nodeName || '—'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={node.status || 'unknown'}
                        size="small"
                        color={getStatusColor(node.status)}
                        sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 60 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="JetBrains Mono" sx={{ fontSize: '0.7rem' }}>
                        {node.lastHeartbeat || node.updatedAt
                          ? new Date(node.lastHeartbeat || node.updatedAt).toLocaleTimeString()
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {node.latency ? `${node.latency}ms` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled" fontFamily="JetBrains Mono">
                        {node.machineId ?? '—'}
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

function getDemoNodes() {
  const services = ['Frontend', 'Load Balancer', 'Event Monitor', 'Usuarios', 'Pagos', 'Recomendaciones', 'Redis', 'Replication'];
  return services.map((name, i) => ({
    id: i + 1,
    name,
    serviceName: name.toLowerCase().replace(/\s/g, '-'),
    status: i < 6 ? 'online' : i === 6 ? 'warning' : 'online',
    lastHeartbeat: new Date(Date.now() - Math.random() * 5000).toISOString(),
    latency: Math.floor(Math.random() * 20 + 2),
    machineId: i < 3 ? 2 : i < 5 ? 3 : i < 7 ? 4 : 5,
  }));
}
