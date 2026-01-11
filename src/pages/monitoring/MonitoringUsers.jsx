import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, RefreshCw, Clock, PieChart } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringUsers = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getUsers();
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

    const plans = [
        { name: 'Free', count: data?.byPlan?.free || 0, color: '#64748b' },
        { name: 'Pro', count: data?.byPlan?.pro || 0, color: '#3b82f6' },
        { name: 'Enterprise', count: data?.byPlan?.enterprise || 0, color: '#8b5cf6' },
        { name: 'Unlimited', count: data?.byPlan?.unlimited || 0, color: '#22c55e' },
    ];

    const total = data?.total || 0;

    return (
        <div className="monitoring-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">👥 User Statistics</h1>
                    <p className="page-subtitle">
                        User breakdown by plan •
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
                {/* Total Users Card */}
                <div className="big-stat-card">
                    <div className="big-stat-icon">
                        <Users size={48} />
                    </div>
                    <div className="big-stat-info">
                        <span className="big-stat-value">{total.toLocaleString()}</span>
                        <span className="big-stat-label">Total Registered Users</span>
                    </div>
                </div>

                {/* Plan Breakdown */}
                <div className="stat-breakdown-grid">
                    {plans.map((plan) => (
                        <div key={plan.name} className="breakdown-card" style={{ borderLeftColor: plan.color }}>
                            <div className="breakdown-header">
                                <span className="breakdown-name">{plan.name} Plan</span>
                                <span className="breakdown-badge" style={{ background: plan.color }}>
                                    {total > 0 ? ((plan.count / total) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                            <div className="breakdown-value">{plan.count.toLocaleString()}</div>
                            <div className="breakdown-bar">
                                <div
                                    className="breakdown-bar-fill"
                                    style={{
                                        width: `${total > 0 ? (plan.count / total) * 100 : 0}%`,
                                        background: plan.color
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

export default MonitoringUsers;
