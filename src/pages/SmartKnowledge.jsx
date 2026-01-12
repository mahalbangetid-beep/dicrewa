import { useState, useEffect } from 'react'
import {
    Brain,
    Plus,
    Search,
    Edit2,
    Trash2,
    Play,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Loader2,
    X,
    ChevronDown,
    Sparkles,
    BookOpen,
    BarChart3,
    MessageSquare
} from 'lucide-react'
import { API_URL } from '../utils/config'
import toast from 'react-hot-toast'
import { useConfirm } from '../components/ConfirmDialog'

export default function SmartKnowledge() {
    const confirm = useConfirm()
    // State
    const [knowledgeBases, setKnowledgeBases] = useState([])
    const [loading, setLoading] = useState(true)
    const [usage, setUsage] = useState(null)
    const [devices, setDevices] = useState([])

    // Modal states
    const [showModal, setShowModal] = useState(false)
    const [showTestModal, setShowTestModal] = useState(false)
    const [editingKnowledge, setEditingKnowledge] = useState(null)
    const [testingKnowledge, setTestingKnowledge] = useState(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        content: '',
        deviceIds: null,
        allDevices: true
    })

    // Test query state
    const [testQuery, setTestQuery] = useState('')
    const [testResult, setTestResult] = useState(null)
    const [testLoading, setTestLoading] = useState(false)

    // Processing state
    const [processing, setProcessing] = useState({})
    const [saving, setSaving] = useState(false)

    // Fetch data
    useEffect(() => {
        fetchKnowledgeBases()
        fetchUsage()
        fetchDevices()
    }, [])

    const fetchKnowledgeBases = async () => {
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setKnowledgeBases(data.data)
            }
        } catch (error) {
            console.error('Error fetching knowledge bases:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchUsage = async () => {
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge/usage`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setUsage(data.data)
            }
        } catch (error) {
            console.error('Error fetching usage:', error)
        }
    }

    const fetchDevices = async () => {
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/devices`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setDevices(data.data)
            }
        } catch (error) {
            console.error('Error fetching devices:', error)
        }
    }

    // Create/Update knowledge base
    const handleSave = async () => {
        if (!formData.name || !formData.content) {
            toast.error('Name and content are required')
            return
        }

        if (formData.content.length < 50) {
            toast.error('Content must be at least 50 characters')
            return
        }

        setSaving(true)
        try {
            const token = localStorage.getItem('token')
            const url = editingKnowledge
                ? `${API_URL}/api/knowledge/${editingKnowledge.id}`
                : `${API_URL}/api/knowledge`

            const res = await fetch(url, {
                method: editingKnowledge ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    content: formData.content,
                    deviceIds: formData.allDevices ? null : formData.deviceIds
                })
            })

            const data = await res.json()
            if (data.success) {
                // Auto process if new or content changed
                if (!editingKnowledge || data.data.needsReprocessing) {
                    await processKnowledge(data.data.id)
                }

                setShowModal(false)
                resetForm()
                fetchKnowledgeBases()
            } else {
                toast.error(data.message || 'Failed to save')
            }
        } catch (error) {
            console.error('Error saving:', error)
            toast.error('An error occurred')
        } finally {
            setSaving(false)
        }
    }

    // Process knowledge (create embeddings)
    const processKnowledge = async (id) => {
        setProcessing(prev => ({ ...prev, [id]: true }))
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge/${id}/process`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (!data.success) {
                console.error('Processing failed:', data.message)
            }
            fetchKnowledgeBases()
        } catch (error) {
            console.error('Error processing:', error)
        } finally {
            setProcessing(prev => ({ ...prev, [id]: false }))
        }
    }

    // Delete knowledge base
    const handleDelete = async (id) => {
        const isConfirmed = await confirm({
            title: 'Delete Knowledge Base?',
            message: 'Are you sure you want to delete this knowledge base?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        })
        if (!isConfirmed) return

        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                fetchKnowledgeBases()
            }
        } catch (error) {
            console.error('Error deleting:', error)
        }
    }

    // Test RAG query
    const handleTestQuery = async () => {
        if (!testQuery.trim() || !testingKnowledge) return

        setTestLoading(true)
        setTestResult(null)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge/test-query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: testQuery,
                    knowledgeBaseId: testingKnowledge.id
                })
            })
            const data = await res.json()
            if (data.success) {
                setTestResult(data.data)
            } else {
                setTestResult({ error: data.message })
            }
        } catch (error) {
            setTestResult({ error: 'An error occurred' })
        } finally {
            setTestLoading(false)
        }
    }

    // Edit knowledge
    const handleEdit = async (kb) => {
        // Fetch full content
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_URL}/api/knowledge/${kb.id}?includeContent=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setEditingKnowledge(data.data)
                setFormData({
                    name: data.data.name,
                    description: data.data.description || '',
                    content: data.data.content,
                    deviceIds: data.data.deviceIds || [],
                    allDevices: !data.data.deviceIds
                })
                setShowModal(true)
            }
        } catch (error) {
            console.error('Error fetching knowledge:', error)
        }
    }

    // Reset form
    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            content: '',
            deviceIds: null,
            allDevices: true
        })
        setEditingKnowledge(null)
    }

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status) {
            case 'ready':
                return <CheckCircle size={16} className="text-success" />
            case 'processing':
                return <Loader2 size={16} className="text-info animate-spin" />
            case 'error':
                return <AlertCircle size={16} className="text-error" />
            default:
                return <Clock size={16} className="text-muted" />
        }
    }

    const getStatusText = (status) => {
        switch (status) {
            case 'ready': return 'Ready'
            case 'processing': return 'Processing...'
            case 'error': return 'Error'
            default: return 'Pending'
        }
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <Brain style={{ marginRight: '0.5rem', color: 'var(--primary-500)' }} />
                        Smart Knowledge
                    </h1>
                    <p className="page-subtitle">
                        Train AI with knowledge base to answer customers automatically
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        resetForm()
                        setShowModal(true)
                    }}
                >
                    <Plus size={18} />
                    Create Knowledge
                </button>
            </div>

            {/* Usage Stats */}
            {usage && (
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--spacing-md)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <BarChart3 size={20} style={{ color: 'var(--primary-500)' }} />
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                    Query Usage This Month
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Reset: {new Date(usage.resetsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                            <div style={{ width: '200px' }}>
                                <div style={{
                                    height: '8px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min(usage.percentage || 0, 100)}%`,
                                        background: usage.percentage > 80 ? 'var(--error)' : 'var(--primary-500)',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            </div>
                            <div style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                minWidth: '100px',
                                textAlign: 'right'
                            }}>
                                {usage.used} / {usage.limit === 'unlimited' ? '∞' : usage.limit}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Knowledge List */}
            {loading ? (
                <div className="card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary-500)' }} />
                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            ) : knowledgeBases.length === 0 ? (
                <div className="card" style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <BookOpen size={48} style={{ margin: '0 auto', color: 'var(--text-muted)', marginBottom: 'var(--spacing-md)' }} />
                    <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>No Knowledge Base Yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-lg)' }}>
                        Create your first knowledge base to start using AI
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            resetForm()
                            setShowModal(true)
                        }}
                    >
                        <Plus size={18} />
                        Create Knowledge Base
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {knowledgeBases.map(kb => (
                        <div key={kb.id} className="card" style={{ padding: 'var(--spacing-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                        <BookOpen size={18} style={{ color: 'var(--primary-500)' }} />
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{kb.name}</h3>
                                        {getStatusIcon(kb.status)}
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: kb.status === 'ready' ? 'var(--success)' :
                                                kb.status === 'error' ? 'var(--error)' : 'var(--text-muted)'
                                        }}>
                                            {getStatusText(kb.status)}
                                        </span>
                                    </div>
                                    {kb.description && (
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                                            {kb.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span>{kb.chunkCount} chunks</span>
                                        <span>•</span>
                                        <span>
                                            {kb.deviceIds ? `${kb.deviceIds.length} devices` : 'All devices'}
                                        </span>
                                        {kb.errorMessage && (
                                            <>
                                                <span>•</span>
                                                <span style={{ color: 'var(--error)' }}>{kb.errorMessage}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    {kb.status === 'ready' && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => {
                                                setTestingKnowledge(kb)
                                                setTestQuery('')
                                                setTestResult(null)
                                                setShowTestModal(true)
                                            }}
                                            title="Test Query"
                                        >
                                            <Play size={16} />
                                            Test
                                        </button>
                                    )}
                                    {(kb.status === 'pending' || kb.status === 'error') && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => processKnowledge(kb.id)}
                                            disabled={processing[kb.id]}
                                            title="Process"
                                        >
                                            {processing[kb.id] ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <RefreshCw size={16} />
                                            )}
                                            Process
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleEdit(kb)}
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleDelete(kb.id)}
                                        title="Delete"
                                        style={{ color: 'var(--error)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingKnowledge ? 'Edit Knowledge Base' : 'Create Knowledge Base'}
                            </h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Knowledge Name *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g.: Product FAQ"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Brief description about this knowledge base"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Knowledge Content *</label>
                                <textarea
                                    className="form-input"
                                    rows={12}
                                    placeholder={`Enter your knowledge base content here.

Example FAQ format:
Q: What is the price of the basic plan?
A: The basic plan costs $2/month with a quota of 1000 messages.

Q: How do I upgrade my plan?
A: You can upgrade via the Billing > Subscription menu.

Tip: Separate each topic with a blank line for best results.`}
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--spacing-xs)' }}>
                                    {formData.content.length} characters • Minimum 50 characters
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assign to Device</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.allDevices}
                                            onChange={e => setFormData({
                                                ...formData,
                                                allDevices: e.target.checked,
                                                deviceIds: e.target.checked ? null : []
                                            })}
                                        />
                                        <span>All Devices</span>
                                    </label>
                                    {!formData.allDevices && devices.map(device => (
                                        <label key={device.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', paddingLeft: 'var(--spacing-lg)' }}>
                                            <input
                                                type="checkbox"
                                                checked={(formData.deviceIds || []).includes(device.id)}
                                                onChange={e => {
                                                    const ids = formData.deviceIds || []
                                                    if (e.target.checked) {
                                                        setFormData({ ...formData, deviceIds: [...ids, device.id] })
                                                    } else {
                                                        setFormData({ ...formData, deviceIds: ids.filter(id => id !== device.id) })
                                                    }
                                                }}
                                            />
                                            <span>{device.name} {device.phone && `(${device.phone})`}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        Save & Process
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Query Modal */}
            {showTestModal && testingKnowledge && (
                <div className="modal-overlay open" onClick={() => setShowTestModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <Play size={20} style={{ marginRight: '0.5rem', color: 'var(--primary-500)' }} />
                                Test: {testingKnowledge.name}
                            </h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowTestModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Question</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Type a question for testing..."
                                        value={testQuery}
                                        onChange={e => setTestQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleTestQuery()}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleTestQuery}
                                        disabled={testLoading || !testQuery.trim()}
                                    >
                                        {testLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Search size={16} />
                                        )}
                                        Test
                                    </button>
                                </div>
                            </div>

                            {testResult && (
                                <>
                                    {testResult.error ? (
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'rgba(var(--error-rgb), 0.1)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--error)'
                                        }}>
                                            {testResult.error}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Chunks Found */}
                                            <div className="form-group">
                                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                    <MessageSquare size={14} />
                                                    Chunks Found ({testResult.chunks?.length || 0})
                                                </label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                                    {testResult.chunks?.map((chunk, idx) => (
                                                        <div key={idx} style={{
                                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                                            background: 'var(--bg-tertiary)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontSize: '0.8rem'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                                                                <span style={{ fontWeight: 500 }}>#{idx + 1}</span>
                                                                <span className="badge badge-success">{chunk.similarity}% match</span>
                                                            </div>
                                                            <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                                                {chunk.content.length > 200 ? chunk.content.slice(0, 200) + '...' : chunk.content}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* AI Answer */}
                                            <div className="form-group">
                                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                    <Sparkles size={14} style={{ color: 'var(--primary-500)' }} />
                                                    AI Answer (Confidence: {testResult.confidence}%)
                                                </label>
                                                <div style={{
                                                    padding: 'var(--spacing-md)',
                                                    background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(var(--primary-rgb), 0.05))',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid rgba(var(--primary-rgb), 0.2)',
                                                    whiteSpace: 'pre-wrap'
                                                }}>
                                                    {testResult.answer}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowTestModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
