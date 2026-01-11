import { useState, useEffect } from 'react';
import { API_URL } from '../utils/config';

// Integration icons (emoji fallbacks)
const integrationIcons = {
    google_sheets: '📊',
    airtable: '📋',
    notion: '📝',
    telegram: '💬',
    discord: '🎮',
    slack: '💼',
    email: '📧',
    custom_webhook: '🔗'
};

// Status badge colors
const statusColors = {
    connected: 'var(--success)',
    pending: 'var(--warning)',
    error: 'var(--danger)',
    syncing: 'var(--info)'
};

export default function Integrations() {
    const [availableIntegrations, setAvailableIntegrations] = useState([]);
    const [userIntegrations, setUserIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedType, setSelectedType] = useState(null);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [integrationLogs, setIntegrationLogs] = useState([]);
    const [formData, setFormData] = useState({ name: '', config: {} });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [syncing, setSyncing] = useState({});
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchData = async () => {
        try {
            const [availableRes, userRes] = await Promise.all([
                fetch(`${API_URL}/integrations/available`, { headers: getAuthHeader() }),
                fetch(`${API_URL}/integrations`, { headers: getAuthHeader() })
            ]);

            if (availableRes.ok) {
                setAvailableIntegrations(await availableRes.json());
            }
            if (userRes.ok) {
                setUserIntegrations(await userRes.json());
            }
        } catch (error) {
            console.error('Error fetching integrations:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = (type) => {
        const typeInfo = availableIntegrations.find(i => i.type === type);
        setSelectedType(typeInfo);
        setFormData({
            name: typeInfo?.name || '',
            config: getDefaultConfig(type)
        });
        setTestResult(null);
        setShowModal(true);
    };

    const openEditModal = (integration) => {
        const typeInfo = availableIntegrations.find(i => i.type === integration.type);
        setSelectedType(typeInfo);
        setSelectedIntegration(integration);
        setFormData({
            name: integration.name,
            config: JSON.parse(integration.config)
        });
        setTestResult(null);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedType(null);
        setSelectedIntegration(null);
        setFormData({ name: '', config: {} });
        setTestResult(null);
    };

    const getDefaultConfig = (type) => {
        const defaults = {
            google_sheets: { spreadsheetId: '', sheetName: '', syncType: 'contacts', direction: 'import', fieldMapping: { name: 'name', phone: 'phone', email: 'email' } },
            telegram: { botToken: '', chatId: '', events: ['message.received'], keywords: [], formatTemplate: '' },
            discord: { webhookUrl: '', username: 'KeepWhatsApp', events: ['message.received'], embedColor: '#25D366' },
            slack: { webhookUrl: '', channel: '', username: 'KeepWhatsApp', events: ['message.received'] },
            email: { host: '', port: 587, secure: false, auth: { user: '', pass: '' }, from: '', to: [], events: ['message.received', 'device.disconnected'] },
            custom_webhook: { url: '', method: 'POST', headers: {}, events: ['message.received'], payloadTemplate: '' },
            airtable: { apiKey: '', baseId: '', tableId: '', syncType: 'contacts', fieldMapping: {} },
            notion: { apiKey: '', databaseId: '', syncType: 'contacts', createPageOnNewContact: false }
        };
        return defaults[type] || {};
    };

    const handleConfigChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            config: { ...prev.config, [field]: value }
        }));
    };

    const handleNestedConfigChange = (parent, field, value) => {
        setFormData(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [parent]: { ...prev.config[parent], [field]: value }
            }
        }));
    };

    const handleEventsChange = (event, checked) => {
        setFormData(prev => {
            const events = prev.config.events || [];
            if (checked) {
                return { ...prev, config: { ...prev.config, events: [...events, event] } };
            } else {
                return { ...prev, config: { ...prev.config, events: events.filter(e => e !== event) } };
            }
        });
    };

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`${API_URL}/integrations/test-config`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ type: selectedType.type, config: formData.config })
            });
            const result = await res.json();
            setTestResult(result);
        } catch (error) {
            setTestResult({ success: false, message: error.message });
        } finally {
            setTesting(false);
        }
    };

    const saveIntegration = async () => {
        try {
            const url = selectedIntegration
                ? `${API_URL}/integrations/${selectedIntegration.id}`
                : `${API_URL}/integrations`;

            const method = selectedIntegration ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: getAuthHeader(),
                body: JSON.stringify({
                    name: formData.name,
                    type: selectedType.type,
                    config: formData.config
                })
            });

            if (res.ok) {
                closeModal();
                fetchData();
            } else {
                const error = await res.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            alert('Error saving integration: ' + error.message);
        }
    };

    const deleteIntegration = async (id) => {
        if (!confirm('Are you sure you want to delete this integration?')) return;

        try {
            const res = await fetch(`${API_URL}/integrations/${id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error deleting integration:', error);
        }
    };

    const toggleIntegration = async (id, isActive) => {
        try {
            await fetch(`${API_URL}/integrations/${id}/toggle`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ isActive })
            });
            fetchData();
        } catch (error) {
            console.error('Error toggling integration:', error);
        }
    };

    const syncIntegration = async (id) => {
        setSyncing(prev => ({ ...prev, [id]: true }));
        try {
            const res = await fetch(`${API_URL}/integrations/${id}/sync`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const result = await res.json();
            if (result.success) {
                alert(`Sync complete! ${result.recordsCount} records processed.`);
            } else {
                alert('Sync failed: ' + result.message);
            }
            fetchData();
        } catch (error) {
            alert('Sync error: ' + error.message);
        } finally {
            setSyncing(prev => ({ ...prev, [id]: false }));
        }
    };

    const viewLogs = async (integration) => {
        try {
            const res = await fetch(`${API_URL}/integrations/${integration.id}/logs`, {
                headers: getAuthHeader()
            });
            if (res.ok) {
                const logs = await res.json();
                setIntegrationLogs(logs);
                setSelectedIntegration(integration);
                setShowLogsModal(true);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const renderConfigForm = () => {
        if (!selectedType) return null;

        switch (selectedType.type) {
            case 'google_sheets':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Spreadsheet URL or ID</label>
                            <input
                                type="text"
                                value={formData.config.spreadsheetId || ''}
                                onChange={(e) => handleConfigChange('spreadsheetId', e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                            />
                            <small>Make sure the spreadsheet is publicly accessible or shared</small>
                        </div>
                        <div className="form-group">
                            <label>Sheet Name/GID (optional)</label>
                            <input
                                type="text"
                                value={formData.config.sheetName || ''}
                                onChange={(e) => handleConfigChange('sheetName', e.target.value)}
                                placeholder="Sheet1 or 0"
                            />
                        </div>
                        <div className="form-group">
                            <label>Sync Type</label>
                            <select
                                value={formData.config.syncType || 'contacts'}
                                onChange={(e) => handleConfigChange('syncType', e.target.value)}
                            >
                                <option value="contacts">Contacts</option>
                                <option value="autoreplies">Auto-Reply Rules</option>
                                <option value="broadcast">Broadcast Recipients</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Direction</label>
                            <select
                                value={formData.config.direction || 'import'}
                                onChange={(e) => handleConfigChange('direction', e.target.value)}
                            >
                                <option value="import">Import (Sheets → App)</option>
                                <option value="export">Export (App → Sheets)</option>
                            </select>
                        </div>
                        <div className="form-section">
                            <h4>Field Mapping</h4>
                            <div className="field-mapping-grid">
                                <div className="form-group">
                                    <label>Name Column</label>
                                    <input
                                        type="text"
                                        value={formData.config.fieldMapping?.name || 'name'}
                                        onChange={(e) => handleNestedConfigChange('fieldMapping', 'name', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Phone Column</label>
                                    <input
                                        type="text"
                                        value={formData.config.fieldMapping?.phone || 'phone'}
                                        onChange={(e) => handleNestedConfigChange('fieldMapping', 'phone', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email Column</label>
                                    <input
                                        type="text"
                                        value={formData.config.fieldMapping?.email || 'email'}
                                        onChange={(e) => handleNestedConfigChange('fieldMapping', 'email', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'telegram':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Bot Token</label>
                            <input
                                type="text"
                                value={formData.config.botToken || ''}
                                onChange={(e) => handleConfigChange('botToken', e.target.value)}
                                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                            />
                            <small>Get from @BotFather on Telegram</small>
                        </div>
                        <div className="form-group">
                            <label>Chat ID</label>
                            <input
                                type="text"
                                value={formData.config.chatId || ''}
                                onChange={(e) => handleConfigChange('chatId', e.target.value)}
                                placeholder="-1001234567890 or 123456789"
                            />
                            <small>Get from @userinfobot or @getidsbot</small>
                        </div>
                        {renderEventsCheckboxes()}
                        <div className="form-group">
                            <label>Keyword Filters (optional, comma-separated)</label>
                            <input
                                type="text"
                                value={(formData.config.keywords || []).join(', ')}
                                onChange={(e) => handleConfigChange('keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                                placeholder="urgent, help, complaint"
                            />
                            <small>Only notify messages containing these keywords</small>
                        </div>
                    </div>
                );

            case 'discord':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Webhook URL</label>
                            <input
                                type="text"
                                value={formData.config.webhookUrl || ''}
                                onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                            />
                            <small>Get from Discord Channel Settings → Integrations → Webhooks</small>
                        </div>
                        <div className="form-group">
                            <label>Bot Username</label>
                            <input
                                type="text"
                                value={formData.config.username || 'KeepWhatsApp'}
                                onChange={(e) => handleConfigChange('username', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Embed Color</label>
                            <input
                                type="color"
                                value={formData.config.embedColor || '#25D366'}
                                onChange={(e) => handleConfigChange('embedColor', e.target.value)}
                            />
                        </div>
                        {renderEventsCheckboxes()}
                    </div>
                );

            case 'slack':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Webhook URL</label>
                            <input
                                type="text"
                                value={formData.config.webhookUrl || ''}
                                onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
                                placeholder="https://hooks.slack.com/services/..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Channel (optional)</label>
                            <input
                                type="text"
                                value={formData.config.channel || ''}
                                onChange={(e) => handleConfigChange('channel', e.target.value)}
                                placeholder="#general"
                            />
                        </div>
                        {renderEventsCheckboxes()}
                    </div>
                );

            case 'email':
                return (
                    <div className="config-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>SMTP Host</label>
                                <input
                                    type="text"
                                    value={formData.config.host || ''}
                                    onChange={(e) => handleConfigChange('host', e.target.value)}
                                    placeholder="smtp.gmail.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Port</label>
                                <input
                                    type="number"
                                    value={formData.config.port || 587}
                                    onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={formData.config.auth?.user || ''}
                                    onChange={(e) => handleNestedConfigChange('auth', 'user', e.target.value)}
                                    placeholder="your@email.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    value={formData.config.auth?.pass || ''}
                                    onChange={(e) => handleNestedConfigChange('auth', 'pass', e.target.value)}
                                    placeholder="App password"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>From Email</label>
                            <input
                                type="email"
                                value={formData.config.from || ''}
                                onChange={(e) => handleConfigChange('from', e.target.value)}
                                placeholder="noreply@yourdomain.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>To Emails (comma-separated)</label>
                            <input
                                type="text"
                                value={(formData.config.to || []).join(', ')}
                                onChange={(e) => handleConfigChange('to', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                                placeholder="admin@example.com, team@example.com"
                            />
                        </div>
                        {renderEventsCheckboxes()}
                    </div>
                );

            case 'custom_webhook':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Webhook URL</label>
                            <input
                                type="text"
                                value={formData.config.url || ''}
                                onChange={(e) => handleConfigChange('url', e.target.value)}
                                placeholder="https://your-server.com/webhook"
                            />
                        </div>
                        <div className="form-group">
                            <label>Method</label>
                            <select
                                value={formData.config.method || 'POST'}
                                onChange={(e) => handleConfigChange('method', e.target.value)}
                            >
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Custom Headers (JSON)</label>
                            <textarea
                                value={JSON.stringify(formData.config.headers || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        handleConfigChange('headers', JSON.parse(e.target.value));
                                    } catch { }
                                }}
                                placeholder='{"Authorization": "Bearer xxx"}'
                                rows={3}
                            />
                        </div>
                        {renderEventsCheckboxes()}
                    </div>
                );

            case 'airtable':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>API Key / Personal Access Token</label>
                            <input
                                type="password"
                                value={formData.config.apiKey || ''}
                                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                                placeholder="patXXX..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Base ID</label>
                            <input
                                type="text"
                                value={formData.config.baseId || ''}
                                onChange={(e) => handleConfigChange('baseId', e.target.value)}
                                placeholder="appXXX..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Table ID or Name</label>
                            <input
                                type="text"
                                value={formData.config.tableId || ''}
                                onChange={(e) => handleConfigChange('tableId', e.target.value)}
                                placeholder="Contacts or tblXXX..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Sync Type</label>
                            <select
                                value={formData.config.syncType || 'contacts'}
                                onChange={(e) => handleConfigChange('syncType', e.target.value)}
                            >
                                <option value="contacts">Contacts</option>
                            </select>
                        </div>
                    </div>
                );

            case 'notion':
                return (
                    <div className="config-form">
                        <div className="form-group">
                            <label>Integration Token</label>
                            <input
                                type="password"
                                value={formData.config.apiKey || ''}
                                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                                placeholder="secret_XXX..."
                            />
                            <small>Create at notion.so/my-integrations</small>
                        </div>
                        <div className="form-group">
                            <label>Database ID</label>
                            <input
                                type="text"
                                value={formData.config.databaseId || ''}
                                onChange={(e) => handleConfigChange('databaseId', e.target.value)}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            />
                            <small>Get from database URL or share link</small>
                        </div>
                        <div className="form-group">
                            <label>Sync Type</label>
                            <select
                                value={formData.config.syncType || 'contacts'}
                                onChange={(e) => handleConfigChange('syncType', e.target.value)}
                            >
                                <option value="contacts">Contacts</option>
                            </select>
                        </div>
                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={formData.config.createPageOnNewContact || false}
                                    onChange={(e) => handleConfigChange('createPageOnNewContact', e.target.checked)}
                                />
                                Create page for new contacts
                            </label>
                        </div>
                    </div>
                );

            default:
                return <p>Configuration not available for this integration type.</p>;
        }
    };

    const renderEventsCheckboxes = () => {
        const allEvents = [
            { value: 'message.received', label: 'Message Received' },
            { value: 'message.sent', label: 'Message Sent' },
            { value: 'message.failed', label: 'Message Failed' },
            { value: 'device.connected', label: 'Device Connected' },
            { value: 'device.disconnected', label: 'Device Disconnected' },
            { value: 'broadcast.started', label: 'Broadcast Started' },
            { value: 'broadcast.completed', label: 'Broadcast Completed' }
        ];

        const currentEvents = formData.config.events || [];

        return (
            <div className="form-group">
                <label>Events to Notify</label>
                <div className="events-grid">
                    {allEvents.map(event => (
                        <label key={event.value} className="event-checkbox">
                            <input
                                type="checkbox"
                                checked={currentEvents.includes(event.value)}
                                onChange={(e) => handleEventsChange(event.value, e.target.checked)}
                            />
                            <span>{event.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    const filterIntegrationsByCategory = (category) => {
        if (category === 'all') return availableIntegrations;
        return availableIntegrations.filter(i => i.category === category);
    };

    const isConnected = (type) => {
        return userIntegrations.some(i => i.type === type && i.status === 'connected');
    };

    const getUserIntegrationByType = (type) => {
        return userIntegrations.find(i => i.type === type);
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1>🔌 Integrations</h1>
                    <p>Connect KeepWhatsApp with your favorite apps and services</p>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="integration-tabs">
                <button
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All
                </button>
                <button
                    className={`tab-btn ${activeTab === 'spreadsheet' ? 'active' : ''}`}
                    onClick={() => setActiveTab('spreadsheet')}
                >
                    📊 Spreadsheets
                </button>
                <button
                    className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
                    onClick={() => setActiveTab('database')}
                >
                    📋 Databases
                </button>
                <button
                    className={`tab-btn ${activeTab === 'notification' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notification')}
                >
                    🔔 Notifications
                </button>
                <button
                    className={`tab-btn ${activeTab === 'automation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('automation')}
                >
                    ⚡ Automation
                </button>
            </div>

            {/* Available Integrations Grid */}
            <div className="section">
                <h2>Available Integrations</h2>
                <div className="integrations-grid">
                    {filterIntegrationsByCategory(activeTab).map(integration => {
                        const existing = getUserIntegrationByType(integration.type);
                        const connected = existing?.status === 'connected';

                        return (
                            <div
                                key={integration.type}
                                className={`integration-card ${connected ? 'connected' : ''}`}
                            >
                                <div className="integration-icon" style={{ backgroundColor: integration.color + '20' }}>
                                    <span style={{ fontSize: '2rem' }}>{integration.icon}</span>
                                </div>
                                <div className="integration-info">
                                    <h3>{integration.name}</h3>
                                    <p>{integration.description}</p>
                                    <div className="integration-features">
                                        {integration.features?.slice(0, 3).map((f, i) => (
                                            <span key={i} className="feature-tag">{f}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="integration-actions">
                                    {existing ? (
                                        <>
                                            <span
                                                className="status-badge"
                                                style={{ backgroundColor: statusColors[existing.status] }}
                                            >
                                                {existing.status}
                                            </span>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => openEditModal(existing)}
                                            >
                                                Configure
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => openAddModal(integration.type)}
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Integrations */}
            {userIntegrations.length > 0 && (
                <div className="section">
                    <h2>Active Integrations ({userIntegrations.length})</h2>
                    <div className="active-integrations-list">
                        {userIntegrations.map(integration => (
                            <div key={integration.id} className="active-integration-item">
                                <div className="integration-left">
                                    <span className="integration-icon-small">
                                        {integrationIcons[integration.type]}
                                    </span>
                                    <div className="integration-details">
                                        <strong>{integration.name}</strong>
                                        <span className="integration-meta">
                                            {integration.type.replace('_', ' ')} •
                                            Last sync: {integration.lastSyncAt
                                                ? new Date(integration.lastSyncAt).toLocaleString('id-ID')
                                                : 'Never'} •
                                            Syncs: {integration.syncCount}
                                        </span>
                                    </div>
                                </div>
                                <div className="integration-right">
                                    <span
                                        className="status-dot"
                                        style={{ backgroundColor: statusColors[integration.status] }}
                                    ></span>
                                    {integration.category === 'spreadsheet' || integration.category === 'database' ? (
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => syncIntegration(integration.id)}
                                            disabled={syncing[integration.id]}
                                        >
                                            {syncing[integration.id] ? 'Syncing...' : 'Sync'}
                                        </button>
                                    ) : null}
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={() => viewLogs(integration)}
                                    >
                                        Logs
                                    </button>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => openEditModal(integration)}
                                    >
                                        ⚙️
                                    </button>
                                    <button
                                        className={`btn btn-sm ${integration.isActive ? 'btn-warning' : 'btn-success'}`}
                                        onClick={() => toggleIntegration(integration.id, !integration.isActive)}
                                    >
                                        {integration.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => deleteIntegration(integration.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <div className={`modal-overlay ${showModal ? 'open' : ''}`} onClick={closeModal}>
                <div className="modal integration-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>
                            {selectedType?.icon} {selectedIntegration ? 'Edit' : 'Connect'} {selectedType?.name}
                        </h2>
                        <button className="modal-close" onClick={closeModal}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Integration Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="My Integration"
                            />
                        </div>

                        {renderConfigForm()}

                        {testResult && (
                            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                                {testResult.success ? '✅' : '❌'} {testResult.message}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={testConnection}
                            disabled={testing}
                        >
                            {testing ? 'Testing...' : '🔌 Test Connection'}
                        </button>
                        <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveIntegration}>
                            {selectedIntegration ? 'Update' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Modal */}
            <div className={`modal-overlay ${showLogsModal ? 'open' : ''}`} onClick={() => setShowLogsModal(false)}>
                <div className="modal logs-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>📋 Integration Logs - {selectedIntegration?.name}</h2>
                        <button className="modal-close" onClick={() => setShowLogsModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        {integrationLogs.length === 0 ? (
                            <p className="empty-message">No logs yet</p>
                        ) : (
                            <div className="logs-table-container">
                                <table className="logs-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Action</th>
                                            <th>Direction</th>
                                            <th>Status</th>
                                            <th>Records</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {integrationLogs.map(log => (
                                            <tr key={log.id}>
                                                <td>{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                                                <td>{log.action}</td>
                                                <td>
                                                    <span className={`direction-badge ${log.direction}`}>
                                                        {log.direction === 'inbound' ? '⬇️' : '⬆️'} {log.direction}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge-sm ${log.status}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td>{log.recordsCount}</td>
                                                <td>{log.duration ? `${log.duration}ms` : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
