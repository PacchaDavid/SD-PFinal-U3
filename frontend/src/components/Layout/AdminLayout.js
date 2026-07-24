import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Divider, Avatar, Menu,
  MenuItem, Chip, Button,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, FavoriteBorder,
  CloudQueue, Storage, ReportProblem, EventNote, DonutLarge,
  Settings, AdminPanelSettings, Home as HomeIcon,
  Logout as LogoutIcon, Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const DRAWER_WIDTH = 260;

const adminNavItems = [
  { label: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { label: 'Topología', path: '/admin/topology', icon: <DonutLarge /> },
  { label: 'Heartbeats', path: '/admin/heartbeats', icon: <FavoriteBorder /> },
  { label: 'Replicación', path: '/admin/replication', icon: <Storage /> },
  { label: 'Circuit Breakers', path: '/admin/circuit-breakers', icon: <ReportProblem /> },
  { label: 'Logs', path: '/admin/logs', icon: <EventNote /> },
  { label: 'Eventos', path: '/admin/events', icon: <CloudQueue /> },
  { label: 'Simulación', path: '/admin/simulation', icon: <Settings /> },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  const userName = user?.name || user?.email?.split('@')[0] || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase();

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Toolbar sx={{ gap: 1.5 }}>
        <Avatar
          sx={{
            width: 36, height: 36,
            bgcolor: 'primary.main',
            fontWeight: 800,
            fontSize: '0.9rem',
          }}
        >
          S
        </Avatar>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            StreamHub
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Panel de Administración
          </Typography>
        </Box>
      </Toolbar>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Nav Items */}
      <List sx={{ flex: 1, px: 1, pt: 1 }}>
        {adminNavItems.map((item) => {
          const isActive = item.path === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  py: 1.2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(124,92,252,0.12)',
                    '&:hover': { bgcolor: 'rgba(124,92,252,0.18)' },
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '& .MuiListItemText-primary': { color: 'primary.light', fontWeight: 600 },
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Bottom section */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
          sx={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'text.secondary',
            fontSize: '0.8rem',
            mb: 0.5,
            '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: 'rgba(255,255,255,0.03)' },
          }}
        >
          Ir al Sitio
        </Button>
        <Chip
          label="ADMIN"
          size="small"
          icon={<AdminPanelSettings sx={{ fontSize: 14 }} />}
          sx={{
            width: '100%',
            bgcolor: 'rgba(124,92,252,0.12)',
            color: 'primary.light',
            fontWeight: 600,
            fontSize: '0.7rem',
            '& .MuiChip-icon': { ml: 0.5 },
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            bgcolor: '#0a0a0f',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: '#0a0a0f' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Admin Top Bar */}
        <AppBar position="sticky" elevation={0}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' }, mr: 1 }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" fontWeight={700} sx={{ flex: 1, fontSize: '1.1rem' }}>
              {adminNavItems.find((i) =>
                i.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(i.path)
              )?.label || 'Panel'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label="Sistema Activo"
                size="small"
                icon={<span className="status-dot online" style={{ margin: 0 }} />}
                sx={{
                  bgcolor: 'rgba(52,211,153,0.1)',
                  color: 'success.light',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: { xs: 'none', sm: 'flex' },
                }}
              />
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar
                  sx={{
                    width: 32, height: 32,
                    bgcolor: 'primary.main',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {userInitial}
                </Avatar>
              </IconButton>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 200,
                  bgcolor: '#12121a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                },
              }}
            >
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="subtitle2" fontWeight={600}>{userName}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                Mi Perfil
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/'); }}>
                <ListItemIcon><HomeIcon fontSize="small" /></ListItemIcon>
                Ver Sitio
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: 'error.light' }}>
                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                Cerrar Sesión
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
