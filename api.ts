import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
};

export const roomAPI = {
  getRooms: () => api.get('/rooms'),
  createRoom: (data: { name: string; description?: string }) =>
    api.post('/rooms', data),
};

export const messageAPI = {
  getRoomMessages: (roomId: string) => api.get(`/messages/${roomId}`),
  getPrivateMessages: (userId: string) => api.get(`/messages/private/${userId}`),
};

export const userAPI = {
  getUsers: () => api.get('/users'),
};

export default api;