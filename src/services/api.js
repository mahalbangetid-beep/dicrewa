import axios from 'axios';
import { API_URL } from '../utils/config';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Auth Errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // If 401 Unauthorized, log out user (unless it's auth endpoints or already on login page)
        if (error.response?.status === 401) {
            const isAuthEndpoint = error.config.url.includes('/auth/login') ||
                error.config.url.includes('/auth/register');
            const isAlreadyOnLogin = window.location.pathname === '/login' ||
                window.location.pathname === '/register';

            if (!isAuthEndpoint && !isAlreadyOnLogin) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }

        // Normalize error object for frontend consumption
        // Backend returns { success: false, error: { message: '...' } }
        const errorMessage = error.response?.data?.error?.message || error.message || 'Something went wrong';

        // Attach formatted message to error object
        error.formattedMessage = errorMessage;

        return Promise.reject(error);
    }
);

// API Service Functions

export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data.data; // { token, user }
    },
    register: async (name, email, password) => {
        const response = await api.post('/auth/register', { name, email, password });
        return response.data.data;
    },
    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data.data; // { ...user }
    },
    changePassword: async (currentPassword, newPassword) => {
        const response = await api.post('/auth/change-password', { currentPassword, newPassword });
        return response.data.data;
    }
};

export const deviceService = {
    list: async (params) => {
        const response = await api.get('/devices', { params });
        return response.data; // { success: true, data: devices, pagination }
    },
    create: async (data) => {
        const response = await api.post('/devices', data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/devices/${id}`);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/devices/${id}`, data);
        return response.data;
    },
    restart: async (id) => {
        const response = await api.post(`/devices/${id}/restart`);
        return response.data;
    },
    getOne: async (id) => {
        const response = await api.get(`/devices/${id}`);
        return response.data;
    },
    getQr: async (id) => {
        const response = await api.get(`/devices/${id}/qr`);
        return response.data; // { success: true, data: { qr: '...' } }
    }
};

export const messageService = {
    list: async (params) => {
        const response = await api.get('/messages', { params });
        return response.data;
    },
    sendText: async (data) => {
        const response = await api.post('/messages/send', data);
        return response.data;
    },
    sendMedia: async (data) => {
        const response = await api.post('/messages/send-media', data);
        return response.data;
    },
    getOne: async (id) => {
        const response = await api.get(`/messages/${id}`);
        return response.data;
    }
};

export const contactService = {
    list: async (params) => {
        const response = await api.get('/contacts', { params });
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/contacts', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/contacts/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/contacts/${id}`);
        return response.data;
    },
    import: async (contacts) => {
        const response = await api.post('/contacts/import', { contacts });
        return response.data;
    }
};

export const autoReplyService = {
    list: async (params) => {
        const response = await api.get('/auto-reply', { params });
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/auto-reply', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/auto-reply/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/auto-reply/${id}`);
        return response.data;
    },
    toggle: async (id) => {
        const response = await api.patch(`/auto-reply/${id}/toggle`);
        return response.data;
    }
};

export const broadcastService = {
    list: async (params) => {
        const response = await api.get('/broadcast', { params });
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/broadcast', data);
        return response.data;
    },
    cancel: async (id) => {
        const response = await api.post(`/broadcast/${id}/cancel`);
        return response.data;
    },
    getRecipients: async (id, params) => {
        const response = await api.get(`/broadcast/${id}/recipients`, { params });
        return response.data;
    }
};

export const webhookService = {
    list: async (params) => {
        const response = await api.get('/webhooks', { params });
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/webhooks', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/webhooks/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/webhooks/${id}`);
        return response.data;
    },
    test: async (id) => {
        const response = await api.post(`/webhooks/${id}/test`);
        return response.data;
    },
    getEvents: async () => {
        const response = await api.get('/webhooks/meta/events');
        return response.data;
    }
};

export const settingsService = {
    getProfile: async () => {
        const response = await api.get('/settings/profile');
        return response.data; // { success: true, data: { ...user, apiKey } }
    },
    updateProfile: async (data) => {
        const response = await api.put('/settings/profile', data);
        return response.data;
    },
    changePassword: async (data) => {
        const response = await api.put('/settings/password', data);
        return response.data;
    },
    generateApiKey: async () => {
        const response = await api.post('/settings/apikey');
        return response.data;
    },
    getSettings: async () => {
        const response = await api.get('/settings');
        return response.data; // { success: true, data: { key: value } }
    },
    updateSetting: async (key, value) => {
        const response = await api.post('/settings', { key, value });
        return response.data;
    },
    getPublicSettings: async () => {
        const response = await api.get('/public/settings');
        return response.data;
    }
};

export const dashboardService = {
    getStats: async () => {
        const response = await api.get('/dashboard');
        return response.data;
    }
};

export default api;
