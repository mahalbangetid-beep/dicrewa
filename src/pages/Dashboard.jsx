import { useState, useEffect, useRef } from 'react'
import {
    MessageSquare,
    CheckCircle,
    Clock,
    XCircle,
    Smartphone,
    Activity,
    BarChart3,
    Zap,
    RefreshCw,
    Loader
} from 'lucide-react'
import { dashboardService, deviceService } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '../context/SocketContext'

const getStatusBadge = (status) => {
    switch (status) {
        case 'delivered':
        case 'read':
            return <span className="badge badge-success"><CheckCircle size={12} /> {status}</span>
        case 'sent':
            return <span className="badge badge-info"><CheckCircle size={12} /> Sent</span>
        case 'pending':
            return <span className="badge badge-warning"><Clock size={12} /> Pending</span>
        case 'failed':
            return <span className="badge badge-error"><XCircle size={12} /> Failed</span>
        default:
            return <span className="badge badge-neutral">{status}</span>
    }
}

export default function Dashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [devices, setDevices] = useState([])

    // Socket Context
    const { socket } = useSocket()

    useEffect(() => {
        fetchData()
    }, [])

    // Track which device rooms we've already joined
    const joinedRoomsRef = useRef(new Set());

    // Real-time Updates - Event Handlers (only depends on socket)
    useEffect(() => {
        if (!socket) return

        // 1. New Message
        const handleNewMessage = (msg) => {
            // Update Recent Activity
            const newActivityItem = {
                id: msg.id,
                target: msg.type === 'incoming' ? (msg.fromName || msg.from) : (msg.toName || msg.to),
                action: msg.type === 'incoming' ? 'Incoming Message' : 'Outgoing Message',
                status: msg.status,
                time: msg.createdAt
            }

            setStats(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    totalMessages: prev.totalMessages + 1,
                    recentActivity: [newActivityItem, ...prev.recentActivity.slice(0, 4)]
                };
            })
        }

        // 2. Message Status Update
        const handleMessageUpdate = ({ waMessageId, status, deviceId }) => {
            setStats(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    recentActivity: prev.recentActivity.map(item => item)
                };
            })
        }

        // 3. Device Status Update
        const handleDeviceStatus = ({ deviceId, status }) => {
            setDevices(prev => prev.map(d =>
                d.id === deviceId ? { ...d, status } : d
            ))
        }

        socket.on('message.created', handleNewMessage)
        socket.on('device.status', handleDeviceStatus)
        socket.on('message.updated', handleMessageUpdate)

        return () => {
            socket.off('message.created', handleNewMessage)
            socket.off('device.status', handleDeviceStatus)
            socket.off('message.updated', handleMessageUpdate)
        }
    }, [socket]) // Only depend on socket, not stats/devices

    // Separate effect for joining/leaving device rooms - only when devices list changes
    useEffect(() => {
        if (!socket || devices.length === 0) return;

        // Find devices we haven't joined yet
        const newDevicesToJoin = devices.filter(d => !joinedRoomsRef.current.has(d.id));

        // Join only new device rooms
        newDevicesToJoin.forEach(device => {
            socket.emit('join:device', device.id);
            joinedRoomsRef.current.add(device.id);
        });

        // Cleanup: leave rooms for devices no longer in list
        return () => {
            // Only leave rooms that are no longer in devices list
            const currentDeviceIds = new Set(devices.map(d => d.id));
            joinedRoomsRef.current.forEach(deviceId => {
                if (!currentDeviceIds.has(deviceId)) {
                    socket.emit('leave:device', deviceId);
                    joinedRoomsRef.current.delete(deviceId);
                }
            });
        };
    }, [socket, devices.length]); // Only re-run when devices.length changes, not on every status update

    // Effect to update counts when devices list changes
    useEffect(() => {
        if (!stats) return;
        const online = devices.filter(d => d.status === 'connected').length;
        setStats(prev => ({ ...prev, onlineDevices: online, totalDevices: devices.length }));
    }, [devices])


    const fetchData = async () => {
        setLoading(true)
        try {
            const [statsData, devicesData] = await Promise.all([
                dashboardService.getStats(),
                deviceService.list({ limit: 5 })
            ])
            setStats(statsData.data)
            console.log('Dashboard Stats:', statsData.data)
            console.log('Subscription Plan:', statsData.data?.subscription?.plan)
            setDevices(devicesData.data)
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader className="animate-spin w-8 h-8 text-primary-500" />
            </div>
        )
    }

    const statCards = [
        {
            label: 'Total Messages',
            value: (stats?.totalMessages || 0).toLocaleString(),
            icon: MessageSquare,
            iconClass: 'primary'
        },
        {
            label: 'Monthly Quota',
            value: stats?.subscription?.plan?.toLowerCase() === 'unlimited'
                ? 'Unlimited'
                : `${(stats?.subscription?.used || 0).toLocaleString()} / ${(stats?.subscription?.quota || 1500).toLocaleString()}`,
            icon: BarChart3,
            iconClass: 'info'
        },
        {
            label: 'Active Devices',
            value: (stats?.onlineDevices || 0) + ' / ' + (stats?.totalDevices || 0),
            icon: Smartphone,
            iconClass: 'success'
        },
        {
            label: 'Total Contacts',
            value: (stats?.totalContacts || 0).toLocaleString(),
            icon: Zap,
            iconClass: 'warning'
        },
    ]

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Overview of your activity • <span className="text-primary-500 font-semibold capitalize">{stats?.subscription?.plan || 'Free'} Plan</span></p>
                </div>
                <div className="flex items-center gap-md">
                    {/* Plan Badge */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }} className="hidden-mobile">
                        {stats?.subscription?.plan?.toLowerCase() === 'pro' && (
                            <span className="badge badge-info" style={{ fontWeight: 'bold', padding: 'var(--spacing-xs) var(--spacing-md)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                <Zap size={12} style={{ opacity: 0.8 }} /> Pro Plan
                            </span>
                        )}
                        {stats?.subscription?.plan?.toLowerCase() === 'enterprise' && (
                            <span className="badge badge-warning" style={{ fontWeight: 'bold', padding: 'var(--spacing-xs) var(--spacing-md)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                <Activity size={12} /> Enterprise
                            </span>
                        )}
                        {stats?.subscription?.plan?.toLowerCase() === 'unlimited' && (
                            <span className="badge badge-success" style={{ fontWeight: 'bold', padding: 'var(--spacing-xs) var(--spacing-md)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                <Zap size={12} style={{ opacity: 0.8 }} /> Unlimited
                            </span>
                        )}
                        {(stats?.subscription?.plan?.toLowerCase() === 'free' || !stats?.subscription?.plan) && (
                            <span className="badge badge-neutral" style={{ fontWeight: 'bold', padding: 'var(--spacing-xs) var(--spacing-md)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem' }}>
                                Free Plan
                            </span>
                        )}
                    </div>

                    <button className="btn btn-secondary" onClick={fetchData}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid stagger">
                {statCards.map((stat, index) => (
                    <div key={index} className="stat-card">
                        <div className="stat-card-header">
                            <div className={`stat-icon ${stat.iconClass}`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>
                {/* Recent Messages */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Recent Activity</h3>
                            <p className="card-subtitle">Latest messages sent or received</p>
                        </div>
                        <Link to="/logs" className="btn btn-ghost btn-sm">View All</Link>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Target</th>
                                    <th>Action</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats?.recentActivity?.length > 0 ? (
                                    stats.recentActivity.map((msg) => (
                                        <tr key={msg.id}>
                                            <td style={{ fontWeight: 500 }}>{msg.target}</td>
                                            <td>{msg.action}</td>
                                            <td>{getStatusBadge(msg.status)}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {msg.time ? formatDistanceToNow(new Date(msg.time), { addSuffix: true }) : 'Just now'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="text-center py-4 text-text-muted">No recent activity</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Device Status */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Device Status</h3>
                            <p className="card-subtitle">Connected Devices</p>
                        </div>
                        <Link to="/devices" className="btn btn-ghost btn-sm">Manage</Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {devices.length > 0 ? (
                            devices.map((device) => (
                                <div
                                    key={device.id}
                                    className={`device-card ${device.status === 'connected' ? 'connected' : ''}`}
                                    style={{ padding: 'var(--spacing-md)' }}
                                >
                                    <div className="device-header" style={{ marginBottom: 0 }}>
                                        <div className="device-info">
                                            <div className="device-avatar" style={{ width: '40px', height: '40px' }}>
                                                <Smartphone size={20} />
                                            </div>
                                            <div>
                                                <div className="device-name" style={{ fontSize: '0.875rem' }}>{device.name}</div>
                                                <div className="device-number" style={{ fontSize: '0.75rem' }}>{device.phone || 'No Number'}</div>
                                            </div>
                                        </div>
                                        <span className={`badge ${device.status === 'connected' ? 'badge-success' : 'badge-error'}`}>
                                            <span className={`status-dot ${device.status === 'connected' ? 'online' : 'offline'}`}></span>
                                            {device.status === 'connected' ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-text-muted">No devices found</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Message Volume</h3>
                        <p className="card-subtitle">Sent vs Received (Last 7 Days)</p>
                    </div>
                    <BarChart3 size={20} style={{ color: 'var(--primary-500)' }} />
                </div>
                <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.overview || []}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="name" fontSize={12} stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--text-primary)' }}
                            />
                            <Bar dataKey="sent" fill="var(--primary-500)" name="Sent" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="received" fill="var(--info)" name="Received" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
