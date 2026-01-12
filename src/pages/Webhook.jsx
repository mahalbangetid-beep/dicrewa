import { useState, useEffect } from 'react'
import {
    Webhook as WebhookIcon,
    Plus,
    Edit,
    Trash2,
    Copy,
    CheckCircle,
    XCircle,
    Eye,
    EyeOff,
    Code,
    Zap,
    X,
    AlertCircle,
    Activity,
    Loader
} from 'lucide-react'
import { webhookService } from '../services/api'
import toast from 'react-hot-toast'
import { useConfirm } from '../components/ConfirmDialog'

// Available event types
const eventTypes = [
    { value: 'message.received', label: 'Message Received', description: 'When an incoming message is received' },
    // { value: 'message.sent', label: 'Message Sent', description: 'When a message is successfully sent' },
    // { value: 'message.status', label: 'Message Status', description: 'When a message is delivered/read' },
    // { value: 'connection.update', label: 'Connection Update', description: 'When device connection status changes' },
]

export default function Webhook() {
    const confirm = useConfirm()
    const [webhooks, setWebhooks] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [showSecret, setShowSecret] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        events: ['message.received'], // Default event
        secret: ''
    })

    useEffect(() => {
        fetchWebhooks()
    }, [])

    const fetchWebhooks = async () => {
        setLoading(true)
        try {
            const res = await webhookService.list()
            setWebhooks(res.data)
        } catch (error) {
            console.error('Failed to fetch webhooks:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editingId) {
                toast.error('Update not yet implemented')
            } else {
                const created = await webhookService.create(formData)
                setWebhooks([...webhooks, created])
                toast.success('Webhook created successfully')
            }
            setShowModal(false)
            resetForm()
        } catch (error) {
            toast.error(error.formattedMessage || 'Operation failed')
        }
    }

    const deleteWebhook = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Webhook?',
            message: 'Are you sure you want to delete this webhook?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        })
        if (!isConfirmed) return
        try {
            await webhookService.delete(id)
            setWebhooks(webhooks.filter(w => w.id !== id))
            toast.success('Webhook deleted successfully')
        } catch (error) {
            toast.error('Failed to delete webhook')
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({ name: '', url: '', events: ['message.received'], secret: '' })
    }

    const handleEventToggle = (value) => {
        setFormData(prev => ({
            ...prev,
            events: prev.events.includes(value)
                ? prev.events.filter(e => e !== value)
                : [...prev.events, value]
        }))
    }

    // Helper to calculate success rate if data available
    // For now mocking stats from client side logic or 0
    const activeCount = webhooks.length // Assuming all created are active effectively or we add a status field later

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
                    <h1 className="page-title">Webhooks</h1>
                    <p className="page-subtitle">Configure webhook endpoints for real-time event notifications</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={16} />
                    Add Webhook
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon primary">
                            <WebhookIcon size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{webhooks.length}</div>
                    <div className="stat-label">Total Webhooks</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon success">
                            <Zap size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{activeCount}</div>
                    <div className="stat-label">Active</div>
                </div>
                {/* 
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon info">
                            <Activity size={24} />
                        </div>
                    </div>
                    <div className="stat-value">0</div>
                    <div className="stat-label">Total Calls</div>
                </div> 
                */}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {webhooks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-100">
                        No webhooks configured.
                    </div>
                ) : (
                    webhooks.map((webhook) => (
                        <div key={webhook.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                                        <h4 style={{ margin: 0 }}>{webhook.name || 'Unnamed Webhook'}</h4>
                                        <span className={`badge badge-success`}>
                                            <span className={`status-dot online`}></span>
                                            Active
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-sm)',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 'var(--spacing-md)',
                                        maxWidth: 'fit-content'
                                    }}>
                                        <Code size={14} style={{ color: 'var(--text-muted)' }} />
                                        <code style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--primary-400)',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            {webhook.url}
                                        </code>
                                        <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => navigator.clipboard.writeText(webhook.url)}>
                                            <Copy size={12} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
                                        {(() => {
                                            let eventsToRender = [];
                                            try {
                                                if (Array.isArray(webhook.events)) {
                                                    eventsToRender = webhook.events;
                                                } else if (typeof webhook.events === 'string') {
                                                    eventsToRender = JSON.parse(webhook.events);
                                                }
                                            } catch (e) {
                                                console.error("Failed to parse events for webhook", webhook.id);
                                            }

                                            return eventsToRender.map((event, idx) => (
                                                <span key={idx} className="badge badge-info" style={{ fontSize: '0.625rem' }}>
                                                    {event}
                                                </span>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    {/* 
                                    <button className="btn btn-ghost btn-icon">
                                        <Edit size={18} />
                                    </button>
                                     */}
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        style={{ color: 'var(--error)' }}
                                        onClick={() => deleteWebhook(webhook.id)}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Webhook Modal */}
            <div className={`modal-overlay ${showModal ? 'open' : ''}`} onClick={() => setShowModal(false)}>
                <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">Add New Webhook</h3>
                        <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Webhook Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Order Notification"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Endpoint URL</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://your-server.com/webhook"
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    required
                                />
                                <p className="form-hint">The URL that will receive webhook POST requests</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Secret Key (Optional)</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter secret key for signature verification"
                                        style={{ paddingRight: '44px' }}
                                        value={formData.secret}
                                        onChange={e => setFormData({ ...formData, secret: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-icon"
                                        style={{
                                            position: 'absolute',
                                            right: '4px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '36px',
                                            height: '36px'
                                        }}
                                        onClick={() => setShowSecret(!showSecret)}
                                    >
                                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="form-hint">Used to sign webhook payloads for security</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Events to Subscribe</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: 'var(--spacing-sm)',
                                    marginTop: 'var(--spacing-sm)'
                                }}>
                                    {eventTypes.map((event) => (
                                        <label
                                            key={event.value}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 'var(--spacing-sm)',
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                style={{ marginTop: '4px' }}
                                                checked={formData.events.includes(event.value)}
                                                onChange={() => handleEventToggle(event.value)}
                                            />
                                            <div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{event.label}</div>
                                                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{event.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
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
                                    Webhook requests include a signature header for verification. Use the secret key to validate incoming requests.
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                Create Webhook
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
