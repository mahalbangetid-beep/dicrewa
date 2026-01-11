import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookUser, RefreshCw, Clock, Mail, Download } from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

const MonitoringContacts = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [data, setData] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await monitoringService.getContacts();
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
                    <h1 className="page-title">📇 Contact Statistics</h1>
                    <p className="page-subtitle">
                        Contact database •
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
                <div className="stat-cards-row">
                    <div className="stat-card-large">
                        <div className="stat-card-icon" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}>
                            <BookUser size={32} />
                        </div>
                        <div className="stat-card-content">
                            <span className="stat-card-value">{(data?.total || 0).toLocaleString()}</span>
                            <span className="stat-card-label">Total Contacts</span>
                        </div>
                    </div>

                    <div className="stat-card-large">
                        <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                            <Mail size={32} />
                        </div>
                        <div className="stat-card-content">
                            <span className="stat-card-value">{(data?.withEmail || 0).toLocaleString()}</span>
                            <span className="stat-card-label">With Email</span>
                        </div>
                    </div>
                </div>

                {/* Export Section */}
                <div className="export-section">
                    <h3>Export Data</h3>
                    <p>Download contact data in CSV format</p>
                    <div className="export-buttons-large">
                        <button
                            className="btn btn-secondary"
                            onClick={() => monitoringService.exportContacts('contact')}
                        >
                            <Download size={18} />
                            Export All Contacts
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => monitoringService.exportContacts('email')}
                        >
                            <Download size={18} />
                            Export Emails Only
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringContacts;
