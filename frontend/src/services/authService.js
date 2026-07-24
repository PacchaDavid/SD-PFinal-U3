import api from './api';

const authService = {
  login: async (email, password) => {
    try {
      const response = await api.post('/api/usuarios/api/auth/login', { email, password });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Error al iniciar sesión';
      throw new Error(message);
    }
  },

  register: async (data) => {
    try {
      const response = await api.post('/api/usuarios/api/auth/register', data);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Error al registrarse';
      throw new Error(message);
    }
  },

  getProfile: async () => {
    try {
      const response = await api.get('/api/usuarios/api/users/me');
      return response.data;
    } catch (error) {
      throw new Error('Error al obtener perfil');
    }
  },

  updateProfile: async (data) => {
    try {
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
      const response = await api.put(`/api/usuarios/api/users/${userId}`, data);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Error al actualizar perfil';
      throw new Error(message);
    }
  },
};

export default authService;
