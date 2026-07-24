import api from './api';

const paymentsService = {
  getAll: async () => {
    try {
      const response = await api.get('/api/pagos/api/pagos');
      return response.data;
    } catch {
      throw new Error('Error al cargar pagos');
    }
  },

  getByUser: async (userId) => {
    try {
      const response = await api.get(`/api/pagos/api/pagos/user/${userId}`);
      return response.data;
    } catch {
      return [];
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/api/pagos/api/pagos', data);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Error al crear pago';
      throw new Error(message);
    }
  },

  process: async (id) => {
    try {
      const response = await api.post(`/api/pagos/api/pagos/${id}/process`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Error al procesar pago';
      throw new Error(message);
    }
  },
};

export default paymentsService;
