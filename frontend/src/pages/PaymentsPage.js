import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Skeleton, IconButton, Alert, Snackbar, Grid,
} from '@mui/material';
import { Add, Payment as PaymentIcon, CheckCircle, Cancel } from '@mui/icons-material';
import paymentsService from '../services/paymentsService';
import { useAuth } from '../context/AuthContext';

const PLAN_OPTIONS = [
  { value: 'BASIC', label: 'Básico', price: 9.99 },
  { value: 'STANDARD', label: 'Estándar', price: 14.99 },
  { value: 'PREMIUM', label: 'Premium', price: 19.99 },
];

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPayment, setNewPayment] = useState({ plan: 'BASIC', amount: 9.99 });
  const [processing, setProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadPayments();
  }, [user]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const data = await paymentsService.getByUser(user.id);
        setPayments(Array.isArray(data) ? data : []);
      }
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (plan) => {
    const selected = PLAN_OPTIONS.find(p => p.value === plan);
    setNewPayment({ plan, amount: selected?.price || 9.99 });
  };

  const handleCreatePayment = async () => {
    setProcessing(true);
    try {
      await paymentsService.create({
        userId: user.id,
        plan: newPayment.plan,
        amount: newPayment.amount,
        description: `Plan ${newPayment.plan}`,
      });
      setSnackbar({ open: true, message: 'Pago creado exitosamente', severity: 'success' });
      setOpenDialog(false);
      loadPayments();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async (id) => {
    try {
      await paymentsService.process(id);
      setSnackbar({ open: true, message: 'Pago procesado', severity: 'success' });
      loadPayments();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': case 'COMPLETED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': case 'FAILED': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ animation: 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            Pagos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {payments.length} transacciones registradas
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
          sx={{ borderRadius: 2 }}
        >
          Nuevo Pago
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {PLAN_OPTIONS.map((plan) => (
          <Grid item xs={12} sm={4} key={plan.value}>
            <Card sx={{ textAlign: 'center', p: 2, borderRadius: 2 }}>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                ${plan.price}
              </Typography>
              <Typography variant="body2" fontWeight={600}>{plan.label}</Typography>
              <Typography variant="caption" color="text.secondary">/mes</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Payments Table */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Monto</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <PaymentIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No hay pagos registrados</Typography>
                    <Button size="small" onClick={() => setOpenDialog(true)} sx={{ mt: 1 }}>Crear primer pago</Button>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell><Typography variant="caption" fontFamily="JetBrains Mono">{payment.id}</Typography></TableCell>
                    <TableCell>
                      <Chip label={payment.plan || payment.description} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>${payment.amount?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status || 'PENDING'}
                        size="small"
                        color={getStatusColor(payment.status)}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {payment.status === 'PENDING' && (
                        <Button size="small" variant="outlined" onClick={() => handleProcess(payment.id)}>
                          Procesar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Nuevo Pago</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth select label="Plan" value={newPayment.plan}
              onChange={(e) => handlePlanChange(e.target.value)}
              sx={{ mb: 2.5 }}
            >
              {PLAN_OPTIONS.map((plan) => (
                <MenuItem key={plan.value} value={plan.value}>
                  {plan.label} — ${plan.price}/mes
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth label="Monto" type="number" value={newPayment.amount}
              InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography> }}
              disabled
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreatePayment} disabled={processing}>
            {processing ? 'Procesando...' : 'Crear Pago'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
