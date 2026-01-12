import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Activity,
    Users,
    Smartphone,
    Link2,
    Bot,
    Radio,
    BookUser,
    Webhook,
    RefreshCw,
    MessageSquare,
    Send,
    AlertTriangle,
    Key,
    Clock,
    ArrowRight
} from 'lucide-react';
import { monitoringService } from '../services/monitoringService';
import toast from 'react-hot-toast';

const MonitoringDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getDashboard();
            setData(result.data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch monitoring data:', error);
            if (error.response?.status === 403) {
                toast.error('Access denied. You need monitoring role.');
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

    const quickStats = [
        {
            title: 'Messages In',
            value: data?.messages?.incoming || 0,
            icon: MessageSquare,
            color: '#22c55e',
            link: null
        },
        {
            title: 'Messages Out',
            value: data?.messages?.outgoing || 0,
            icon: Send,
            color: '#3b82f6',
            link: null
        },
        {
            title: 'Failed',
            value: data?.messages?.failed || 0,
            icon: AlertTriangle,
            color: '#ef4444',
            link: null
        },
        {
            title: 'Total Users',
            value: data?.users?.total || 0,
            icon: Users,
            color: '#8b5cf6',
            link: '/monitoring/users'
        },
        {
            title: 'API Keys',
            value: data?.apiKeys?.total || 0,
            icon: Key,
            color: '#f59e0b',
            link: null
        },
        {
            title: 'API Requests',
            value: data?.apiKeys?.totalRequests || 0,
            icon: Activity,
            color: '#06b6d4',
            link: null
        }
    ];

    const sections = [
        { name: 'Users', icon: Users, path: '/monitoring/users', desc: 'User breakdown by plan' },
        { name: 'Connections', icon: Smartphone, path: '/monitoring/connections', desc: 'Device connection status' },
        { name: 'Integrations', icon: Link2, path: '/monitoring/integrations', desc: 'Third-party integrations' },
        { name: 'Chatbots', icon: Bot, path: '/monitoring/chatbots', desc: 'Chatbot activity' },
        { name: 'Broadcasts', icon: Radio, path: '/monitoring/broadcasts', desc: 'Campaign statistics' },
        { name: 'Contacts', icon: BookUser, path: '/monitoring/contacts', desc: 'Contact database + export' },
        { name: 'Webhooks', icon: Webhook, path: '/monitoring/webhooks', desc: 'Webhook configuration' },
    ];

    return (
        <div className="monitoring-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">📊 Monitoring Overview</h1>
                    <p className="page-subtitle">
                        Platform-wide statistics •
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
                {/* Quick Stats */}
                <div className="quick-stats-grid">
                    {quickStats.map((stat, idx) => (
                        <div key={idx} className="quick-stat-card" style={{ borderTop: `3px solid ${stat.color}` }}>
                            <div className="quick-stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                                <stat.icon size={24} />
                            </div>
                            <div className="quick-stat-content">
                                <span className="quick-stat-value">{stat.value.toLocaleString()}</span>
                                <span className="quick-stat-label">{stat.title}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Cards */}
                <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>Detailed Statistics</h3>
                <div className="monitoring-nav-grid">
                    {sections.map((section) => (
                        <Link key={section.path} to={section.path} className="monitoring-nav-card">
                            <div className="monitoring-nav-icon">
                                <section.icon size={24} />
                            </div>
                            <div className="monitoring-nav-content">
                                <span className="monitoring-nav-title">{section.name}</span>
                                <span className="monitoring-nav-desc">{section.desc}</span>
                            </div>
                            <ArrowRight size={18} className="monitoring-nav-arrow" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MonitoringDashboard;
