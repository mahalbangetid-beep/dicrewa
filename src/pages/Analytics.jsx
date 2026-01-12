import { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    MessageSquare,
    Smartphone,
    Send,
    Workflow,
    Bot,
    Download,
    RefreshCw,
    Calendar,
    ArrowUp,
    ArrowDown,
    CheckCircle,
    XCircle,
    Eye
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';

const COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#00A884'];

export default function Analytics() {
    const [period, setPeriod] = useState('7d');
    const [isLoading, setIsLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [messageStats, setMessageStats] = useState(null);
    const [deviceStats, setDeviceStats] = useState(null);
    const [broadcastStats, setBroadcastStats] = useState(null);
    const [chatbotStats, setChatbotStats] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            // Add timestamp to bypass browser cache
            const timestamp = Date.now();
            const [overviewRes, messagesRes, devicesRes, broadcastsRes, chatbotsRes] = await Promise.all([
                api.get('/analytics/overview', { params: { period, _t: timestamp } }),
                api.get('/analytics/messages', { params: { period, _t: timestamp } }),
                api.get('/analytics/devices', { params: { period, _t: timestamp } }),
                api.get('/analytics/broadcasts', { params: { period, _t: timestamp } }),
                api.get('/analytics/chatbots', { params: { period, _t: timestamp } })
            ]);

            setOverview(overviewRes.data.data);
            setMessageStats(messagesRes.data.data);
            setDeviceStats(devicesRes.data.data);
            setBroadcastStats(broadcastsRes.data.data);
            setChatbotStats(chatbotsRes.data.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            console.error('Error details:', error.response?.data || error.message);
            const errorMsg = error.response?.data?.error || error.message || 'Failed to load analytics';
            toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to load analytics');
        } finally {
            setIsLoading(false);
        }
    };

    const exportData = async () => {
        try {
            const response = await api.get('/analytics/export', {
                params: { type: 'messages', period }, // Use selected period instead of hardcoded '30d'
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `messages_export_${period}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Export downloaded successfully');
        } catch (error) {
            console.error('Error exporting data:', error);
            toast.error('Failed to export data');
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="chart-tooltip">
                    <p className="tooltip-label">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>Loading analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container analytics-page">
            <div className="page-header">
                <div className="page-title">
                    <h1>Analytics</h1>
                    <p>Track your messaging performance and insights</p>
                </div>
                <div className="header-actions">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="period-select"
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                    </select>
                    <button className="btn btn-secondary" onClick={fetchAnalytics}>
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                    <button className="btn btn-primary" onClick={exportData}>
                        <Download size={18} />
                        Export
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="analytics-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <BarChart3 size={18} />
                    Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('messages')}
                >
                    <MessageSquare size={18} />
                    Messages
                </button>
                <button
                    className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('devices')}
                >
                    <Smartphone size={18} />
                    Devices
                </button>
                <button
                    className={`tab-btn ${activeTab === 'broadcasts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('broadcasts')}
                >
                    <Send size={18} />
                    Broadcasts
                </button>
                <button
                    className={`tab-btn ${activeTab === 'chatbots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chatbots')}
                >
                    <Workflow size={18} />
                    Chatbots
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
                <>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                                <MessageSquare size={24} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Messages</p>
                                <h3 className="stat-value">{overview.messages?.total?.toLocaleString() || 0}</h3>
                                <div className="stat-change positive">
                                    <ArrowUp size={14} />
                                    <span>{overview.messages?.deliveryRate || 0}% delivery rate</span>
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                <Smartphone size={24} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Active Devices</p>
                                <h3 className="stat-value">{overview.devices?.connectedDevices || 0}</h3>
                                <span className="stat-sub">of {overview.devices?.totalDevices || 0} total</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                                <Send size={24} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Broadcasts Sent</p>
                                <h3 className="stat-value">{overview.broadcasts?.totalBroadcasts || 0}</h3>
                                <span className="stat-sub">{overview.broadcasts?.totalSent?.toLocaleString() || 0} messages</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                                <Workflow size={24} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Chatbot Executions</p>
                                <h3 className="stat-value">{overview.chatbots?.totalExecutions?.toLocaleString() || 0}</h3>
                                <span className="stat-sub">{overview.chatbots?.activeChatbots || 0} active bots</span>
                            </div>
                        </div>
                    </div>

                    {/* Message Chart */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>Message Activity</h3>
                            <div className="chart-legend">
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ background: '#25D366' }}></span>
                                    Incoming
                                </span>
                                <span className="legend-item">
                                    <span className="legend-dot" style={{ background: '#128C7E' }}></span>
                                    Outgoing
                                </span>
                            </div>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={overview.messageChart || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(value) => {
                                            const date = new Date(value);
                                            return `${date.getMonth() + 1}/${date.getDate()}`;
                                        }}
                                    />
                                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line
                                        type="monotone"
                                        dataKey="incoming"
                                        name="Incoming"
                                        stroke="#25D366"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="outgoing"
                                        name="Outgoing"
                                        stroke="#128C7E"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && messageStats && (
                <>
                    <div className="stats-grid stats-grid-sm">
                        <div className="stat-card compact">
                            <div className="stat-icon small primary">
                                <MessageSquare size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total</p>
                                <h3 className="stat-value">{messageStats.summary?.total?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small success">
                                <ArrowDown size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Incoming</p>
                                <h3 className="stat-value">{messageStats.summary?.incoming?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small info">
                                <ArrowUp size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Outgoing</p>
                                <h3 className="stat-value">{messageStats.summary?.outgoing?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small success">
                                <CheckCircle size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Delivered</p>
                                <h3 className="stat-value">{messageStats.summary?.delivered?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small warning">
                                <Eye size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Read</p>
                                <h3 className="stat-value">{messageStats.summary?.read?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small error">
                                <XCircle size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Failed</p>
                                <h3 className="stat-value">{messageStats.summary?.failed?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>Message Trend</h3>
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={messageStats.chartData || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(value) => {
                                            const date = new Date(value);
                                            return `${date.getMonth() + 1}/${date.getDate()}`;
                                        }}
                                    />
                                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="incoming" name="Incoming" fill="#25D366" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="outgoing" name="Outgoing" fill="#128C7E" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="metrics-grid">
                        <div className="metric-card">
                            <h4>Delivery Rate</h4>
                            <div className="metric-value">{messageStats.summary?.deliveryRate || 0}%</div>
                            <div className="metric-bar">
                                <div
                                    className="metric-progress success"
                                    style={{ width: `${messageStats.summary?.deliveryRate || 0}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <h4>Read Rate</h4>
                            <div className="metric-value">{messageStats.summary?.readRate || 0}%</div>
                            <div className="metric-bar">
                                <div
                                    className="metric-progress info"
                                    style={{ width: `${messageStats.summary?.readRate || 0}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Devices Tab */}
            {activeTab === 'devices' && deviceStats && (
                <>
                    <div className="stats-grid stats-grid-sm">
                        <div className="stat-card compact">
                            <div className="stat-icon small primary">
                                <Smartphone size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Devices</p>
                                <h3 className="stat-value">{deviceStats.summary?.totalDevices || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small success">
                                <CheckCircle size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Connected</p>
                                <h3 className="stat-value">{deviceStats.summary?.connectedDevices || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small info">
                                <MessageSquare size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Messages</p>
                                <h3 className="stat-value">{deviceStats.summary?.totalMessages?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="devices-table-card">
                        <h3>Device Performance</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Device</th>
                                        <th>Status</th>
                                        <th>Messages</th>
                                        <th>Incoming</th>
                                        <th>Outgoing</th>
                                        <th>Delivery Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deviceStats.devices?.map(device => (
                                        <tr key={device.id}>
                                            <td>
                                                <div className="device-cell">
                                                    <Smartphone size={16} />
                                                    <span>{device.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${device.status === 'connected' ? 'success' : 'warning'}`}>
                                                    {device.status}
                                                </span>
                                            </td>
                                            <td>{device.messageCount?.toLocaleString()}</td>
                                            <td>{device.incoming?.toLocaleString()}</td>
                                            <td>{device.outgoing?.toLocaleString()}</td>
                                            <td>
                                                <div className="progress-cell">
                                                    <span>{device.deliveryRate}%</span>
                                                    <div className="mini-bar">
                                                        <div
                                                            className="mini-progress"
                                                            style={{ width: `${device.deliveryRate}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Broadcasts Tab */}
            {activeTab === 'broadcasts' && broadcastStats && (
                <>
                    <div className="stats-grid stats-grid-sm">
                        <div className="stat-card compact">
                            <div className="stat-icon small primary">
                                <Send size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Broadcasts</p>
                                <h3 className="stat-value">{broadcastStats.summary?.totalBroadcasts || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small info">
                                <MessageSquare size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Sent</p>
                                <h3 className="stat-value">{broadcastStats.summary?.totalSent?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small success">
                                <CheckCircle size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Delivered</p>
                                <h3 className="stat-value">{broadcastStats.summary?.totalDelivered?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small warning">
                                <Eye size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Read</p>
                                <h3 className="stat-value">{broadcastStats.summary?.totalRead?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="devices-table-card">
                        <h3>Recent Broadcasts</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Device</th>
                                        <th>Status</th>
                                        <th>Recipients</th>
                                        <th>Sent</th>
                                        <th>Delivered</th>
                                        <th>Read</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {broadcastStats.recentBroadcasts?.map(broadcast => (
                                        <tr key={broadcast.id}>
                                            <td>{broadcast.name}</td>
                                            <td>{broadcast.deviceName}</td>
                                            <td>
                                                <span className={`status-badge ${broadcast.status === 'completed' ? 'success' : broadcast.status === 'running' ? 'info' : 'secondary'}`}>
                                                    {broadcast.status}
                                                </span>
                                            </td>
                                            <td>{broadcast.recipients?.toLocaleString()}</td>
                                            <td>{broadcast.sent?.toLocaleString()}</td>
                                            <td>{broadcast.delivered?.toLocaleString()}</td>
                                            <td>{broadcast.read?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Chatbots Tab */}
            {activeTab === 'chatbots' && chatbotStats && (
                <>
                    <div className="stats-grid stats-grid-sm">
                        <div className="stat-card compact">
                            <div className="stat-icon small primary">
                                <Workflow size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Chatbots</p>
                                <h3 className="stat-value">{chatbotStats.summary?.totalChatbots || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small success">
                                <CheckCircle size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Active</p>
                                <h3 className="stat-value">{chatbotStats.summary?.activeChatbots || 0}</h3>
                            </div>
                        </div>
                        <div className="stat-card compact">
                            <div className="stat-icon small info">
                                <TrendingUp size={18} />
                            </div>
                            <div className="stat-content">
                                <p className="stat-label">Total Executions</p>
                                <h3 className="stat-value">{chatbotStats.summary?.totalExecutions?.toLocaleString() || 0}</h3>
                            </div>
                        </div>
                    </div>

                    {chatbotStats.topChatbots?.length > 0 && (
                        <div className="chart-card">
                            <div className="chart-header">
                                <h3>Top Performing Chatbots</h3>
                            </div>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart
                                        data={chatbotStats.topChatbots}
                                        layout="vertical"
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                                        <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            stroke="#94a3b8"
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            width={150}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar
                                            dataKey="executionCount"
                                            name="Executions"
                                            fill="#25D366"
                                            radius={[0, 4, 4, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div className="devices-table-card">
                        <h3>All Chatbots</h3>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Device</th>
                                        <th>Status</th>
                                        <th>Trigger</th>
                                        <th>Nodes</th>
                                        <th>Executions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chatbotStats.chatbots?.map(chatbot => (
                                        <tr key={chatbot.id}>
                                            <td>{chatbot.name}</td>
                                            <td>{chatbot.deviceName}</td>
                                            <td>
                                                <span className={`status-badge ${chatbot.isActive ? 'success' : 'secondary'}`}>
                                                    {chatbot.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="trigger-type">{chatbot.triggerType}</span>
                                            </td>
                                            <td>{chatbot.nodeCount}</td>
                                            <td>{chatbot.executionCount?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
