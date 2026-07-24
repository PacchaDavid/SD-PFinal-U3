import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Skeleton,
} from '@mui/material';
import config from '../../config';

const NODE_STYLES = {
  online: { bg: 'rgba(52,211,153,0.12)', border: '#34d399', glow: 'rgba(52,211,153,0.2)' },
  warning: { bg: 'rgba(251,191,36,0.12)', border: '#fbbf24', glow: 'rgba(251,191,36,0.2)' },
  offline: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', glow: 'rgba(239,68,68,0.2)' },
};

export default function TopologyPage() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch(`${config.EVENT_MONITOR_URL}/nodes`);
        const data = await res.json();
        setNodes(Array.isArray(data) ? data : []);
      } catch {
        setNodes(getDemoNodes());
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
    const interval = setInterval(fetchNodes, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Topología del Sistema</Typography>

      {loading ? (
        <Skeleton variant="rounded" height={500} sx={{ borderRadius: 2 }} />
      ) : (
        <Box
          sx={{
            position: 'relative',
            minHeight: 500,
            p: 4,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Background grid pattern */}
          <Box sx={{
            position: 'absolute', inset: 0,
            opacity: 0.03,
            backgroundImage: 'radial-gradient(circle, #7c5cfc 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          {/* Connection lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.12)" />
              </marker>
            </defs>
            <line x1="50%" y1="15%" x2="50%" y2="35%" stroke="rgba(255,255,255,0.08)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <line x1="50%" y1="35%" x2="25%" y2="60%" stroke="rgba(255,255,255,0.08)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <line x1="50%" y1="35%" x2="75%" y2="60%" stroke="rgba(255,255,255,0.08)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            <line x1="25%" y1="60%" x2="25%" y2="80%" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            <line x1="75%" y1="60%" x2="75%" y2="80%" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            <line x1="50%" y1="60%" x2="50%" y2="80%" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
          </svg>

          {/* Layer 1: Frontend */}
          <TopologyNode
            label="Frontend React"
            subtitle="Máquina 1"
            status="online"
            x="50%"
            y="12%"
            icon="🌐"
          />

          {/* Layer 2: Load Balancer */}
          <TopologyNode
            label="Load Balancer"
            subtitle="Python · Puerto 8080"
            status="online"
            x="50%"
            y="32%"
            icon="⚖️"
          />

          {/* Layer 3: Services */}
          <Box sx={{ position: 'absolute', top: '52%', left: '8%', right: '8%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 2 }}>
              <TopologyNode label="Usuarios" subtitle="Spring Boot :8081" status="online" icon="👤" />
              <TopologyNode label="Pagos" subtitle="Spring Boot :8083" status="warning" icon="💳" />
              <TopologyNode label="Recomendaciones" subtitle="Spring Boot :8091" status="online" icon="🎬" />
            </Box>
          </Box>

          {/* Layer 4: DB + Replicas */}
          <Box sx={{ position: 'absolute', bottom: '8%', left: '5%', right: '5%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 1.5 }}>
              {['Primary DB', 'Réplica 1', 'Réplica 2', 'Réplica 3'].map((name, i) => (
                <TopologyNode
                  key={name}
                  label={name}
                  subtitle={`MariaDB`}
                  status={i === 3 ? 'warning' : 'online'}
                  icon="🗄️"
                  small
                />
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Node List Summary */}
      <Card sx={{ mt: 3, borderRadius: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Estado de Nodos</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {nodes.length > 0 ? nodes.map((node) => (
              <Chip
                key={node.id || node.name}
                label={`${node.name || node.serviceName}`}
                size="small"
                color={node.status === 'online' ? 'success' : node.status === 'warning' ? 'warning' : 'error'}
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            )) : (
              ['Frontend', 'Load Balancer', 'Event Monitor', 'Usuarios', 'Pagos', 'Recomendaciones', 'Redis', 'Replication'].map((name) => (
                <Chip key={name} label={name} size="small" color="success" variant="outlined" sx={{ fontWeight: 500 }} />
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function TopologyNode({ label, subtitle, status, icon, small }) {
  const colors = NODE_STYLES[status] || NODE_STYLES.online;
  return (
    <Card
      className="liquid-glass"
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: small ? 1.5 : 2,
        borderRadius: 2,
        border: `1px solid ${colors.border}33`,
        boxShadow: `0 0 20px ${colors.glow}`,
        minWidth: small ? 90 : 140,
        zIndex: 1,
        position: 'relative',
        '&:hover': {
          borderColor: colors.border,
          boxShadow: `0 0 30px ${colors.glow}`,
          transform: 'translateY(-4px)',
        },
      }}
    >
      <Typography variant={small ? 'h5' : 'h4'} sx={{ mb: 0.5 }}>{icon}</Typography>
      <Typography variant="caption" fontWeight={700} sx={{ fontSize: small ? '0.65rem' : '0.75rem' }}>
        {label}
      </Typography>
      {!small && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', mt: 0.3 }}>
          {subtitle}
        </Typography>
      )}
      <span className={`status-dot ${status}`} style={{ marginTop: small ? 4 : 8 }} />
    </Card>
  );
}

function getDemoNodes() {
  return [
    { name: 'Frontend', status: 'online', serviceName: 'frontend' },
    { name: 'Load Balancer', status: 'online', serviceName: 'load-balancer' },
    { name: 'Event Monitor', status: 'online', serviceName: 'event-monitor' },
    { name: 'Usuarios', status: 'online', serviceName: 'usuarios' },
    { name: 'Pagos', status: 'warning', serviceName: 'pagos' },
    { name: 'Recomendaciones', status: 'online', serviceName: 'recomendaciones' },
    { name: 'Redis', status: 'online', serviceName: 'redis' },
    { name: 'Replication', status: 'online', serviceName: 'replication' },
  ];
}
