import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';
import { Smartphone, AlertTriangle } from 'lucide-react';

export default function DeviceWatcher() {
    const { socket } = useSocket();

    // Track previous status for each device to prevent duplicate toasts
    const deviceStatusRef = useRef({});
    // Track last toast time to debounce
    const lastToastRef = useRef({});

    useEffect(() => {
        if (!socket) return;

        const handleDeviceStatus = (data) => {
            const { deviceId, status } = data;
            const now = Date.now();

            // Get previous status for this device
            const prevStatus = deviceStatusRef.current[deviceId];

            // Only show toast if status actually changed
            if (prevStatus === status) return;

            // Debounce: Don't show toast if we just showed one for this device (within 5 seconds)
            const lastToast = lastToastRef.current[deviceId] || 0;
            if (now - lastToast < 5000) return;

            // Update tracking
            deviceStatusRef.current[deviceId] = status;
            lastToastRef.current[deviceId] = now;

            if (status === 'disconnected' && prevStatus === 'connected') {
                toast.error(`Device ${deviceId.substring(0, 8)}... disconnected!`, {
                    icon: <AlertTriangle size={18} className="text-error" />,
                    duration: 5000,
                    id: `device-${deviceId}`, // Unique ID prevents duplicate toasts
                    style: {
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--error)',
                        borderRadius: 'var(--radius-lg)'
                    }
                });
            } else if (status === 'connected' && prevStatus !== 'connected') {
                toast.success(`Device ${deviceId.substring(0, 8)}... is online`, {
                    icon: <Smartphone size={18} className="text-success" />,
                    duration: 3000,
                    id: `device-${deviceId}`, // Unique ID prevents duplicate toasts
                    style: {
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--success)',
                        borderRadius: 'var(--radius-lg)'
                    }
                });
            }
        };

        socket.on('device.status', handleDeviceStatus);

        return () => {
            socket.off('device.status', handleDeviceStatus);
        };
    }, [socket]);

    return null; // This component doesn't render anything
}
