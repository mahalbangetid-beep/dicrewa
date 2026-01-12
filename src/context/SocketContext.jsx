import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/config';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [authToken, setAuthToken] = useState(localStorage.getItem('token'));
    const [wasDisconnected, setWasDisconnected] = useState(false);

    // Track joined rooms for re-join on reconnect
    const joinedRoomsRef = useRef(new Set());

    // Callbacks for reconnection refetch
    const reconnectCallbacksRef = useRef(new Set());

    // Listen for token changes (login/logout)
    useEffect(() => {
        const handleStorageChange = () => {
            const newToken = localStorage.getItem('token');
            if (newToken !== authToken) {
                console.log('[Frontend] Token changed, will reconnect socket');
                setAuthToken(newToken);
            }
        };

        // Check for token changes periodically (for same-tab updates)
        const interval = setInterval(handleStorageChange, 1000);

        // Also listen for storage events (cross-tab)
        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [authToken]);

    // Join a device room (with persistence)
    const joinRoom = useCallback((deviceId) => {
        if (!deviceId) return;

        joinedRoomsRef.current.add(deviceId);

        if (socket && socket.connected) {
            socket.emit('join:device', deviceId);
            console.log(`[Frontend] Joined room: ${deviceId}`);
        }
    }, [socket]);

    // Leave a device room
    const leaveRoom = useCallback((deviceId) => {
        if (!deviceId) return;

        joinedRoomsRef.current.delete(deviceId);

        if (socket && socket.connected) {
            socket.emit('leave:device', deviceId);
            console.log(`[Frontend] Left room: ${deviceId}`);
        }
    }, [socket]);

    // Register callback for reconnection refetch
    const onReconnect = useCallback((callback) => {
        reconnectCallbacksRef.current.add(callback);
        return () => {
            reconnectCallbacksRef.current.delete(callback);
        };
    }, []);

    // Re-join all rooms (called on reconnect)
    const rejoinAllRooms = useCallback((socketInstance) => {
        if (!socketInstance || !socketInstance.connected) return;

        const rooms = Array.from(joinedRoomsRef.current);
        if (rooms.length > 0) {
            console.log(`[Frontend] Re-joining ${rooms.length} rooms after reconnect`);
            rooms.forEach(deviceId => {
                socketInstance.emit('join:device', deviceId);
            });
        }
    }, []);

    useEffect(() => {
        // Don't connect if no token
        if (!authToken) {
            console.log('[Frontend] Socket: No token, skipping connection');
            return;
        }

        // Initialize Socket
        const newSocket = io(SOCKET_URL, {
            auth: {
                token: authToken
            },
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        // Event listeners
        newSocket.on('connect', () => {
            console.log('[Frontend] Socket connected:', newSocket.id);
            setIsConnected(true);

            // Re-join all previously joined rooms on reconnect
            rejoinAllRooms(newSocket);

            // If we were previously disconnected, trigger refetch callbacks
            if (wasDisconnected) {
                console.log('[Frontend] Triggering reconnect refetch callbacks');
                reconnectCallbacksRef.current.forEach(callback => {
                    try {
                        callback();
                    } catch (e) {
                        console.error('[Frontend] Reconnect callback error:', e);
                    }
                });
                setWasDisconnected(false);
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[Frontend] Socket disconnected:', reason);
            setIsConnected(false);
            setWasDisconnected(true);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[Frontend] Socket connection error:', err.message);
        });

        // Explicit reconnect event
        newSocket.io.on('reconnect', (attempt) => {
            console.log(`[Frontend] Socket reconnected after ${attempt} attempts`);
            // Note: 'connect' event will also fire and handle re-join
        });

        newSocket.io.on('reconnect_attempt', (attempt) => {
            console.log(`[Frontend] Socket reconnection attempt ${attempt}`);
        });

        setSocket(newSocket);

        // Cleanup
        return () => {
            newSocket.close();
        };
    }, [rejoinAllRooms, authToken, wasDisconnected]); // Include authToken to reconnect after login

    return (
        <SocketContext.Provider value={{
            socket,
            isConnected,
            joinRoom,
            leaveRoom,
            onReconnect,
            joinedRooms: joinedRoomsRef.current
        }}>
            {children}
        </SocketContext.Provider>
    );
};
