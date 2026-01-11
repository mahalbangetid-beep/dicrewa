import { useState, useEffect } from 'react'
import {
    MessageSquare,
    Search,
    Download,
    RefreshCw,
    CheckCircle,
    Clock,
    XCircle,
    Send,
    Eye,
    Smartphone,
    ArrowUpRight,
    ArrowDownLeft,
    Loader
} from 'lucide-react'
import { messageService } from '../services/api'
import { format } from 'date-fns'
import { useSocket } from '../context/SocketContext'

const getStatusBadge = (status) => {
    switch (status) {
        case 'delivered':
        case 'read':
            return <span className="badge badge-success"><CheckCircle size={12} /> {status}</span>
        case 'sent':
            return <span className="badge badge-warning"><Clock size={12} /> Sent</span>
        case 'received':
            return <span className="badge badge-info"><ArrowDownLeft size={12} /> Received</span>
        case 'failed':
            return <span className="badge badge-error"><XCircle size={12} /> Failed</span>
        case 'pending':
            return <span className="badge badge-neutral"><Clock size={12} /> {status}</span>
        default:
            return <span className="badge badge-neutral">{status}</span>
    }
}

export default function MessageLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [selectedLog, setSelectedLog] = useState(null)

    // Stats
    const [stats, setStats] = useState({
        sent: 0,
        received: 0,
        delivered: 0,
        failed: 0
    })

    const { socket } = useSocket()

    // Devices for room joining
    const [devices, setDevices] = useState([])

    useEffect(() => {
        fetchLogs(1)
        fetchDevicesForRooms()
    }, [statusFilter, typeFilter])

    // Fetch devices for Socket room joining
    const fetchDevicesForRooms = async () => {
        try {
            const { deviceService } = await import('../services/api')
            const res = await deviceService.list({ limit: 100 })
            setDevices(res.data || [])
        } catch (error) {
            console.error('Failed to fetch devices for rooms:', error)
        }
    }

    // Real-time Updates
    useEffect(() => {
        if (!socket) return

        // Join all user's device rooms for real-time updates
        devices.forEach(device => {
            socket.emit('join:device', device.id)
        })

        const handleNewMessage = (msg) => {
            // Only update if we are on the first page and no filters are active (basic implementation)
            // Or if filters match the new message (more complex)
            // For MVP simplicity: only update if on page 1 and no search query
            if (pagination.page === 1 && !searchQuery) {
                // Check if filters apply
                const matchesStatus = statusFilter === 'all' || msg.status === statusFilter
                const matchesType = typeFilter === 'all' || msg.type === typeFilter

                if (matchesStatus && matchesType) {
                    setLogs(prev => {
                        const newLogs = [msg, ...prev]
                        if (newLogs.length > pagination.limit) {
                            newLogs.pop()
                        }
                        return newLogs
                    })
                    setPagination(prev => ({ ...prev, total: prev.total + 1 }))

                    // Allow inaccurate stats update for visual feedback
                    setStats(prev => {
                        const s = { ...prev }
                        if (msg.type === 'outgoing') s.sent++
                        if (msg.type === 'incoming') s.received++
                        return s
                    })
                }
            }
        }

        const handleMessageUpdate = ({ waMessageId, status, deviceId }) => {
            setLogs(prev => prev.map(log => {
                // Determine equality - backend sends waMessageId on update, 
                // but logs list might have waMessageId.
                if (log.waMessageId === waMessageId || (log.id && log.id === waMessageId)) { // Fallback if IDs mixed
                    // Check if status changed meaningfully for stats
                    return { ...log, status }
                }
                return log
            }))
        }

        socket.on('message.created', handleNewMessage)
        socket.on('message.updated', handleMessageUpdate) // Note: Backend emits this

        return () => {
            socket.off('message.created', handleNewMessage)
            socket.off('message.updated', handleMessageUpdate)
            // Leave all device rooms on cleanup
            devices.forEach(device => {
                socket.emit('leave:device', device.id)
            })
        }

    }, [socket, pagination.page, searchQuery, statusFilter, typeFilter, pagination.limit, devices])

    const fetchLogs = async (page = 1) => {
        setLoading(true)
        try {
            const params = {
                page,
                limit: 10,
                search: searchQuery,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                type: typeFilter !== 'all' ? typeFilter : undefined
            }

            const res = await messageService.list(params)

            setLogs(res.data)
            setPagination(res.pagination)

            // Simple client-side stats calc for MVP if backend doesn't provide
            // Ideally backend should provide stats endpoint
            calculateStats(res.data)
        } catch (error) {
            console.error('Failed to fetch logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (data) => {
        // This is inaccurate for total since it only counts current page
        // But for MVP visual feedback it's better than 0.
        // A real implementation would call a /messages/stats endpoint.
        const s = { sent: 0, received: 0, delivered: 0, failed: 0 }
        data.forEach(l => {
            if (l.type === 'outgoing') s.sent++
            if (l.type === 'incoming') s.received++
            if (l.status === 'delivered' || l.status === 'read') s.delivered++
            if (l.status === 'failed') s.failed++
        })
        setStats(s)
    }

    const handleSearch = (e) => {
        e.preventDefault()
        fetchLogs(1)
    }

    const downloadLogs = () => {
        // Implementation for downloading CSV would go here
        alert('Export feature coming soon!')
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Message Logs</h1>
                    <p className="page-subtitle">View complete history of all messages sent and received</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                    <button className="btn btn-secondary" onClick={downloadLogs}>
                        <Download size={16} />
                        Export
                    </button>
                    <button className="btn btn-secondary" onClick={() => fetchLogs(pagination.page)}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats - Note: These are currently just page stats for MVP */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon primary">
                            <Send size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.sent}</div>
                    <div className="stat-label">Sent (Page)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon info">
                            <ArrowDownLeft size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.received}</div>
                    <div className="stat-label">Received (Page)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon success">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.delivered}</div>
                    <div className="stat-label">Delivered (Page)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon error">
                            <XCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.failed}</div>
                    <div className="stat-label">Failed (Page)</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by phone, name, or message..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '44px' }}
                        />
                    </div>

                    <select
                        className="form-select"
                        style={{ width: 'auto' }}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="incoming">Incoming</option>
                    </select>

                    <select
                        className="form-select"
                        style={{ width: 'auto' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="delivered">Delivered</option>
                        <option value="read">Read</option>
                        <option value="sent">Sent</option>
                        <option value="received">Received</option>
                        <option value="failed">Failed</option>
                    </select>

                    <button type="submit" className="btn btn-secondary">Search</button>
                </form>
            </div>

            {/* Logs Table */}
            <div className="card">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader className="animate-spin w-8 h-8 mx-auto text-primary-500" />
                    </div>
                ) : (
                    <>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>Type</th>
                                        <th>Contact</th>
                                        <th>Message</th>
                                        <th>Status</th>
                                        <th>Device</th>
                                        <th>Time</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length > 0 ? (
                                        logs.map((log) => (
                                            <tr key={log.id}>
                                                <td>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-full)',
                                                        background: log.type === 'outgoing' ? 'var(--primary-600)' : 'var(--bg-tertiary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {log.type === 'outgoing'
                                                            ? <ArrowUpRight size={16} color="white" />
                                                            : <ArrowDownLeft size={16} style={{ color: 'var(--info)' }} />
                                                        }
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{log.fromName || log.to || 'Unknown'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                                            {log.type === 'outgoing' ? log.to : log.from}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="truncate" style={{ maxWidth: '300px', fontSize: '0.875rem' }}>
                                                        {log.message || (log.mediaType && `[${log.mediaType}]`) || ''}
                                                    </div>
                                                    {log.error && (
                                                        <div style={{ fontSize: '0.625rem', color: 'var(--error)', marginTop: '2px' }}>
                                                            Error: {log.error}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{getStatusBadge(log.status)}</td>
                                                <td>
                                                    <span style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-xs)',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        <Smartphone size={12} />
                                                        {log.device?.name || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    {log.createdAt || log.time ? format(new Date(log.createdAt || log.time), 'dd MMM HH:mm') : '-'}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-icon"
                                                        style={{ width: '32px', height: '32px' }}
                                                        onClick={() => setSelectedLog(log)}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="text-center py-4 text-text-muted">No messages found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Showing page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1} ({pagination.total} total)
                            </span>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchLogs(pagination.page - 1)}
                                >
                                    Previous
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                                    onClick={() => fetchLogs(pagination.page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="modal-overlay open" onClick={() => setSelectedLog(null)}>
                    <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Message Details</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setSelectedLog(null)}>
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: 'var(--spacing-md)',
                                marginBottom: 'var(--spacing-lg)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Type</div>
                                    <div style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{selectedLog.type}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</div>
                                    {getStatusBadge(selectedLog.status)}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Contact</div>
                                    <div style={{ fontSize: '0.875rem' }}>{selectedLog.fromName || selectedLog.to}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Phone</div>
                                    <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                                        {selectedLog.type === 'outgoing' ? selectedLog.to : selectedLog.from}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Device</div>
                                    <div style={{ fontSize: '0.875rem' }}>{selectedLog.device?.name || 'Unknown'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Timestamp</div>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        {selectedLog.createdAt ? format(new Date(selectedLog.createdAt), 'dd MMM yyyy HH:mm:ss') : '-'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Message</div>
                                <div style={{
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.875rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {selectedLog.message || (selectedLog.mediaType && `[${selectedLog.mediaType}]`)}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                                Close
                            </button>
                            {/* Resend functionality could be added here later */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
