import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, RefreshCw, Clock } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringIntegrations = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getIntegrations();
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

    const integrationTypes = data?.byType ? Object.entries(data.byType) : [];
    const total = data?.total || 0;

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

    return (
        <div className="monitoring-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🔗 Integration Statistics</h1>
                    <p className="page-subtitle">
                        Connected integrations •
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
                        <Link2 size={48} />
                    </div>
                    <div className="big-stat-info">
                        <span className="big-stat-value">{total.toLocaleString()}</span>
                        <span className="big-stat-label">Total Integrations</span>
                    </div>
                </div>

                {/* Type Breakdown */}
                {integrationTypes.length > 0 ? (
                    <div className="stat-breakdown-grid">
                        {integrationTypes.map(([type, count], index) => (
                            <div key={type} className="breakdown-card" style={{ borderLeftColor: colors[index % colors.length] }}>
                                <div className="breakdown-header">
                                    <span className="breakdown-name">{type}</span>
                                    <span className="breakdown-badge" style={{ background: colors[index % colors.length] }}>
                                        {total > 0 ? ((count / total) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                                <div className="breakdown-value">{count.toLocaleString()}</div>
                                <div className="breakdown-bar">
                                    <div
                                        className="breakdown-bar-fill"
                                        style={{
                                            width: `${total > 0 ? (count / total) * 100 : 0}%`,
                                            background: colors[index % colors.length]
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Link2 size={48} />
                        <p>No integrations configured yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonitoringIntegrations;
