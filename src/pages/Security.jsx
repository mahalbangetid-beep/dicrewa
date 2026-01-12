import { useState, useEffect } from 'react';
import {
    Shield,
    Monitor,
    Smartphone,
    Tablet,
    Clock,
    MapPin,
    Activity,
    LogOut,
    AlertCircle,
    CheckCircle,
    History,
    Filter,
    Download,
    RefreshCw,
    Trash2,
    Eye,
    Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useConfirm } from '../components/ConfirmDialog';

export default function Security() {
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('sessions');
    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [stats, setStats] = useState(null);
    const [logPagination, setLogPagination] = useState({ page: 1, totalPages: 1 });
    const [filters, setFilters] = useState({
        action: '',
        resource: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        fetchSecurityData();
    }, []);

    const fetchSecurityData = async () => {
        setIsLoading(true);
        try {
            const [devicesRes, statsRes, logsRes] = await Promise.all([
                api.get('/devices'),
                api.get('/security/stats'),
                api.get('/security/audit-logs', { params: { limit: 20 } })
            ]);

            // Transform devices into "sessions" display - connected WhatsApp devices
            const connectedDevices = (devicesRes.data.data || []).map(device => ({
                id: device.id,
                device: device.status === 'connected' ? 'mobile' : 'desktop',
                name: device.name,
                phone: device.phone,
                status: device.status,
                ipAddress: null,
                lastActive: device.updatedAt || device.createdAt,
                isCurrent: false,
                isWhatsAppDevice: true
            }));

            setSessions(connectedDevices);
            setStats({
                ...statsRes.data.data,
                activeSessions: connectedDevices.filter(d => d.status === 'connected').length,
                totalDevices: connectedDevices.length
            });
            setAuditLogs(logsRes.data.data || []);
            setLogPagination({
                page: logsRes.data.pagination?.page || 1,
                totalPages: logsRes.data.pagination?.totalPages || 1
            });
        } catch (error) {
            console.error('Error fetching security data:', error);
            toast.error('Failed to load security data');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAuditLogs = async (page = 1) => {
        try {
            const params = { page, limit: 20, ...filters };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const res = await api.get('/security/audit-logs', { params });
            setAuditLogs(res.data.data || []);
            setLogPagination({
                page: res.data.pagination?.page || 1,
                totalPages: res.data.pagination?.totalPages || 1
            });
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            toast.error('Failed to fetch audit logs');
        }
    };

    const revokeSession = async (sessionId) => {
        const isConfirmed = await confirm({
            title: 'Revoke Session?',
            message: 'Are you sure you want to revoke this session?',
            confirmText: 'Yes, Revoke',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            await api.delete(`/security/sessions/${sessionId}`);
            setSessions(sessions.filter(s => s.id !== sessionId));
            toast.success('Session revoked successfully');
        } catch (error) {
            console.error('Error revoking session:', error);
            toast.error('Failed to revoke session');
        }
    };

    const revokeAllSessions = async () => {
        const isConfirmed = await confirm({
            title: 'Sign Out All Devices?',
            message: 'This will sign you out from all other devices. Continue?',
            confirmText: 'Yes, Sign Out All',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            await api.post('/security/sessions/revoke-all');
            fetchSecurityData();
            toast.success('All other sessions signed out');
        } catch (error) {
            console.error('Error revoking all sessions:', error);
            toast.error('Failed to sign out other sessions');
        }
    };

    const getDeviceIcon = (device) => {
        switch (device) {
            case 'mobile':
                return <Smartphone size={20} />;
            case 'tablet':
                return <Tablet size={20} />;
            default:
                return <Monitor size={20} />;
        }
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'login':
                return <CheckCircle size={16} className="text-success" />;
            case 'logout':
                return <LogOut size={16} className="text-warning" />;
            case 'create':
                return <Activity size={16} className="text-primary" />;
            case 'update':
                return <RefreshCw size={16} className="text-info" />;
            case 'delete':
                return <Trash2 size={16} className="text-danger" />;
            default:
                return <Activity size={16} />;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'login':
                return 'success';
            case 'logout':
                return 'warning';
            case 'create':
                return 'primary';
            case 'update':
                return 'info';
            case 'delete':
                return 'danger';
            default:
                return 'secondary';
        }
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>Loading security data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-title">
                    <h1>Security</h1>
                    <p>Manage your account security, sessions, and activity</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchSecurityData}>
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        <Smartphone size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Connected Devices</p>
                        <h3 className="stat-value">{stats?.activeSessions || 0}</h3>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                        <Monitor size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Devices</p>
                        <h3 className="stat-value">{stats?.totalDevices || 0}</h3>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                        <Shield size={24} />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Security Status</p>
                        <h3 className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--success)' }}>Protected</h3>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="security-tabs">
                <button
                    className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                >
                    <Monitor size={18} />
                    Active Sessions
                </button>
                <button
                    className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                    onClick={() => setActiveTab('activity')}
                >
                    <History size={18} />
                    Activity Log
                </button>
            </div>

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
                <div className="security-section">
                    <div className="section-header">
                        <div>
                            <h2>Active Sessions</h2>
                            <p>Devices where you're currently signed in</p>
                        </div>
                        {sessions.length > 1 && (
                            <button className="btn btn-danger" onClick={revokeAllSessions}>
                                <LogOut size={18} />
                                Sign Out All Other Devices
                            </button>
                        )}
                    </div>

                    <div className="sessions-list">
                        {sessions.length === 0 ? (
                            <div className="empty-state">
                                <Smartphone size={48} />
                                <h3>No devices connected</h3>
                                <p>Connect a WhatsApp device to get started</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div key={session.id} className="session-card">
                                    <div className={`session-icon ${session.status === 'connected' ? 'connected' : ''}`}>
                                        <Smartphone size={20} />
                                    </div>
                                    <div className="session-info">
                                        <div className="session-device">
                                            <h4>{session.name || 'WhatsApp Device'}</h4>
                                            <span className={`status-badge ${session.status === 'connected' ? 'success' : 'secondary'}`}>
                                                {session.status}
                                            </span>
                                        </div>
                                        <div className="session-details">
                                            {session.phone && (
                                                <span className="detail-item">
                                                    <Smartphone size={14} />
                                                    {session.phone}
                                                </span>
                                            )}
                                            <span className="detail-item">
                                                <Clock size={14} />
                                                Updated {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
                <div className="security-section">
                    <div className="section-header">
                        <div>
                            <h2>Activity Log</h2>
                            <p>Recent account activity and changes</p>
                        </div>
                        <div className="filter-controls">
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                                className="filter-select"
                            >
                                <option value="">All Actions</option>
                                <option value="login">Login</option>
                                <option value="logout">Logout</option>
                                <option value="create">Create</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                            </select>
                            <button className="btn btn-secondary btn-sm" onClick={() => fetchAuditLogs(1)}>
                                <Filter size={16} />
                                Apply
                            </button>
                        </div>
                    </div>

                    <div className="activity-list">
                        {auditLogs.length === 0 ? (
                            <div className="empty-state">
                                <History size={48} />
                                <h3>No activity yet</h3>
                                <p>Your activity will appear here</p>
                            </div>
                        ) : (
                            <>
                                <div className="activity-timeline">
                                    {auditLogs.map((log, index) => (
                                        <div key={log.id} className="activity-item">
                                            <div className="activity-connector">
                                                <div className={`activity-dot ${getActionColor(log.action)}`}>
                                                    {getActionIcon(log.action)}
                                                </div>
                                                {index < auditLogs.length - 1 && <div className="activity-line" />}
                                            </div>
                                            <div className="activity-content">
                                                <div className="activity-header">
                                                    <span className={`action-badge ${getActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                    <span className="activity-resource">{log.resource}</span>
                                                    {log.resourceId && (
                                                        <span className="resource-id">#{log.resourceId.slice(-6)}</span>
                                                    )}
                                                </div>
                                                <div className="activity-meta">
                                                    <span className="activity-time">
                                                        <Clock size={12} />
                                                        {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                                                    </span>
                                                    {log.ipAddress && (
                                                        <span className="activity-ip">
                                                            <MapPin size={12} />
                                                            {log.ipAddress}
                                                        </span>
                                                    )}
                                                </div>
                                                {log.details && (
                                                    <div className="activity-details">
                                                        <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {logPagination.totalPages > 1 && (
                                    <div className="pagination">
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            disabled={logPagination.page <= 1}
                                            onClick={() => fetchAuditLogs(logPagination.page - 1)}
                                        >
                                            Previous
                                        </button>
                                        <span className="pagination-info">
                                            Page {logPagination.page} of {logPagination.totalPages}
                                        </span>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            disabled={logPagination.page >= logPagination.totalPages}
                                            onClick={() => fetchAuditLogs(logPagination.page + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
