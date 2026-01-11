import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Webhook, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringWebhooks = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getWebhooks();
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

    return (
        <div className="monitoring-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🔔 Webhook Statistics</h1>
                    <p className="page-subtitle">
                        Webhook configuration •
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
                <div className="stat-cards-row three-col">
                    <div className="stat-card-large">
                        <div className="stat-card-icon" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}>
                            <Webhook size={32} />
                        </div>
                        <div className="stat-card-content">
                            <span className="stat-card-value">{(data?.total || 0).toLocaleString()}</span>
                            <span className="stat-card-label">Total Webhooks</span>
                        </div>
                    </div>

                    <div className="stat-card-large">
                        <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                            <CheckCircle size={32} />
                        </div>
                        <div className="stat-card-content">
                            <span className="stat-card-value">{(data?.active || 0).toLocaleString()}</span>
                            <span className="stat-card-label">Active</span>
                        </div>
                    </div>

                    <div className="stat-card-large">
                        <div className="stat-card-icon" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' }}>
                            <XCircle size={32} />
                        </div>
                        <div className="stat-card-content">
                            <span className="stat-card-value">{(data?.inactive || 0).toLocaleString()}</span>
                            <span className="stat-card-label">Inactive</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringWebhooks;
