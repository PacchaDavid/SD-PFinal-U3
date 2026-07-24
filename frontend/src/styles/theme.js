import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c5cfc',
      light: '#9d85ff',
      dark: '#5b3fd8',
    },
    secondary: {
      main: '#ff6b9d',
      light: '#ff8fb4',
      dark: '#e04a7a',
    },
    success: {
      main: '#34d399',
      light: '#6ee7b7',
      dark: '#059669',
    },
    warning: {
      main: '#fbbf24',
      light: '#fcd34d',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#2563eb',
    },
    background: {
      default: '#0a0a0f',
      paper: '#12121a',
    },
    text: {
      primary: '#f1f1f6',
      secondary: '#9c9cb0',
      disabled: '#5a5a72',
    },
    divider: 'rgba(255, 255, 255, 0.06)',
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.03em',
      fontSize: 'clamp(2rem, 4vw, 3rem)',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.85rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 500,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    },
    fontFamilyMon: "'JetBrains Mono', monospace",
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a3a transparent',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: '#2a2a3a',
            borderRadius: 3,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
          transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(124, 92, 252, 0.35)',
          },
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.12)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
            background: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.15)',
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.08)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#7c5cfc',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#9c9cb0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          padding: '12px 16px',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#0a0a0f',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: '0.8rem',
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
