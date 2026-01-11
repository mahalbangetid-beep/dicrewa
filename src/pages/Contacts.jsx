import { useState, useEffect } from 'react'
import {
    Users,
    Plus,
    Upload,
    Download,
    Search,
    Edit,
    Trash2,
    MessageSquare,
    Tag,
    X,
    CheckCircle,
    UserPlus,
    Loader
} from 'lucide-react'
import { contactService } from '../services/api'
import { Link } from 'react-router-dom'

export default function Contacts() {
    const [contacts, setContacts] = useState([])
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
    const [stats, setStats] = useState({ total: 0, active: 0, new: 0 })
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [selectedContacts, setSelectedContacts] = useState([])

    // Form State
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', tags: [] })
    const [editingId, setEditingId] = useState(null)
    const [tagsInput, setTagsInput] = useState('')

    useEffect(() => {
        fetchContacts(1)
    }, [])

    const fetchContacts = async (page = 1) => {
        setLoading(true)
        try {
            const res = await contactService.list({ page, limit: 10, search: searchQuery })
            setContacts(res.data)
            setPagination(res.pagination)

            // Should fetch real stats here if API provided it
            // For now use pagination total
            setStats(prev => ({ ...prev, total: res.pagination.total }))
        } catch (error) {
            console.error('Failed to fetch contacts:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = {
                ...formData,
                tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(t => t.trim()) : formData.tags
            }

            if (editingId) {
                await contactService.update(editingId, data)
                alert('Contact updated')
            } else {
                await contactService.create(data)
                alert('Contact created')
            }
            setShowModal(false)
            setFormData({ name: '', phone: '', email: '', tags: [] })
            setEditingId(null)
            fetchContacts(pagination.page)
        } catch (error) {
            alert(error.formattedMessage || 'Operation failed')
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure?')) return
        try {
            await contactService.delete(id)
            fetchContacts(pagination.page)
        } catch (error) {
            alert('Failed to delete')
        }
    }

    const handleSearch = (e) => {
        e.preventDefault()
        fetchContacts(1)
    }

    const openEdit = (contact) => {
        setEditingId(contact.id)
        setFormData({
            name: contact.name,
            phone: contact.phone,
            email: contact.email || '',
            tags: contact.tags || []
        })
        setShowModal(true)
    }

    // Utils
    const toggleContact = (id) => {
        setSelectedContacts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
    }

    const toggleAll = () => {
        setSelectedContacts(selectedContacts.length === contacts.length ? [] : contacts.map(c => c.id))
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Contacts</h1>
                    <p className="page-subtitle">Manage your contact list and groups</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                    {/*  
                   <button className="btn btn-secondary">
                        <Upload size={16} />
                        Import
                    </button> 
                    */}
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null)
                        setFormData({ name: '', phone: '', email: '', tags: [] })
                        setShowModal(true)
                    }}>
                        <Plus size={16} />
                        Add Contact
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon primary">
                            <Users size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Contacts</div>
                </div>
                {/* 
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-icon success">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-value">{stats.active || 0}</div>
                    <div className="stat-label">Active</div>
                </div>
                 */}
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Search by name, phone, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '44px' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-secondary">Search</button>
                </form>
            </div>

            {/* Contacts Table */}
            <div className="card">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader className="animate-spin w-8 h-8 mx-auto text-primary-500" />
                    </div>
                ) : (
                    <>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.length === contacts.length && contacts.length > 0}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th>Contact</th>
                                        <th>Phone</th>
                                        <th>Tags</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.length > 0 ? (
                                        contacts.map((contact) => (
                                            <tr key={contact.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedContacts.includes(contact.id)}
                                                        onChange={() => toggleContact(contact.id)}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: 'var(--radius-full)',
                                                            background: 'var(--gradient-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.875rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {contact.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 500 }}>{contact.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{contact.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{contact.phone}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                                                        {contact.tags && contact.tags.map((tagName, idx) => (
                                                            <span
                                                                key={idx}
                                                                style={{
                                                                    padding: '2px 8px',
                                                                    fontSize: '0.625rem',
                                                                    fontWeight: 500,
                                                                    borderRadius: 'var(--radius-full)',
                                                                    background: '#3b82f620',
                                                                    color: '#3b82f6'
                                                                }}
                                                            >
                                                                {tagName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                        <button
                                                            className="btn btn-ghost btn-icon"
                                                            style={{ width: '32px', height: '32px' }}
                                                            onClick={() => openEdit(contact)}
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-icon"
                                                            style={{ width: '32px', height: '32px', color: 'var(--error)' }}
                                                            onClick={() => handleDelete(contact.id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-4 text-text-muted">No contacts found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-md) var(--spacing-lg)',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Showing page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)} ({pagination.total} total)
                            </span>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchContacts(pagination.page - 1)}
                                >
                                    Previous
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                                    onClick={() => fetchContacts(pagination.page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Contact Modal */}
            <div className={`modal-overlay ${showModal ? 'open' : ''}`} onClick={() => setShowModal(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3 className="modal-title">{editingId ? 'Edit Contact' : 'Add New Contact'}</h3>
                        <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter full name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input
                                type="tel"
                                className="form-input"
                                placeholder="+62 xxx xxxx xxxx"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email (Optional)</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tags (comma separated)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="customer, vip"
                                value={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(s => s.trim()) })}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {editingId ? 'Update' : 'Add'} Contact
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
