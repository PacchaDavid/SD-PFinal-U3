import api from './api';

/**
 * Extrae datos de forma backward-compatible.
 * - Si es cb_fallback: devuelve { items, cb_fallback, message }
 * - Si es normal: devuelve el array original (backward compatible)
 */
function extractData(response) {
  const data = response.data;
  if (data && data.cb_fallback) {
    return {
      items: data.data || [],
      cb_fallback: true,
      message: data.message || '',
    };
  }
  // Backward compatible: devuelve el array/objeto original
  return data;
}

const moviesService = {
  getAll: async () => {
    try {
      const response = await api.get('/api/recomendaciones/api/recomendaciones');
      return extractData(response);
    } catch {
      return { items: [], cb_fallback: false };
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
      return extractData(response);
    } catch {
      return { items: [], cb_fallback: false };
    }
  },

  getByGenre: async (genre) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/genre/${encodeURIComponent(genre)}`);
      return extractData(response);
    } catch {
      return { items: [], cb_fallback: false };
    }
  },

  search: async (query) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/search?q=${encodeURIComponent(query)}`);
      return extractData(response);
    } catch {
      return { items: [], cb_fallback: false };
    }
  },

  getRecommendations: async (userId) => {
    try {
      const response = await api.get(`/api/recomendaciones/api/recomendaciones/recommendations/user/${userId}`);
      return extractData(response);
    } catch {
      return { items: [], cb_fallback: false };
    }
  },
};

export default moviesService;
