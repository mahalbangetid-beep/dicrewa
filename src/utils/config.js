/**
 * Centralized Configuration
 * All environment variables and constants should be imported from here
 */

// API Base URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Socket.io URL (derived from API_URL, removing /api suffix if present)
export const SOCKET_URL = API_URL.replace('/api', '');

// Other configuration constants can be added here
export const APP_NAME = 'KeWhats';
