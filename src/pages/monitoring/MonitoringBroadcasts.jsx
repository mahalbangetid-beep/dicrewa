import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, RefreshCw, Clock, CheckCircle, AlertCircle, Play, Pause } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringBroadcasts = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getBroadcasts();
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
        { name: 'Pending', count: data?.byStatus?.pending || 0, color: '#64748b', icon: Pause },
        { name: 'Running', count: data?.byStatus?.running || 0, color: '#f59e0b', icon: Play },
        { name: 'Completed', count: data?.byStatus?.completed || 0, color: '#22c55e', icon: CheckCircle },
        { name: 'Failed', count: data?.byStatus?.failed || 0, color: '#ef4444', icon: AlertCircle },
    ];

    return (
        <div className="monitoring-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📢 Broadcast Statistics</h1>
                    <p className="page-subtitle">
                        Campaign overview •
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
                {/* Total Card */}
                <div className="big-stat-card">
                    <div className="big-stat-icon">
                        <Radio size={48} />
                    </div>
                    <div className="big-stat-info">
                        <span className="big-stat-value">{(data?.total || 0).toLocaleString()}</span>
                        <span className="big-stat-label">Total Broadcasts</span>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="stat-cards-row four-col">
                    {statuses.map((status) => (
                        <div key={status.name} className="stat-card-large" style={{ borderTop: `3px solid ${status.color}` }}>
                            <div className="stat-card-icon" style={{ background: `${status.color}20`, color: status.color }}>
                                <status.icon size={32} />
                            </div>
                            <div className="stat-card-content">
                                <span className="stat-card-value">{status.count.toLocaleString()}</span>
                                <span className="stat-card-label">{status.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MonitoringBroadcasts;
