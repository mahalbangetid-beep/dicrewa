import { useState, useEffect } from 'react'
import {
    Settings as SettingsIcon,
    User,
    Bell,
    Shield,
    Key,
    Database,
    HardDrive,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Eye,
    EyeOff,
    Download,
    Trash2,
    CreditCard,
    ExternalLink,
    Brain,
    Sparkles
} from 'lucide-react'
import { settingsService } from '../services/api'
import { API_URL } from '../utils/config'

// Base sections available to all users
const baseSections = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'account', label: 'Account', icon: User },
    // { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'ai', label: 'AI Configuration', icon: Brain },
    // { id: 'storage', label: 'Storage', icon: Database },
]

// Admin-only sections
const adminSections = [
    { id: 'payment', label: 'Payment Gateway', icon: CreditCard, adminOnly: true },
]

export default function Settings() {
    const [activeSection, setActiveSection] = useState('general')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null) // { type: 'success'|'error', text: '' }

    // User Data State
    const [user, setUser] = useState({
        name: '',
        email: '',
        role: ''
    })
    const [apiKey, setApiKey] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [gaId, setGaId] = useState('')

    // Password State
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })

    // Payment Gateway State
    const [activeGateway, setActiveGateway] = useState('none')
    const [xenditConfig, setXenditConfig] = useState({
        isActive: false,
        mode: 'sandbox',
        xenditApiKey: '',
        xenditSecretKey: '',
        xenditCallbackToken: ''
    })
    const [midtransConfig, setMidtransConfig] = useState({
        isActive: false,
        mode: 'sandbox',
        midtransServerKey: '',
        midtransClientKey: ''
    })
    const [webhookUrl, setWebhookUrl] = useState('')

    // AI Configuration State
    const [embeddingApiKey, setEmbeddingApiKey] = useState('')
    const [showEmbeddingKey, setShowEmbeddingKey] = useState(false)
    const [validatingKey, setValidatingKey] = useState(false)
    const [keyValidation, setKeyValidation] = useState(null) // { valid: true/false, message: '' }

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        setLoading(true)
        try {
            const res = await settingsService.getProfile()
            setUser(res.data)
            setApiKey(res.data.apiKey || '')
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchSettings = async () => {
        try {
            const res = await settingsService.getSettings()
            setGaId(res.data.google_analytics_id || '')
        } catch (error) {
            console.error('Failed to fetch settings:', error)
        }
    }

    useEffect(() => {
        if (user.role === 'admin') {
            fetchSettings()
        }
    }, [user.role])

    const handleUpdateProfile = async () => {
        setSaving(true)
        setMessage(null)
        try {
            const res = await settingsService.updateProfile({
                name: user.name,
                email: user.email
            })
            setUser({ ...user, ...res.data }) // Update local state with response
            setMessage({ type: 'success', text: 'Profile updated successfully' })
            // Update localStorage user object as well if needed
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
            localStorage.setItem('user', JSON.stringify({ ...storedUser, name: user.name, email: user.email }))
        } catch (error) {
            setMessage({ type: 'error', text: error.formattedMessage || 'Failed to update profile' })
        } finally {
            setSaving(false)
        }
    }

    const handleSaveGA = async () => {
        setSaving(true)
        setMessage(null)
        try {
            await settingsService.updateSetting('google_analytics_id', gaId)
            setMessage({ type: 'success', text: 'Google Analytics settings updated' })
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update settings' })
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' })
            return
        }

        setSaving(true)
        setMessage(null)
        try {
            await settingsService.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            })
            setMessage({ type: 'success', text: 'Password changed successfully' })
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        } catch (error) {
            setMessage({ type: 'error', text: error.formattedMessage || 'Failed to change password' })
        } finally {
            setSaving(false)
        }
    }

    const handleGenerateApiKey = async () => {
        if (!window.confirm('Generating a new API Key will invalidate the old one. Continue?')) return;

        setSaving(true)
        try {
            const res = await settingsService.generateApiKey()
            setApiKey(res.apiKey)
            setMessage({ type: 'success', text: 'New API Key generated' })
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to generate API Key' })
        } finally {
            setSaving(false)
        }
    }

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    })

    const fetchPaymentConfig = async () => {
        try {
            // Fetch Xendit config
            const xenditRes = await fetch(`${API_URL}/billing/payment-config/xendit`, {
                headers: getAuthHeader()
            })
            const xenditData = await xenditRes.json()
            if (xenditData.success && xenditData.data) {
                setXenditConfig({
                    isActive: xenditData.data.isActive,
                    mode: xenditData.data.mode || 'sandbox',
                    xenditApiKey: xenditData.data.xenditApiKey || '',
                    xenditSecretKey: xenditData.data.xenditSecretKey || '',
                    xenditCallbackToken: xenditData.data.xenditCallbackToken || ''
                })
                if (xenditData.data.isActive) {
                    setActiveGateway('xendit')
                    setWebhookUrl(xenditData.data.webhookUrl || '')
                }
            }

            // Fetch Midtrans config
            const midtransRes = await fetch(`${API_URL}/billing/payment-config/midtrans`, {
                headers: getAuthHeader()
            })
            const midtransData = await midtransRes.json()
            if (midtransData.success && midtransData.data) {
                setMidtransConfig({
                    isActive: midtransData.data.isActive,
                    mode: midtransData.data.mode || 'sandbox',
                    midtransServerKey: midtransData.data.midtransServerKey || '',
                    midtransClientKey: midtransData.data.midtransClientKey || ''
                })
                if (midtransData.data.isActive) {
                    setActiveGateway('midtrans')
                    setWebhookUrl(midtransData.data.webhookUrl || '')
                }
            }
        } catch (error) {
            console.error('Error fetching payment config:', error)
        }
    }

    useEffect(() => {
        if (user.role === 'admin') {
            fetchPaymentConfig()
        }
    }, [user.role])

    const handleSavePaymentConfig = async (gateway) => {
        setSaving(true)
        setMessage(null)
        try {
            const config = gateway === 'xendit' ? {
                ...xenditConfig,
                isActive: activeGateway === 'xendit'
            } : {
                ...midtransConfig,
                isActive: activeGateway === 'midtrans'
            }

            const res = await fetch(`${API_URL}/billing/payment-config/${gateway}`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify(config)
            })
            const data = await res.json()

            if (data.success) {
                setWebhookUrl(data.data.webhookUrl || '')
                setMessage({ type: 'success', text: `${gateway.charAt(0).toUpperCase() + gateway.slice(1)} configuration saved` })
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            setMessage({ type: 'error', text: `Failed to save ${gateway} configuration` })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Manage your application preferences and configurations</p>
                </div>
            </div>

            {message && (
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: message.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)'
                }}>
                    {message.type === 'success' ? (
                        <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                        <AlertCircle size={20} style={{ color: 'var(--error)' }} />
                    )}
                    <span style={{ color: message.type === 'success' ? 'var(--success)' : 'var(--error)' }}>
                        {message.text}
                    </span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 'var(--spacing-xl)' }}>
                {/* Sidebar Navigation */}
                <div className="card" style={{ height: 'fit-content', padding: 'var(--spacing-sm)' }}>
                    {/* Combine base sections with admin sections if user is admin */}
                    {[...baseSections, ...(user.role === 'admin' ? adminSections : [])].map((section) => (
                        <button
                            key={section.id}
                            className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
                        >
                            <section.icon size={18} />
                            <span>{section.label}</span>
                        </button>
                    ))}
                </div>

                {/* Settings Content */}
                <div>
                    {activeSection === 'general' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">General Settings</h3>
                                    <p className="card-subtitle">Basic application configuration</p>
                                </div>
                            </div>

                            {/* Application Name - Admin Only */}
                            {user.role === 'admin' && (
                                <div className="form-group">
                                    <label className="form-label">Application Name</label>
                                    <input type="text" className="form-input" defaultValue="KeWhats Gateway" readOnly />
                                    <p className="form-hint">System defined</p>
                                </div>
                            )}

                            {/* Google Analytics - Admin Only */}
                            {user.role === 'admin' && (
                                <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
                                    <label className="form-label">Google Analytics Tag ID</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="G-XXXXXXXXXX"
                                            value={gaId}
                                            onChange={(e) => setGaId(e.target.value)}
                                        />
                                        <button className="btn btn-primary" onClick={handleSaveGA} disabled={saving}>
                                            <Save size={16} />
                                        </button>
                                    </div>
                                    <p className="form-hint">Enter your Measurement ID (starts with G-)</p>
                                </div>
                            )}

                            <div style={{
                                borderTop: user.role === 'admin' ? '1px solid var(--border-color)' : 'none',
                                paddingTop: user.role === 'admin' ? 'var(--spacing-lg)' : '0',
                                marginTop: user.role === 'admin' ? 'var(--spacing-lg)' : '0'
                            }}>
                                <div className="toggle-wrapper" style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label className="toggle">
                                        <input type="checkbox" defaultChecked />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>Dark Mode</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use dark theme throughout the application</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'account' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Account Settings</h3>
                                    <p className="card-subtitle">Manage your account information</p>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-lg)',
                                marginBottom: 'var(--spacing-xl)',
                                padding: 'var(--spacing-lg)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: 600,
                                    color: 'white'
                                }}>
                                    {user.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{user.name}</div>
                                    <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>{user.email}</div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                                        <span className="badge badge-info capitalize">{user.plan || 'Free'} Plan</span>
                                        <span className="badge badge-warning">{user.quota ? user.quota.toLocaleString() : '1,500'} Messages / mo</span>
                                        <span className="badge badge-neutral">{user.role}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={user.name}
                                    onChange={e => setUser({ ...user, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={user.email}
                                    onChange={e => setUser({ ...user, email: e.target.value })}
                                />
                            </div>

                            <div className="mt-6 pt-6 border-t border-border-color">
                                <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={saving}>
                                    {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                    Save Profile
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSection === 'security' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Security Settings</h3>
                                    <p className="card-subtitle">Manage your account security</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                                <h4 style={{ marginBottom: 'var(--spacing-md)' }}>Change Password</h4>
                                <div className="form-group">
                                    <label className="form-label">Current Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={passwordData.currentPassword}
                                        onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">New Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Confirm Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button className="btn btn-secondary" onClick={handleChangePassword} disabled={saving}>
                                    Update Password
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSection === 'api' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">API Configuration</h3>
                                    <p className="card-subtitle">Manage your API keys and access tokens</p>
                                </div>
                                <button className="btn btn-secondary" onClick={handleGenerateApiKey} disabled={saving}>
                                    <RefreshCw size={16} className={saving ? 'animate-spin' : ''} />
                                    Regenerate
                                </button>
                            </div>

                            <div className="form-group">
                                <label className="form-label">API Key</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showToken ? 'text' : 'password'}
                                        className="form-input"
                                        value={apiKey || 'No API Key generated yet'}
                                        readOnly
                                        style={{ paddingRight: '44px', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                                    />
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        style={{
                                            position: 'absolute',
                                            right: '4px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '36px',
                                            height: '36px'
                                        }}
                                        onClick={() => setShowToken(!showToken)}
                                    >
                                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="form-hint">Use this key to authenticate your API requests</p>
                            </div>

                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--warning-light)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                gap: 'var(--spacing-md)'
                            }}>
                                <AlertCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--warning)' }}>
                                    Keep your API keys secure and never share them publicly. Regenerating keys will invalidate old ones.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeSection === 'ai' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">AI Configuration</h3>
                                    <p className="card-subtitle">Configure AI features including Smart Knowledge (RAG)</p>
                                </div>
                            </div>

                            {/* User's Own API Key (BYOK) */}
                            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                                <h4 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <Sparkles size={18} style={{ color: 'var(--primary-500)' }} />
                                    OpenAI API Key (BYOK)
                                </h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)' }}>
                                    Masukkan API Key OpenAI Anda untuk menggunakan Smart Knowledge dengan kuota tak terbatas.
                                    {user.plan === 'unlimited' && (
                                        <span style={{ color: 'var(--success)', marginLeft: 'var(--spacing-xs)' }}>
                                            ✓ Plan Unlimited sudah include kuota tak terbatas
                                        </span>
                                    )}
                                </p>

                                <div className="form-group">
                                    <label className="form-label">OpenAI API Key</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                type={showEmbeddingKey ? 'text' : 'password'}
                                                className="form-input"
                                                placeholder="sk-..."
                                                value={embeddingApiKey}
                                                onChange={(e) => {
                                                    setEmbeddingApiKey(e.target.value)
                                                    setKeyValidation(null)
                                                }}
                                                style={{ paddingRight: '44px', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                                            />
                                            <button
                                                className="btn btn-ghost btn-icon"
                                                style={{
                                                    position: 'absolute',
                                                    right: '4px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: '36px',
                                                    height: '36px'
                                                }}
                                                onClick={() => setShowEmbeddingKey(!showEmbeddingKey)}
                                            >
                                                {showEmbeddingKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={async () => {
                                                if (!embeddingApiKey.trim()) return
                                                setValidatingKey(true)
                                                setKeyValidation(null)
                                                try {
                                                    const token = localStorage.getItem('token')
                                                    const res = await fetch(`${API_URL}/api/knowledge/validate-key`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`,
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify({ apiKey: embeddingApiKey })
                                                    })
                                                    const data = await res.json()
                                                    if (data.success) {
                                                        setKeyValidation({ valid: true, message: 'API Key valid!' })
                                                    } else {
                                                        setKeyValidation({ valid: false, message: data.message || 'Invalid key' })
                                                    }
                                                } catch (error) {
                                                    setKeyValidation({ valid: false, message: 'Failed to validate' })
                                                } finally {
                                                    setValidatingKey(false)
                                                }
                                            }}
                                            disabled={validatingKey || !embeddingApiKey.trim()}
                                        >
                                            {validatingKey ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                            Validate
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={async () => {
                                                setSaving(true)
                                                try {
                                                    const token = localStorage.getItem('token')
                                                    await fetch(`${API_URL}/api/settings/ai-key`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`,
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify({ embeddingApiKey })
                                                    })
                                                    setMessage({ type: 'success', text: 'API Key saved successfully' })
                                                } catch (error) {
                                                    setMessage({ type: 'error', text: 'Failed to save API key' })
                                                } finally {
                                                    setSaving(false)
                                                }
                                            }}
                                            disabled={saving}
                                        >
                                            <Save size={16} />
                                            Save
                                        </button>
                                    </div>
                                    {keyValidation && (
                                        <div style={{
                                            marginTop: 'var(--spacing-sm)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-xs)',
                                            fontSize: '0.875rem',
                                            color: keyValidation.valid ? 'var(--success)' : 'var(--error)'
                                        }}>
                                            {keyValidation.valid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                            {keyValidation.message}
                                        </div>
                                    )}
                                    <p className="form-hint">
                                        Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-500)' }}>OpenAI Dashboard</a>
                                    </p>
                                </div>
                            </div>

                            {/* Usage Info */}
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <h5 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                    <Brain size={16} />
                                    Smart Knowledge Query Limits
                                </h5>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)', fontSize: '0.875rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>Free</div>
                                        <div style={{ color: 'var(--text-muted)' }}>50/month</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>Pro</div>
                                        <div style={{ color: 'var(--text-muted)' }}>1,000/month</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>Enterprise</div>
                                        <div style={{ color: 'var(--text-muted)' }}>5,000/month</div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>Unlimited / BYOK</div>
                                        <div style={{ color: 'var(--success)' }}>Unlimited</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Gateway - Admin Only */}
                    {activeSection === 'payment' && user.role === 'admin' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Payment Gateway Configuration</h3>
                                    <p className="card-subtitle">Configure payment gateway for subscription billing</p>
                                </div>
                            </div>

                            {/* Gateway Selection */}
                            <div className="form-group">
                                <label className="form-label">Active Payment Gateway</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                    <label className={`payment-gateway-option ${activeGateway === 'none' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="gateway"
                                            value="none"
                                            checked={activeGateway === 'none'}
                                            onChange={() => setActiveGateway('none')}
                                        />
                                        <span>None (Disabled)</span>
                                    </label>
                                    <label className={`payment-gateway-option ${activeGateway === 'xendit' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="gateway"
                                            value="xendit"
                                            checked={activeGateway === 'xendit'}
                                            onChange={() => setActiveGateway('xendit')}
                                        />
                                        <span>Xendit</span>
                                    </label>
                                    <label className={`payment-gateway-option ${activeGateway === 'midtrans' ? 'active' : ''}`}>
                                        <input
                                            type="radio"
                                            name="gateway"
                                            value="midtrans"
                                            checked={activeGateway === 'midtrans'}
                                            onChange={() => setActiveGateway('midtrans')}
                                        />
                                        <span>Midtrans</span>
                                    </label>
                                </div>
                            </div>

                            {/* Xendit Configuration */}
                            {activeGateway === 'xendit' && (
                                <div className="gateway-config">
                                    <h4 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <img src="https://cdn.xendit.co/logo.svg" alt="Xendit" style={{ height: '24px' }} onError={(e) => e.target.style.display = 'none'} />
                                        Xendit Configuration
                                    </h4>

                                    <div className="form-group">
                                        <label className="form-label">Environment</label>
                                        <select
                                            className="form-select"
                                            value={xenditConfig.mode}
                                            onChange={(e) => setXenditConfig({ ...xenditConfig, mode: e.target.value })}
                                        >
                                            <option value="sandbox">Sandbox (Testing)</option>
                                            <option value="production">Production (Live)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">API Key (Secret Key)</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="xnd_development_xxx..."
                                            value={xenditConfig.xenditApiKey}
                                            onChange={(e) => setXenditConfig({ ...xenditConfig, xenditApiKey: e.target.value })}
                                        />
                                        <p className="form-hint">Get from Xendit Dashboard → Settings → API Keys</p>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Callback Verification Token</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="Your callback token"
                                            value={xenditConfig.xenditCallbackToken}
                                            onChange={(e) => setXenditConfig({ ...xenditConfig, xenditCallbackToken: e.target.value })}
                                        />
                                        <p className="form-hint">Get from Xendit Dashboard → Settings → Callbacks</p>
                                    </div>

                                    {webhookUrl && (
                                        <div className="form-group">
                                            <label className="form-label">Webhook URL (for Xendit Dashboard)</label>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={webhookUrl}
                                                    readOnly
                                                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                                                />
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <p className="form-hint">Add this URL to Xendit Dashboard → Settings → Callbacks</p>
                                        </div>
                                    )}

                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleSavePaymentConfig('xendit')}
                                        disabled={saving}
                                    >
                                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                        Save Xendit Configuration
                                    </button>
                                </div>
                            )}

                            {/* Midtrans Configuration */}
                            {activeGateway === 'midtrans' && (
                                <div className="gateway-config">
                                    <h4 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <img src="https://midtrans.com/assets/images/logo-midtrans.svg" alt="Midtrans" style={{ height: '24px' }} onError={(e) => e.target.style.display = 'none'} />
                                        Midtrans Configuration
                                    </h4>

                                    <div className="form-group">
                                        <label className="form-label">Environment</label>
                                        <select
                                            className="form-select"
                                            value={midtransConfig.mode}
                                            onChange={(e) => setMidtransConfig({ ...midtransConfig, mode: e.target.value })}
                                        >
                                            <option value="sandbox">Sandbox (Testing)</option>
                                            <option value="production">Production (Live)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Server Key</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="SB-Mid-server-xxx..."
                                            value={midtransConfig.midtransServerKey}
                                            onChange={(e) => setMidtransConfig({ ...midtransConfig, midtransServerKey: e.target.value })}
                                        />
                                        <p className="form-hint">Get from Midtrans Dashboard → Settings → Access Keys</p>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Client Key</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="SB-Mid-client-xxx..."
                                            value={midtransConfig.midtransClientKey}
                                            onChange={(e) => setMidtransConfig({ ...midtransConfig, midtransClientKey: e.target.value })}
                                        />
                                        <p className="form-hint">Get from Midtrans Dashboard → Settings → Access Keys</p>
                                    </div>

                                    {webhookUrl && (
                                        <div className="form-group">
                                            <label className="form-label">Notification URL (for Midtrans Dashboard)</label>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={webhookUrl}
                                                    readOnly
                                                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                                                />
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <p className="form-hint">Add this URL to Midtrans Dashboard → Settings → Configuration → Payment Notification URL</p>
                                        </div>
                                    )}

                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleSavePaymentConfig('midtrans')}
                                        disabled={saving}
                                    >
                                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                        Save Midtrans Configuration
                                    </button>
                                </div>
                            )}

                            {activeGateway === 'none' && (
                                <div style={{
                                    padding: 'var(--spacing-xl)',
                                    textAlign: 'center',
                                    color: 'var(--text-muted)'
                                }}>
                                    <CreditCard size={48} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
                                    <p>No payment gateway active. Select Xendit or Midtrans to enable billing.</p>
                                </div>
                            )}

                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                    <strong>Note:</strong> Only one payment gateway can be active at a time.
                                    When you activate a gateway, users can upgrade their subscription plans via the Billing page.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
