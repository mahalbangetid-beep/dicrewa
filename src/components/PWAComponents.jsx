/**
 * PWA Components - Install Prompt, Update Banner, Offline Indicator
 * Phase 12: Mobile PWA
 */

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Wifi, WifiOff, X, Smartphone } from 'lucide-react';
import pwa from '../utils/pwa';

/**
 * PWA Install Prompt Banner
 */
export function InstallPrompt() {
    const [show, setShow] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        // Listen for install prompt available
        const handleInstallAvailable = () => {
            // Don't show if already standalone
            if (pwa.isStandalone()) return;

            // Check if user dismissed before
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (dismissed) {
                const dismissedTime = new Date(dismissed);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                if (dismissedTime > weekAgo) return;
            }

            setShow(true);
        };

        window.addEventListener('pwaInstallAvailable', handleInstallAvailable);

        // Check if prompt is already available
        if (pwa.isInstallPromptAvailable()) {
            handleInstallAvailable();
        }

        return () => {
            window.removeEventListener('pwaInstallAvailable', handleInstallAvailable);
        };
    }, []);

    const handleInstall = async () => {
        setInstalling(true);
        const installed = await pwa.showInstallPrompt();
        setInstalling(false);

        if (installed) {
            setShow(false);
        }
    };

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    };

    if (!show) return null;

    return (
        <div className="pwa-install-prompt">
            <div className="pwa-install-content">
                <div className="pwa-install-icon">
                    <Smartphone size={24} />
                </div>
                <div className="pwa-install-text">
                    <h4>Install KeWhats</h4>
                    <p>Akses lebih cepat langsung dari home screen</p>
                </div>
            </div>
            <div className="pwa-install-actions">
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleInstall}
                    disabled={installing}
                >
                    {installing ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : (
                        <Download size={14} />
                    )}
                    Install
                </button>
                <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={handleDismiss}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * PWA Update Available Banner
 */
export function UpdateBanner() {
    const [show, setShow] = useState(false);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const handleUpdateAvailable = () => {
            setShow(true);
        };

        window.addEventListener('pwaUpdateAvailable', handleUpdateAvailable);

        return () => {
            window.removeEventListener('pwaUpdateAvailable', handleUpdateAvailable);
        };
    }, []);

    const handleUpdate = async () => {
        setUpdating(true);
        await pwa.activateNewWorker();
    };

    const handleDismiss = () => {
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="pwa-update-banner">
            <div className="pwa-update-content">
                <RefreshCw size={18} />
                <span>Update tersedia! Refresh untuk mendapatkan versi terbaru.</span>
            </div>
            <div className="pwa-update-actions">
                <button
                    className="btn btn-sm btn-primary"
                    onClick={handleUpdate}
                    disabled={updating}
                >
                    {updating ? 'Updating...' : 'Update'}
                </button>
                <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={handleDismiss}
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

/**
 * Offline Status Indicator
 */
export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        pwa.onConnectionChange((online) => {
            setIsOffline(!online);
        });
    }, []);

    if (!isOffline) return null;

    return (
        <div className="offline-indicator">
            <WifiOff size={16} />
            <span>Anda sedang offline</span>
        </div>
    );
}

/**
 * Online Status Badge
 */
export function ConnectionStatus() {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        pwa.onConnectionChange((status) => {
            setOnline(status);
        });
    }, []);

    return (
        <div className={`connection-status ${online ? 'online' : 'offline'}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{online ? 'Online' : 'Offline'}</span>
        </div>
    );
}

/**
 * Push Notification Permission Request
 */
export function NotificationPermission({ onGranted }) {
    const [permission, setPermission] = useState(Notification?.permission || 'default');
    const [requesting, setRequesting] = useState(false);

    if (permission === 'granted' || permission === 'denied') {
        return null;
    }

    const handleRequest = async () => {
        setRequesting(true);
        const result = await pwa.requestNotificationPermission();
        setPermission(result);
        setRequesting(false);

        if (result === 'granted' && onGranted) {
            onGranted();
        }
    };

    return (
        <div className="notification-permission">
            <div className="notification-content">
                <span>🔔</span>
                <p>Aktifkan notifikasi untuk mendapatkan update pesan real-time</p>
            </div>
            <button
                className="btn btn-primary btn-sm"
                onClick={handleRequest}
                disabled={requesting}
            >
                {requesting ? 'Meminta...' : 'Aktifkan'}
            </button>
        </div>
    );
}

/**
 * PWA Provider Component - Wraps app with PWA features
 */
export function PWAProvider({ children }) {
    useEffect(() => {
        // Register service worker is already done in pwa.js on load

        // Check for updates periodically
        const checkInterval = setInterval(() => {
            pwa.updateServiceWorker();
        }, 60 * 60 * 1000); // Every hour

        return () => clearInterval(checkInterval);
    }, []);

    return (
        <>
            {children}
            <InstallPrompt />
            <UpdateBanner />
            <OfflineIndicator />
        </>
    );
}

export default {
    InstallPrompt,
    UpdateBanner,
    OfflineIndicator,
    ConnectionStatus,
    NotificationPermission,
    PWAProvider
};
