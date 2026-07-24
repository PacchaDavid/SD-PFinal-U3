import api from './api';

const moviesService = {
  getAll: async () => {
    try {
      const response = await api.get('/api/recomendaciones/api/recomendaciones');
      return response.data;
    } catch {
      throw new Error('Error al cargar catálogo');
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/${id}`);
      return response.data;
    } catch {
      throw new Error('Película no encontrada');
    }
  },

  getFeatured: async () => {
    try {
      const response = await api.get('/api/recomendaciones/api/recomendaciones/featured');
      return response.data;
    } catch {
      return [];
    }
  },

  getByGenre: async (genre) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/genre/${encodeURIComponent(genre)}`);
      return response.data;
    } catch {
      return [];
    }
  },

  search: async (query) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch {
      return [];
    }
  },

  getRecommendations: async (userId) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/recommendations/user/${userId}`);
      return response.data;
    } catch {
      return [];
    }
  },
};

export default moviesService;
