/**
 * PWA Utilities - Service Worker Registration & Push Notifications
 * Phase 12: Mobile PWA
 */

// Check if service workers are supported
export const isPwaSupported = () => {
    return 'serviceWorker' in navigator;
};

// Check if push notifications are supported
export const isPushSupported = () => {
    return 'PushManager' in window;
};

// Check if app is running as installed PWA
export const isStandalone = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
};

// Check if app can be installed
export const canInstall = () => {
    return !isStandalone() && isPwaSupported();
};

// Store install prompt for later use
let deferredPrompt = null;

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');

    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('pwaInstallAvailable'));
});

// Listen for app installed event
window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;

    // Track installation
    if (window.gtag) {
        window.gtag('event', 'pwa_install');
    }
});

/**
 * Register Service Worker
 */
export const registerServiceWorker = async () => {
    if (!isPwaSupported()) {
        console.warn('[PWA] Service workers not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });

        console.log('[PWA] Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[PWA] New service worker installing...');

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New content available, refresh to update');

                    // Dispatch update available event
                    window.dispatchEvent(new CustomEvent('pwaUpdateAvailable', {
                        detail: { registration }
                    }));
                }
            });
        });

        return registration;
    } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
        return null;
    }
};

/**
 * Update Service Worker
 */
export const updateServiceWorker = async () => {
    if (!isPwaSupported()) return;

    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
        await registration.update();
        console.log('[PWA] Checking for updates...');
    }
};

/**
 * Skip waiting and activate new service worker
 */
export const activateNewWorker = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
};

/**
 * Show install prompt
 */
export const showInstallPrompt = async () => {
    if (!deferredPrompt) {
        console.log('[PWA] Install prompt not available');
        return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);

    deferredPrompt = null;
    return outcome === 'accepted';
};

/**
 * Check if install prompt is available
 */
export const isInstallPromptAvailable = () => {
    return deferredPrompt !== null;
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPush = async (vapidPublicKey) => {
    if (!isPushSupported()) {
        console.warn('[PWA] Push notifications not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Create new subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
            console.log('[PWA] Push subscription created');
        }

        return subscription;
    } catch (error) {
        console.error('[PWA] Push subscription failed:', error);
        return null;
    }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async () => {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            console.log('[PWA] Push subscription removed');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[PWA] Push unsubscribe failed:', error);
        return false;
    }
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.warn('[PWA] Notifications not supported');
        return 'unsupported';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[PWA] Notification permission:', permission);
    return permission;
};

/**
 * Show local notification
 */
export const showNotification = async (title, options = {}) => {
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
        console.warn('[PWA] Notification permission not granted');
        return null;
    }

    const registration = await navigator.serviceWorker.ready;

    return registration.showNotification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        ...options
    });
};

/**
 * Clear app cache
 */
export const clearCache = async () => {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[PWA] Cache cleared');
    }

    // Tell service worker to clear cache
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
};

/**
 * Get cache storage estimate
 */
export const getCacheSize = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
        };
    }
    return null;
};

/**
 * Check online status
 */
export const isOnline = () => {
    return navigator.onLine;
};

/**
 * Register online/offline listeners
 */
export const onConnectionChange = (callback) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));

    // Return current status
    return navigator.onLine;
};

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Auto-register on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        registerServiceWorker();
    });
}

export default {
    isPwaSupported,
    isPushSupported,
    isStandalone,
    canInstall,
    registerServiceWorker,
    updateServiceWorker,
    activateNewWorker,
    showInstallPrompt,
    isInstallPromptAvailable,
    subscribeToPush,
    unsubscribeFromPush,
    requestNotificationPermission,
    showNotification,
    clearCache,
    getCacheSize,
    isOnline,
    onConnectionChange
};
