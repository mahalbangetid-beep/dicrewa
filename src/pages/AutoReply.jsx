import { useState, useEffect } from 'react'
import {
    Bot,
    Plus,
    Edit,
    Trash2,
    ToggleLeft,
    ToggleRight,
    MessageSquare,
    Zap,
    Clock,
    Search,
    X,
    ArrowRight,
    AlertCircle,
    Loader,
    Database,
    Save,
    RefreshCw,
    Brain
} from 'lucide-react'
import { autoReplyService, deviceService } from '../services/api'
import api from '../services/api'

export default function AutoReply() {
    const [rules, setRules] = useState([])
    const [devices, setDevices] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        trigger: '',
        triggerType: 'contains', // exact, contains, startswith, regex
        response: '',
        priority: 0,
        deviceId: null,
        mediaType: 'text',
        isGlobal: false
    })

    const [spreadsheetConfig, setSpreadsheetConfig] = useState({
        deviceId: '',
        url: ''
    })
    const [savingSpreadsheet, setSavingSpreadsheet] = useState(false)

    // RAG Fallback State
    const [knowledgeBases, setKnowledgeBases] = useState([])
    const [ragConfig, setRagConfig] = useState({
        enabled: false,
        knowledgeBaseId: '',
        fallbackMessage: ''
    })
    const [savingRag, setSavingRag] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [rulesRes, devicesRes, kbRes] = await Promise.all([
                autoReplyService.list(),
                deviceService.list(),
                api.get('/knowledge').catch(() => ({ data: { data: [] } }))
            ])
            setRules(rulesRes.data)
            setDevices(devicesRes.data)
            // Only show ready knowledge bases
            setKnowledgeBases((kbRes.data.data || []).filter(kb => kb.status === 'ready'))

            // Find if there's a RAG fallback rule
            const ragRule = rulesRes.data?.find(r => r.useRagFallback)
            if (ragRule) {
                setRagConfig({
                    enabled: true,
                    knowledgeBaseId: ragRule.knowledgeBaseId || '',
                    fallbackMessage: ragRule.ragFallbackMessage || ''
                })
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleRule = async (id) => {
        try {
            const updatedRes = await autoReplyService.toggle(id)
            const updatedRule = updatedRes.data || updatedRes;
            setRules(rules.map(rule => rule.id === id ? updatedRule : rule))
        } catch (error) {
            console.error('Failed to toggle rule:', error)
            alert('Failed to toggle rule')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            // Process form data
            const payload = {
                ...formData,
                priority: parseInt(formData.priority),
                deviceId: formData.deviceId === 'global' ? null : formData.deviceId
            }

            if (editingId) {
                const updatedRes = await autoReplyService.update(editingId, payload)
                // Unwrap data from response
                const updatedRule = updatedRes.data || updatedRes;
                setRules(rules.map(r => r.id === editingId ? updatedRule : r))
            } else {
                const createdRes = await autoReplyService.create(payload)
                // Unwrap data from response
                const createdRule = createdRes.data || createdRes;
                setRules([...rules, createdRule])
            }
            setShowModal(false)
            resetForm()
        } catch (error) {
            alert(error.formattedMessage || 'Operation failed')
        }
    }

    const deleteRule = async (id) => {
        if (!window.confirm('Are you sure you want to delete this rule?')) return
        try {
            await autoReplyService.delete(id)
            setRules(rules.filter(r => r.id !== id))
        } catch (error) {
            alert('Failed to delete rule')
        }
    }

    const openEditModal = (rule) => {
        setEditingId(rule.id)
        setFormData({
            name: rule.name,
            trigger: rule.trigger,
            triggerType: rule.triggerType,
            response: rule.response,
            priority: rule.priority,
            deviceId: rule.deviceId || 'global',
            mediaType: rule.mediaType,
            isGlobal: !rule.deviceId
        })
        setShowModal(true)
    }

    const openNewModal = () => {
        resetForm()
        setShowModal(true)
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({
            name: '',
            trigger: '',
            triggerType: 'contains',
            response: '',
            priority: 0,
            deviceId: 'global',
            mediaType: 'text',
            isGlobal: true
        })
    }

    const handleSaveSpreadsheet = async () => {
        if (!spreadsheetConfig.deviceId) return
        setSavingSpreadsheet(true)
        try {
            await deviceService.update(spreadsheetConfig.deviceId, {
                spreadsheetUrl: spreadsheetConfig.url
            })
            // Update local devices state
            setDevices(prev => prev.map(d =>
                d.id === spreadsheetConfig.deviceId ? { ...d, spreadsheetUrl: spreadsheetConfig.url } : d
            ))
            alert('Spreadsheet settings updated and synced.')
        } catch (error) {
            alert('Failed to update spreadsheet: ' + (error.formattedMessage || error.message))
        } finally {
            setSavingSpreadsheet(false)
        }
    }

    const handleSaveRagConfig = async () => {
        setSavingRag(true)
        try {
            // Find existing RAG fallback rule or create new one
            const existingRagRule = rules.find(r => r.useRagFallback)

            if (ragConfig.enabled && ragConfig.knowledgeBaseId) {
                const ragPayload = {
                    name: 'RAG Fallback',
                    trigger: '*', // Match anything (used as fallback)
                    triggerType: 'contains',
                    response: 'Powered by Smart Knowledge',
                    priority: -999, // Lowest priority so it runs last
                    deviceId: null, // Apply to all devices
                    useRagFallback: true,
                    knowledgeBaseId: ragConfig.knowledgeBaseId,
                    ragFallbackMessage: ragConfig.fallbackMessage || null
                }

                if (existingRagRule) {
                    await autoReplyService.update(existingRagRule.id, ragPayload)
                } else {
                    await autoReplyService.create(ragPayload)
                }
                alert('Smart Knowledge fallback enabled!')
            } else if (existingRagRule) {
                // Disable RAG - delete the rule
                await autoReplyService.delete(existingRagRule.id)
                alert('Smart Knowledge fallback disabled.')
            }

            fetchData() // Refresh data
        } catch (error) {
            alert('Failed to save RAG config: ' + (error.formattedMessage || error.message))
        } finally {
            setSavingRag(false)
        }
    }

    const filteredRules = rules.filter(rule =>
    (rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.trigger.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => b.priority - a.priority) // Sort by priority desc

    const activeCount = rules.filter(r => r.isActive).length

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader className="animate-spin w-8 h-8 text-primary-500" />
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Auto Reply Bot</h1>
                    <p className="page-subtitle">Configure automatic responses for incoming messages</p>
                </div>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={16} />
                    Add Rule
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon primary">
                            <Bot size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{rules.length}</div>
                    <div className="stat-label">Total Rules</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon success">
                            <Zap size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{activeCount}</div>
                    <div className="stat-label">Active Rules</div>
                </div>
                {/* 
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon info">
                            <MessageSquare size={24} />
                        </div>
                    </div>
                    <div className="stat-value">
                        {rules.reduce((sum, r) => sum + (r.triggerCount||0), 0).toLocaleString()}
                    </div>
                    <div className="stat-label">Total Triggers</div>
                </div>
                 */}
            </div>

            {/* Search Section */}
            <div className="card mb-10">
                <div className="relative">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                        type="text"
                        className="form-input w-full pl-12 py-3 bg-bg-tertiary/50"
                        placeholder="Search rules by name or keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>


            {/* Spreadsheet Sync Section */}
            <div className="card" style={{
                marginTop: 'var(--spacing-2xl)',
                marginBottom: 'var(--spacing-2xl)',
                padding: 'var(--spacing-xl)',
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.05) 0%, rgba(37, 211, 102, 0.02) 100%)',
                borderColor: 'rgba(37, 211, 102, 0.2)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                    {/* Header */}
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, marginBottom: 'var(--spacing-sm)' }}>Google Sheet Sync</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                            Connect your cloud spreadsheets to manage rules at scale with real-time updates. This allows your team to collaborate on auto-reply logic directly within Google Sheets without dashboard access.
                        </p>
                    </div>

                    {/* Inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {/* Target Account */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Target Account</label>
                            <select
                                className="form-select"
                                value={spreadsheetConfig.deviceId}
                                onChange={(e) => {
                                    const devId = e.target.value;
                                    const dev = devices.find(d => d.id === devId);
                                    setSpreadsheetConfig({
                                        deviceId: devId,
                                        url: dev?.spreadsheetUrl || ''
                                    });
                                }}
                            >
                                <option value="">Select Device...</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* CSV Endpoint */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">CSV Source Endpoint</label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ flex: '1', minWidth: '300px' }}
                                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                                    value={spreadsheetConfig.url}
                                    onChange={(e) => setSpreadsheetConfig({ ...spreadsheetConfig, url: e.target.value })}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveSpreadsheet}
                                    disabled={savingSpreadsheet || !spreadsheetConfig.deviceId}
                                >
                                    {savingSpreadsheet ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                    Connect
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info Footer */}
                    <div style={{
                        paddingTop: 'var(--spacing-md)',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary-500)' }}>Auto-Sync Enabled</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            System will automatically refresh rules from the cloud endpoint every 5 minutes.
                        </span>
                    </div>
                </div>
            </div>

            {/* Smart Knowledge RAG Fallback Section */}
            <div className="card" style={{
                marginTop: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-2xl)',
                padding: 'var(--spacing-xl)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
                borderColor: 'rgba(139, 92, 246, 0.3)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                margin: 0,
                                marginBottom: 'var(--spacing-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)'
                            }}>
                                <Brain size={24} style={{ color: 'var(--primary-500)' }} />
                                Smart Knowledge Fallback
                            </h2>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                When no auto-reply rule matches, use AI to generate intelligent responses from your knowledge base.
                            </p>
                        </div>
                        <label className="toggle" style={{ marginTop: '4px' }}>
                            <input
                                type="checkbox"
                                checked={ragConfig.enabled}
                                onChange={(e) => setRagConfig({ ...ragConfig, enabled: e.target.checked })}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {ragConfig.enabled && (
                        <>
                            {/* Config Inputs */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Knowledge Base</label>
                                    <select
                                        className="form-select"
                                        value={ragConfig.knowledgeBaseId}
                                        onChange={(e) => setRagConfig({ ...ragConfig, knowledgeBaseId: e.target.value })}
                                    >
                                        <option value="">Select Knowledge Base...</option>
                                        {knowledgeBases.map(kb => (
                                            <option key={kb.id} value={kb.id}>
                                                {kb.name} ({kb.chunkCount} chunks)
                                            </option>
                                        ))}
                                    </select>
                                    {knowledgeBases.length === 0 && (
                                        <p className="form-hint" style={{ color: 'var(--warning)' }}>
                                            No knowledge bases available. Create one in the Smart Knowledge page first.
                                        </p>
                                    )}
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Fallback Message (when AI can't answer)</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        placeholder="Sorry, I couldn't find an answer to your question. Please contact our support team for help."
                                        value={ragConfig.fallbackMessage}
                                        onChange={(e) => setRagConfig({ ...ragConfig, fallbackMessage: e.target.value })}
                                    />
                                    <p className="form-hint">
                                        This message is sent when the AI cannot find a relevant answer from the knowledge base.
                                    </p>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveRagConfig}
                                    disabled={savingRag || !ragConfig.knowledgeBaseId}
                                >
                                    {savingRag ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                                    Save RAG Settings
                                </button>
                            </div>
                        </>
                    )}

                    {!ragConfig.enabled && (
                        <div style={{
                            padding: 'var(--spacing-lg)',
                            background: 'rgba(139, 92, 246, 0.05)',
                            borderRadius: 'var(--radius-md)',
                            textAlign: 'center'
                        }}>
                            <Brain size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }} />
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                Enable Smart Knowledge fallback to let AI answer questions when no rule matches.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Section Header for Rules */}
            <div style={{
                marginBottom: 'var(--spacing-lg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Auto Reply Rules</h3>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {filteredRules.length} rules found
                </span>
            </div>

            {/* Rules List Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {filteredRules.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-100">
                        No auto-reply rules found. Create one to get started!
                    </div>
                ) : (
                    filteredRules.map((rule) => {
                        const deviceName = rule.deviceId
                            ? devices.find(d => d.id === rule.deviceId)?.name || 'Unknown Device'
                            : 'All Devices';

                        return (
                            <div key={rule.id} className={`card ${!rule.isActive ? 'opacity-60' : ''}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                                            <h4 style={{ margin: 0 }}>{rule.name}</h4>
                                            <span className={`badge ${rule.isActive ? 'badge-success' : 'badge-neutral'}`}>
                                                {rule.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                            <span className="badge badge-info">{deviceName}</span>
                                            <span className="badge badge-warning">Priority: {rule.priority}</span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-md)',
                                            marginBottom: 'var(--spacing-md)'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-sm)',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: '0.75rem'
                                            }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Trigger:</span>
                                                <code style={{
                                                    color: 'var(--primary-400)',
                                                    fontFamily: 'var(--font-mono)'
                                                }}>
                                                    {rule.trigger}
                                                </code>
                                                <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>
                                                    {rule.triggerType}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: '3px solid var(--primary-500)'
                                        }}>
                                            <p style={{
                                                margin: 0,
                                                fontSize: '0.875rem',
                                                color: 'var(--text-secondary)',
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {rule.response}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-lg)' }}>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={() => toggleRule(rule.id)}
                                            style={{ color: rule.isActive ? 'var(--success)' : 'var(--text-muted)' }}
                                            title="Toggle Active Status"
                                        >
                                            {rule.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            onClick={() => openEditModal(rule)}
                                            title="Edit Rule"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            style={{ color: 'var(--error)' }}
                                            onClick={() => deleteRule(rule.id)}
                                            title="Delete Rule"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )
                }
            </div >

            {/* Add/Edit Modal */}
            < div className={`modal-overlay ${showModal ? 'open' : ''}`} onClick={() => setShowModal(false)}>
                <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">{editingId ? 'Edit Rule' : 'Add New Rule'}</h3>
                        <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Rule Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Greeting Response"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Trigger Type</label>
                                    <select
                                        className="form-select"
                                        value={formData.triggerType}
                                        onChange={e => setFormData({ ...formData, triggerType: e.target.value })}
                                    >
                                        <option value="exact">Exact Match</option>
                                        <option value="contains">Contains</option>
                                        <option value="startswith">Starts With</option>
                                        <option value="regex">Regex Pattern</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Apply to Device</label>
                                    <select
                                        className="form-select"
                                        value={formData.deviceId || 'global'}
                                        onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                                    >
                                        <option value="global">All Devices</option>
                                        {devices.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Priority (Higher runs first)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Trigger Keywords</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., hello, hi, halo (comma separated)"
                                    value={formData.trigger}
                                    onChange={e => setFormData({ ...formData, trigger: e.target.value })}
                                    required
                                />
                                <p className="form-hint">Separate multiple keywords with commas if using 'contains'</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Response Message</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Type your automatic response here..."
                                    rows={6}
                                    value={formData.response}
                                    onChange={e => setFormData({ ...formData, response: e.target.value })}
                                    required
                                />
                                <p className="form-hint">
                                    Variables: {'{name}'}, {'{phone}'}, {'{date}'}
                                </p>
                            </div>

                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'var(--info-light)',
                                borderRadius: 'var(--radius-md)',
                                display: 'flex',
                                gap: 'var(--spacing-md)'
                            }}>
                                <AlertCircle size={20} style={{ color: 'var(--info)', flexShrink: 0 }} />
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.75rem',
                                    color: 'var(--info)'
                                }}>
                                    Rules are processed in order of priority (Highest first).
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {editingId ? 'Save Changes' : 'Create Rule'}
                            </button>
                        </div>
                    </form>
                </div>
            </div >
        </div >
    )
}
