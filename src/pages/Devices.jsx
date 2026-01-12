import { useState, useEffect } from 'react'
import {
    Smartphone,
    Plus,
    QrCode,
    RefreshCw,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    X,
    Loader,
    Settings
} from 'lucide-react'
import { deviceService } from '../services/api'
import { useSocket } from '../context/SocketContext'
import QRCode from 'react-qr-code'
import toast from 'react-hot-toast'
import { useConfirm } from '../components/ConfirmDialog'

export default function Devices() {
    const confirm = useConfirm()
    const [devices, setDevices] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [activeTab, setActiveTab] = useState('all')

    // Add Device States
    const [newDeviceName, setNewDeviceName] = useState(localStorage.getItem('pendingDeviceName') || '')
    const [isCreating, setIsCreating] = useState(false)
    const [qrCode, setQrCode] = useState(null)
    const [currentDeviceId, setCurrentDeviceId] = useState(localStorage.getItem('pendingDeviceId') || null)
    const [modalMode, setModalMode] = useState('form') // 'form', 'loading', 'qr'

    const { socket } = useSocket()

    // Persist pending state
    useEffect(() => {
        if (currentDeviceId) {
            localStorage.setItem('pendingDeviceId', currentDeviceId);
            setShowAddModal(true); // Re-open modal if pending
            // If restoring from localStorage, go directly to QR mode
            if (modalMode === 'form') {
                setModalMode('qr');
            }
        } else {
            localStorage.removeItem('pendingDeviceId');
        }
    }, [currentDeviceId]);

    useEffect(() => {
        if (newDeviceName) localStorage.setItem('pendingDeviceName', newDeviceName);
        else localStorage.removeItem('pendingDeviceName');
    }, [newDeviceName]);

    // Initial Fetch
    useEffect(() => {
        fetchDevices()
    }, [])

    // Global Socket Listeners for Device Status
    useEffect(() => {
        if (!socket) return

        const handleStatus = ({ deviceId, status }) => {
            setDevices(prev => prev.map(d =>
                d.id === deviceId ? { ...d, status } : d
            ))

            // If we are currently adding this device and it becomes connected
            if (deviceId === currentDeviceId && status === 'connected') {
                setShowAddModal(false)
                setQrCode(null)
                setCurrentDeviceId(null)
                setNewDeviceName('')
                setModalMode('form') // Reset modal mode
                localStorage.removeItem('pendingDeviceId')
                localStorage.removeItem('pendingDeviceName')
            }
        }

        socket.on('device.status', handleStatus)

        return () => {
            socket.off('device.status', handleStatus)
        }
    }, [socket, currentDeviceId])

    const fetchQrManually = async () => {
        if (!currentDeviceId) return;
        try {
            console.log('Manual polling for QR...');
            const res = await deviceService.getQr(currentDeviceId)
            if (res.data?.qr) setQrCode(res.data.qr)
        } catch (e) {
            console.log('QR not ready yet...');
        }
    }

    // Listen for QR code when adding a device
    useEffect(() => {
        if (!currentDeviceId) return

        // Join socket room
        if (socket) {
            socket.emit('join:device', currentDeviceId)
            socket.on('qr', ({ qr }) => setQrCode(qr))
        }

        // Poll fallback in case socket misses it
        const pollInterval = setInterval(fetchQrManually, 2000)

        return () => {
            if (socket) {
                socket.off('qr')
                socket.emit('leave:device', currentDeviceId)
            }
            clearInterval(pollInterval)
        }
    }, [socket, currentDeviceId, qrCode])

    const fetchDevices = async () => {
        try {
            setLoading(true)
            const res = await deviceService.list({ limit: 100 })
            setDevices(res.data)
        } catch (error) {
            console.error('Failed to fetch devices:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddDevice = async () => {
        if (!newDeviceName.trim()) return

        try {
            setIsCreating(true)
            setQrCode(null)
            setModalMode('loading') // Switch to loading animation

            const newDevice = await deviceService.create({ name: newDeviceName })

            // Set device ID for socket room join
            setCurrentDeviceId(newDevice.id || newDevice.data?.id)

            // If QR is returned in response, set it immediately
            const qr = newDevice.data?.qr || newDevice.qr
            if (qr) {
                setQrCode(qr)
            }

            // Switch to QR mode
            setModalMode('qr')

            // Optimistically add to list
            const deviceData = newDevice.data || newDevice
            setDevices(prev => [deviceData, ...prev])

        } catch (error) {
            console.error('Failed to create device:', error)
            toast.error('Failed to create device: ' + (error.formattedMessage || error.message))
            setModalMode('form') // Go back to form on error
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteDevice = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Device?',
            message: 'Are you sure you want to delete this device? WhatsApp session will be disconnected.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        })
        if (!isConfirmed) return

        try {
            await deviceService.delete(id)
            setDevices(prev => prev.filter(d => d.id !== id))
            toast.success('Device deleted successfully')
        } catch (error) {
            console.error('Failed to delete:', error)
            toast.error('Failed to delete device')
        }
    }

    const handleRestartDevice = async (id) => {
        try {
            await deviceService.restart(id)
            toast.success('Device restart initiated')
        } catch (error) {
            console.error('Failed to restart:', error)
            toast.error('Failed to restart device')
        }
    }

    // Handle scan QR for existing device (not connected)
    const handleScanQr = async (deviceId) => {
        setQrCode(null)
        setCurrentDeviceId(deviceId)
        setModalMode('qr')
        setShowAddModal(true)

        // Restart session to generate new QR
        try {
            await deviceService.restart(deviceId)
        } catch (error) {
            console.error('Failed to restart device:', error)
        }
    }

    const handleModalClose = () => {
        setShowAddModal(false)
        setQrCode(null)
        setNewDeviceName('')
        setCurrentDeviceId(null)
        setModalMode('form') // Reset to form mode
    }

    const filteredDevices = devices.filter(device => {
        if (activeTab === 'all') return true
        return device.status === activeTab
    })

    const connectedCount = devices.filter(d => d.status === 'connected').length
    const disconnectedCount = devices.filter(d => d.status !== 'connected').length

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Device Management</h1>
                    <p className="page-subtitle">Manage your WhatsApp sessions and connected devices</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={16} />
                    Add Device
                </button>
            </div>

            {/* Stats Summary */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon primary">
                            <Smartphone size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{devices.length}</div>
                    <div className="stat-label">Total Devices</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon success">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{connectedCount}</div>
                    <div className="stat-label">Connected</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon error">
                            <XCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{disconnectedCount}</div>
                    <div className="stat-label">Disconnected</div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="tabs" style={{ maxWidth: '400px', marginBottom: 'var(--spacing-xl)' }}>
                <button
                    className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All ({devices.length})
                </button>
                <button
                    className={`tab ${activeTab === 'connected' ? 'active' : ''}`}
                    onClick={() => setActiveTab('connected')}
                >
                    Online ({connectedCount})
                </button>
                <button
                    className={`tab ${activeTab === 'disconnected' ? 'active' : ''}`}
                    onClick={() => setActiveTab('disconnected')}
                >
                    Offline ({disconnectedCount})
                </button>
            </div>

            {loading ? (
                <div className="text-center p-12">
                    <Loader className="animate-spin w-8 h-8 mx-auto text-primary-500" />
                    <p className="text-text-secondary mt-4">Loading devices...</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: 'var(--spacing-lg)'
                }}>
                    {filteredDevices.map((device) => (
                        <div
                            key={device.id}
                            className={`device-card ${device.status === 'connected' ? 'connected' : ''}`}
                        >
                            <div className="device-header">
                                <div className="device-info">
                                    <div className="device-avatar" style={{
                                        background: device.status === 'connected'
                                            ? 'rgba(37, 211, 102, 0.15)'
                                            : 'var(--bg-tertiary)'
                                    }}>
                                        <Smartphone
                                            size={24}
                                            style={{
                                                color: device.status === 'connected'
                                                    ? 'var(--primary-500)'
                                                    : 'var(--text-muted)'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <div className="device-name">{device.name}</div>
                                        <div className="device-number">{device.phone || 'No Number'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <span className={`badge ${device.status === 'connected' ? 'badge-success' :
                                        device.status === 'connecting' ? 'badge-warning' : 'badge-error'
                                        }`}>
                                        <span className={`status-dot ${device.status === 'connected' ? 'online' :
                                            device.status === 'connecting' ? 'connecting' : 'offline'
                                            }`}></span>
                                        {device.status === 'connected' ? 'Online' :
                                            device.status === 'connecting' ? 'Connecting...' : 'Offline'}
                                    </span>
                                </div>
                            </div>

                            {device.spreadsheetUrl && (
                                <div className="mt-2 text-xs text-primary-500 flex items-center gap-1">
                                    <CheckCircle size={10} /> Syncing from Google Sheets
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                marginTop: 'var(--spacing-sm)'
                            }}>
                                <Clock size={12} />
                                Last active: {device.lastActive ? new Date(device.lastActive).toLocaleString() : 'Never'}
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-sm)',
                                marginTop: 'var(--spacing-md)',
                                paddingTop: 'var(--spacing-md)',
                                borderTop: '1px solid var(--border-color)'
                            }}>
                                {device.status === 'connected' ? (
                                    <>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ flex: 1 }}
                                            onClick={() => handleRestartDevice(device.id)}
                                        >
                                            <RefreshCw size={14} />
                                            Restart
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            style={{ flex: 1 }}
                                            onClick={() => handleDeleteDevice(device.id)}
                                        >
                                            <XCircle size={14} />
                                            Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ flex: 1 }}
                                            onClick={() => handleScanQr(device.id)}
                                        >
                                            <QrCode size={14} />
                                            Scan QR
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: 'auto' }}
                                            onClick={() => handleDeleteDevice(device.id)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredDevices.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No devices found. Click "Add Device" to start.
                        </div>
                    )}
                </div>
            )}



            {/* Add Device Modal */}
            <div className={`modal-overlay ${showAddModal ? 'open' : ''}`} onClick={handleModalClose}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">
                            {modalMode === 'form' && 'Add New Device'}
                            {modalMode === 'loading' && 'Creating Device...'}
                            {modalMode === 'qr' && 'Scan QR Code'}
                        </h3>
                        <button className="btn btn-ghost btn-icon" onClick={handleModalClose}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        {/* Form Mode - Input device name */}
                        {modalMode === 'form' && (
                            <div className="form-group">
                                <label className="form-label">Device Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Marketing Team"
                                    value={newDeviceName}
                                    onChange={(e) => setNewDeviceName(e.target.value)}
                                    autoFocus
                                />
                                <p className="form-hint">Give this device a memorable name</p>
                            </div>
                        )}

                        {/* Loading Mode - Animation while waiting for QR */}
                        {modalMode === 'loading' && (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--spacing-2xl)',
                            }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    margin: '0 auto var(--spacing-xl)',
                                    borderRadius: '50%',
                                    border: '4px solid var(--border-color)',
                                    borderTopColor: 'var(--primary-500)',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-sm)' }}>
                                    Creating WhatsApp Session
                                </h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    Please wait while we generate your QR code...
                                </p>
                            </div>
                        )}

                        {/* QR Mode - Show QR code */}
                        {modalMode === 'qr' && (
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--spacing-xl)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                            }}>
                                <div style={{
                                    width: '250px',
                                    height: '250px',
                                    background: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    margin: '0 auto var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px'
                                }}>
                                    {qrCode ? (
                                        <img src={qrCode} alt="Scan QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <Loader className="animate-spin" size={32} style={{ color: 'var(--primary-500)', marginBottom: '8px' }} />
                                            <p style={{ fontSize: '0.75rem', color: '#666' }}>Loading QR Code...</p>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={fetchQrManually}
                                                style={{ fontSize: '0.75rem', marginTop: '8px' }}
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Scan this QR code with your WhatsApp app
                                </p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 'var(--spacing-xs)' }}>
                                    Open WhatsApp → Settings → Linked Devices → Link a Device
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={handleModalClose}>
                            {modalMode === 'qr' ? 'Close' : 'Cancel'}
                        </button>
                        {modalMode === 'form' && (
                            <button
                                className="btn btn-primary"
                                onClick={handleAddDevice}
                                disabled={isCreating || !newDeviceName.trim()}
                            >
                                Create & Get QR
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
