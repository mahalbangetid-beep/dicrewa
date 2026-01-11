import api from './api';

export const monitoringService = {
    // Dashboard stats
    getDashboard: async () => {
        const response = await api.get('/monitoring/dashboard');
        return response.data;
    },

    // User stats
    getUsers: async () => {
        const response = await api.get('/monitoring/users');
        return response.data;
    },

    // Connection stats
    getConnections: async () => {
        const response = await api.get('/monitoring/connections');
        return response.data;
    },

    // Integration stats
    getIntegrations: async () => {
        const response = await api.get('/monitoring/integrations');
        return response.data;
    },

    // Chatbot stats
    getChatbots: async () => {
        const response = await api.get('/monitoring/chatbots');
        return response.data;
    },

    // Broadcast stats
    getBroadcasts: async () => {
        const response = await api.get('/monitoring/broadcasts');
        return response.data;
    },

    // Contact stats
    getContacts: async () => {
        const response = await api.get('/monitoring/contacts');
        return response.data;
    },

    // Export contacts
    exportContacts: async (type = 'contact') => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api.defaults.baseURL}/monitoring/contacts/export?type=${type}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type === 'email' ? 'emails.csv' : 'contacts.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    },

    // Webhook stats
    getWebhooks: async () => {
        const response = await api.get('/monitoring/webhooks');
        return response.data;
    }
};

export default monitoringService;
