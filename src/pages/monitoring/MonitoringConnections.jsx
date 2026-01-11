import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringConnections = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getConnections();
            setData(result.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch data:', error);
            if (error.response?.status === 403) {
                navigate('/dashboard');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const timeSince = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        return `${Math.floor(seconds / 60)}m ago`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="animate-spin w-8 h-8 text-primary-500" />
            </div>
        );
    }

    const statuses = [
        { name: 'Connected', count: data?.byStatus?.connected || 0, color: '#22c55e', icon: Wifi },
        { name: 'Disconnected', count: data?.byStatus?.disconnected || 0, color: '#ef4444', icon: WifiOff },
        { name: 'Connecting', count: (data?.byStatus?.connecting || 0) + (data?.byStatus?.qr || 0), color: '#f59e0b', icon: Smartphone },
    ];

    const total = data?.total || 0;

    return (
        <div className="monitoring-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📱 Device Connections</h1>
                    <p className="page-subtitle">
                        Real-time connection status •
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                            <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            Updated {timeSince(lastUpdated)}
                        </span>
                    </p>
                </div>
                <button className="btn btn-primary" onClick={fetchData}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="monitoring-content">
                {/* Total Devices Card */}
                <div className="big-stat-card">
                    <div className="big-stat-icon">
                        <Smartphone size={48} />
                    </div>
                    <div className="big-stat-info">
                        <span className="big-stat-value">{total.toLocaleString()}</span>
                        <span className="big-stat-label">Total Devices</span>
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="stat-breakdown-grid three-col">
                    {statuses.map((status) => (
                        <div key={status.name} className="breakdown-card" style={{ borderLeftColor: status.color }}>
                            <div className="breakdown-header">
                                <span className="breakdown-name">
                                    <status.icon size={16} style={{ marginRight: '8px', color: status.color }} />
                                    {status.name}
                                </span>
                                <span className="breakdown-badge" style={{ background: status.color }}>
                                    {total > 0 ? ((status.count / total) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                            <div className="breakdown-value">{status.count.toLocaleString()}</div>
                            <div className="breakdown-bar">
                                <div
                                    className="breakdown-bar-fill"
                                    style={{
                                        width: `${total > 0 ? (status.count / total) * 100 : 0}%`,
                                        background: status.color
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MonitoringConnections;
