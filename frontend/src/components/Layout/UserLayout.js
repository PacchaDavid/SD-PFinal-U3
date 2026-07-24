import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Button, Avatar, Menu,
  MenuItem, Container, InputBase, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import {
  Menu as MenuIcon, Search as SearchIcon, Home as HomeIcon,
  MovieCreation as MovieIcon, Whatshot as TrendingIcon,
  Payment as PaymentIcon, Person as PersonIcon,
  Logout as LogoutIcon, Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import moviesService from '../../services/moviesService';

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'Inicio', path: '/', icon: <HomeIcon /> },
  { label: 'Catálogo', path: '/catalog', icon: <MovieIcon /> },
  { label: 'Recomendaciones', path: '/recommendations', icon: <TrendingIcon /> },
  { label: 'Pagos', path: '/payments', icon: <PaymentIcon /> },
  { label: 'Perfil', path: '/profile', icon: <PersonIcon /> },
];

export default function UserLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  const userName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1, px: { xs: 1, sm: 2 } }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #f1f1f6, #7c5cfc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer',
              letterSpacing: '-0.03em',
            }}
            onClick={() => navigate('/')}
          >
            StreamHub
          </Typography>

          {/* Search Bar */}
          <Box
            component="form"
            onSubmit={handleSearch}
            sx={{
              flex: 1,
              maxWidth: 480,
              mx: 2,
              position: 'relative',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <SearchIcon sx={{ position: 'absolute', left: 12, top: 10, color: 'text.disabled', fontSize: 20 }} />
            <InputBase
              placeholder="Buscar películas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: '100%',
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 2,
                px: 2,
                pl: 4.5,
                py: 0.8,
                fontSize: '0.9rem',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.06)',
                transition: 'all 0.2s',
                '&:focus-within': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
              }}
            />
          </Box>

          <Box sx={{ flex: 1, display: { xs: 'block', sm: 'none' } }} />

          {/* Nav Links - Desktop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
            {navItems.slice(0, 3).map((item) => (
              <Button
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  px: 1.5,
                  '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {/* Admin Button */}
          {isAdmin && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DashboardIcon />}
              onClick={() => navigate('/admin')}
              sx={{
                borderColor: 'rgba(124,92,252,0.3)',
                color: 'primary.light',
                fontSize: '0.8rem',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(124,92,252,0.08)' },
              }}
            >
              Panel
            </Button>
          )}

          {/* User Avatar */}
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
            <Avatar
              sx={{
                width: 34, height: 34,
                bgcolor: 'primary.main',
                fontSize: '0.85rem',
                fontWeight: 700,
                boxShadow: '0 0 12px rgba(124,92,252,0.3)',
              }}
            >
              {userInitial}
            </Avatar>
          </IconButton>

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
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="subtitle2" fontWeight={600}>{userName}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Mi Perfil
            </MenuItem>
            {isAdmin && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/admin'); }}>
                <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
                Panel Admin
              </MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.light' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ display: { lg: 'none' } }}
        PaperProps={{ sx: { width: DRAWER_WIDTH, bgcolor: '#0a0a0f' } }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #f1f1f6, #7c5cfc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            StreamHub
          </Typography>
        </Toolbar>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <List>
          {navItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => { navigate(item.path); setDrawerOpen(false); }}
                selected={location.pathname === item.path}
                sx={{
                  borderRadius: 1,
                  mx: 1,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(124,92,252,0.12)',
                    '&:hover': { bgcolor: 'rgba(124,92,252,0.18)' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: '64px',
          minHeight: '100vh',
        }}
      >
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
