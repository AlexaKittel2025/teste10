/**
 * Módulo centralizado e modular para chamadas de API
 * Facilita a manutenção e escalabilidade dos endpoints
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Cliente base do Axios com configurações padrão
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de requisição para adicionar token de autenticação
apiClient.interceptors.request.use(
  (config) => {
    // Adicionar token de autenticação se disponível
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta para tratar erros
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Tratar erros comuns
    if (error.response?.status === 401) {
      // Redirecionar para login se não autenticado
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    
    // Tratar erro de timeout
    if (error.code === 'ECONNABORTED') {
      console.error('A requisição excedeu o tempo limite.');
    }
    
    // Tratar erros de rede
    if (!error.response) {
      console.error('Erro de rede ou servidor indisponível.');
    }
    
    return Promise.reject(error);
  }
);

// Funções genéricas para chamadas de API
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => 
    apiClient.get<T>(url, config),
    
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => 
    apiClient.post<T>(url, data, config),
    
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => 
    apiClient.put<T>(url, data, config),
    
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => 
    apiClient.delete<T>(url, config),
    
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => 
    apiClient.patch<T>(url, data, config),
};

// API específicas por domínio
export const userApi = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data: any) => api.post('/user/update', data),
  getBets: (period: string = 'all') => api.get(`/user/bets?period=${period}`),
  getBalance: () => api.get('/user/balance'),
  updateBetLimit: (limit: number) => api.post('/user/bet-limit', { limit }),
  getBetStats: () => api.get('/user/bet-stats'),
};

export const authApi = {
  login: (credentials: { email: string; password: string }) => 
    api.post('/auth/login', credentials),
  register: (userData: { name: string; email: string; password: string }) => 
    api.post('/auth/register', userData),
  refreshSession: () => api.post('/auth/refresh-session'),
  checkAuth: () => api.get('/auth/check'),
};

export const gameApi = {
  getBetHistory: () => api.get('/rounds/history'),
  getLastResults: (count: number = 10) => api.get(`/rounds/last-results?count=${count}`),
  placeBet: (data: { amount: number; type: 'ABOVE' | 'BELOW'; roundId: string }) => 
    api.post('/bets', data),
};

export const transactionApi = {
  getTransactions: (type?: 'DEPOSIT' | 'WITHDRAWAL') => 
    api.get(`/transactions${type ? `?type=${type}` : ''}`),
  createDeposit: (amount: number) => api.post('/transactions', { type: 'DEPOSIT', amount }),
  requestWithdrawal: (amount: number, details: any) => 
    api.post('/transactions', { type: 'WITHDRAWAL', amount, details }),
};

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/admin/users'),
  getTransactions: (status?: string) => 
    api.get(`/admin/transactions${status ? `?status=${status}` : ''}`),
  approveTransaction: (id: string) => 
    api.post(`/admin/transactions/${id}/approve`),
  rejectTransaction: (id: string, reason: string) => 
    api.post(`/admin/transactions/${id}/reject`, { reason }),
  updateHouseProfit: (profit: number) => 
    api.post('/admin/settings/house-profit', { profit }),
};

export const chatApi = {
  getMessages: (lastMessageId?: string) => 
    api.get(`/chat/messages${lastMessageId ? `?lastId=${lastMessageId}` : ''}`),
  sendMessage: (text: string, recipientId?: string) => 
    api.post('/chat/send', { text, recipientId }),
  getUsers: () => api.get('/chat/users'),
  markAsRead: (messageIds: string[]) => 
    api.post('/chat/mark-read', { messageIds }),
};

// Exportar cliente para uso em casos específicos
export { apiClient }; 