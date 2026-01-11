import { useState, useEffect } from 'react'
import {
    Send,
    Upload,
    FileText,
    Image,
    Clock,
    CheckCircle,
    XCircle,
    Loader,
    Plus,
    X,
    Trash2,
    Eye,
    MoreVertical,
    Calendar,
    RefreshCw,
    Play,
    Pause,
    ChevronLeft,
    ChevronRight,
    Globe,
    Repeat
} from 'lucide-react'
import { broadcastService, deviceService, contactService } from '../services/api'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { id } from 'date-fns/locale'
import { API_URL } from '../utils/config'

const getStatusBadge = (status) => {
    switch (status) {
        case 'completed':
            return <span className="badge badge-success"><CheckCircle size={12} /> Completed</span>
        case 'processing':
        case 'running':
            return <span className="badge badge-info"><Loader size={12} className="animate-spin" /> Running</span>
        case 'scheduled':
            return <span className="badge badge-warning"><Clock size={12} /> Scheduled</span>
        case 'draft':
            return <span className="badge badge-neutral"><FileText size={12} /> Draft</span>
        case 'paused':
            return <span className="badge badge-info"><Pause size={12} /> Paused</span>
        case 'failed':
        case 'cancelled':
            return <span className="badge badge-error"><XCircle size={12} /> {status}</span>
        default:
            return <span className="badge badge-neutral">{status}</span>
    }
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const WEEKDAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export default function Broadcast() {
    const [activeTab, setActiveTab] = useState('new')
    const [loading, setLoading] = useState(false)
    const [campaigns, setCampaigns] = useState([])
    const [devices, setDevices] = useState([])
    const [tags, setTags] = useState([])
    const [timezones, setTimezones] = useState([])
    const [calendarEvents, setCalendarEvents] = useState([])
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [selectedBroadcast, setSelectedBroadcast] = useState(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        deviceId: '',
        message: '',
        recipients: '',
        tag: '',
        // Schedule options
        scheduleType: 'now', // now, scheduled, recurring
        scheduledAt: '',
        timezone: 'Asia/Jakarta',
        // Recurring options
        recurringType: 'daily',
        recurringDays: [],
        recurringTime: '09:00',
        maxRuns: ''
    })

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    })

    useEffect(() => {
        fetchDevices()
        fetchTags()
        fetchTimezones()
        if (activeTab === 'campaigns') {
            fetchCampaigns()
        }
        if (activeTab === 'calendar') {
            fetchCalendarEvents()
        }
    }, [activeTab, currentMonth])

    const fetchCampaigns = async () => {
        setLoading(true)
        try {
            const res = await broadcastService.list()
            setCampaigns(res.data || [])
        } catch (error) {
            console.error('Failed to fetch campaigns:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchDevices = async () => {
        try {
            const res = await deviceService.list()
            setDevices(res.data || [])
        } catch (error) {
            console.error('Failed to fetch devices:', error)
        }
    }

    const fetchTags = async () => {
        setTags(['customer', 'vip', 'lead', 'new', 'newsletter'])
    }

    const fetchTimezones = async () => {
        try {
            const res = await fetch(`${API_URL}/scheduler/timezones`, {
                headers: getAuthHeader()
            })
            const data = await res.json()
            if (data.success) {
                setTimezones(data.data)
            }
        } catch (error) {
            console.error('Failed to fetch timezones:', error)
            setTimezones([
                { value: 'Asia/Jakarta', label: 'WIB (Jakarta, GMT+7)' },
                { value: 'Asia/Makassar', label: 'WITA (Makassar, GMT+8)' },
                { value: 'Asia/Jayapura', label: 'WIT (Jayapura, GMT+9)' }
            ])
        }
    }

    const fetchCalendarEvents = async () => {
        try {
            const start = startOfMonth(currentMonth).toISOString()
            const end = endOfMonth(currentMonth).toISOString()
            const res = await fetch(`${API_URL}/scheduler/calendar?start=${start}&end=${end}`, {
                headers: getAuthHeader()
            })
            const data = await res.json()
            if (data.success) {
                setCalendarEvents(data.data)
            }
        } catch (error) {
            console.error('Failed to fetch calendar events:', error)
        }
    }

    const handleSend = async (status = 'processing') => {
        if (!formData.name || !formData.deviceId || !formData.message) {
            alert('Please fill in all required fields')
            return
        }

        let recipientsList = []
        if (formData.tag) {
            try {
                // Use server-side filtering by tag (more efficient)
                // Fetch all pages to get complete list of contacts with this tag
                let allContacts = []
                let page = 1
                let hasMore = true
                const pageSize = 500

                while (hasMore) {
                    const res = await contactService.list({
                        tag: formData.tag,
                        limit: pageSize,
                        page: page
                    })

                    const contacts = res.data || []
                    allContacts = [...allContacts, ...contacts]

                    // Check if there are more pages
                    const total = res.pagination?.total || contacts.length
                    hasMore = allContacts.length < total && contacts.length === pageSize
                    page++

                    // Safety limit to prevent infinite loop
                    if (page > 100) break
                }

                recipientsList = allContacts.map(c => c.phone)
                console.log(`[Broadcast] Found ${recipientsList.length} contacts with tag "${formData.tag}"`)
            } catch (e) {
                console.error(e)
                alert('Failed to fetch contacts by tag')
                return
            }
        } else {
            recipientsList = formData.recipients.split('\n').map(s => s.trim()).filter(Boolean)
        }

        if (recipientsList.length === 0) {
            alert('No recipients found')
            return
        }

        try {
            // Create broadcast
            const createRes = await broadcastService.create({
                name: formData.name,
                message: formData.message,
                recipients: recipientsList,
                status: formData.scheduleType === 'now' ? 'processing' : 'draft',
                deviceId: formData.deviceId
            })

            const broadcastId = createRes.data?.id

            // Handle scheduling
            if (formData.scheduleType === 'scheduled' && broadcastId) {
                await fetch(`${API_URL}/scheduler/schedule/${broadcastId}`, {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({
                        scheduledAt: formData.scheduledAt,
                        timezone: formData.timezone
                    })
                })
                alert('Broadcast scheduled successfully!')
            } else if (formData.scheduleType === 'recurring' && broadcastId) {
                await fetch(`${API_URL}/scheduler/recurring/${broadcastId}`, {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({
                        recurringType: formData.recurringType,
                        recurringDays: formData.recurringDays,
                        recurringTime: formData.recurringTime,
                        timezone: formData.timezone,
                        maxRuns: formData.maxRuns ? parseInt(formData.maxRuns) : null
                    })
                })
                alert('Recurring broadcast set up successfully!')
            } else {
                alert('Broadcast created and started!')
            }

            setFormData({
                name: '', deviceId: '', message: '', recipients: '', tag: '',
                scheduleType: 'now', scheduledAt: '', timezone: 'Asia/Jakarta',
                recurringType: 'daily', recurringDays: [], recurringTime: '09:00', maxRuns: ''
            })
            setActiveTab('campaigns')
        } catch (error) {
            console.error(error)
            alert('Failed to create campaign')
        }
    }

    const handlePause = async (id) => {
        try {
            await fetch(`${API_URL}/scheduler/pause/${id}`, {
                method: 'POST',
                headers: getAuthHeader()
            })
            fetchCampaigns()
        } catch (error) {
            console.error(error)
        }
    }

    const handleResume = async (id) => {
        try {
            await fetch(`${API_URL}/scheduler/resume/${id}`, {
                method: 'POST',
                headers: getAuthHeader()
            })
            fetchCampaigns()
        } catch (error) {
            console.error(error)
        }
    }

    const handleRunNow = async (id) => {
        try {
            await fetch(`${API_URL}/scheduler/run-now/${id}`, {
                method: 'POST',
                headers: getAuthHeader()
            })
            fetchCampaigns()
        } catch (error) {
            console.error(error)
        }
    }

    const toggleWeekday = (day) => {
        setFormData(prev => ({
            ...prev,
            recurringDays: prev.recurringDays.includes(day)
                ? prev.recurringDays.filter(d => d !== day)
                : [...prev.recurringDays, day]
        }))
    }

    // Calendar helpers
    const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    })

    const getEventsForDay = (date) => {
        return calendarEvents.filter(event =>
            isSameDay(new Date(event.start), date)
        )
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Broadcast Messages</h1>
                    <p className="page-subtitle">Send bulk messages to multiple contacts at once</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ maxWidth: '700px', marginBottom: 'var(--spacing-xl)' }}>
                <button
                    className={`tab ${activeTab === 'new' ? 'active' : ''}`}
                    onClick={() => setActiveTab('new')}
                >
                    <Send size={16} /> New Broadcast
                </button>
                <button
                    className={`tab ${activeTab === 'campaigns' ? 'active' : ''}`}
                    onClick={() => setActiveTab('campaigns')}
                >
                    <FileText size={16} /> Campaigns
                </button>
                <button
                    className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calendar')}
                >
                    <Calendar size={16} /> Calendar
                </button>
            </div>

            {/* New Broadcast Tab */}
            {activeTab === 'new' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--spacing-xl)' }}>
                    {/* Message Composer */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Compose Message</h3>
                                <p className="card-subtitle">Create your broadcast message</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Campaign Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., New Year Promo 2025"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Device</label>
                            <select
                                className="form-select"
                                value={formData.deviceId}
                                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                            >
                                <option value="">Choose a device...</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.phone || 'No #'})</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Recipients Source</label>
                            <div className="tabs" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                <button
                                    className={`tab ${!formData.tag ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, tag: '' })}
                                >Manual Input</button>
                                <button
                                    className={`tab ${formData.tag ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, tag: 'customer' })}
                                >By Tag</button>
                            </div>

                            {!formData.tag ? (
                                <>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={"Enter phone numbers (one per line)\n+62812345678\n+62856789012\n..."}
                                        value={formData.recipients}
                                        onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                                        rows={4}
                                    />
                                    <p className="form-hint">
                                        Or <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}>
                                            <Upload size={12} /> Upload CSV
                                        </button>
                                    </p>
                                </>
                            ) : (
                                <select
                                    className="form-select"
                                    value={formData.tag}
                                    onChange={e => setFormData({ ...formData, tag: e.target.value })}
                                >
                                    {tags.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea
                                className="form-textarea"
                                placeholder={"Type your message here...\n\nYou can use variables like {name}, {phone}"}
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                rows={6}
                            />
                            <p className="form-hint">Characters: {formData.message.length}/4096</p>
                        </div>

                        {/* Schedule Type */}
                        <div className="form-group">
                            <label className="form-label">When to Send</label>
                            <div className="schedule-options">
                                <label className={`schedule-option ${formData.scheduleType === 'now' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="scheduleType"
                                        value="now"
                                        checked={formData.scheduleType === 'now'}
                                        onChange={() => setFormData({ ...formData, scheduleType: 'now' })}
                                    />
                                    <Send size={18} />
                                    <span>Send Now</span>
                                </label>
                                <label className={`schedule-option ${formData.scheduleType === 'scheduled' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="scheduleType"
                                        value="scheduled"
                                        checked={formData.scheduleType === 'scheduled'}
                                        onChange={() => setFormData({ ...formData, scheduleType: 'scheduled' })}
                                    />
                                    <Clock size={18} />
                                    <span>Schedule</span>
                                </label>
                                <label className={`schedule-option ${formData.scheduleType === 'recurring' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="scheduleType"
                                        value="recurring"
                                        checked={formData.scheduleType === 'recurring'}
                                        onChange={() => setFormData({ ...formData, scheduleType: 'recurring' })}
                                    />
                                    <Repeat size={18} />
                                    <span>Recurring</span>
                                </label>
                            </div>
                        </div>

                        {/* Scheduled Options */}
                        {formData.scheduleType === 'scheduled' && (
                            <div className="schedule-details">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={formData.scheduledAt}
                                            onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            <Globe size={14} /> Timezone
                                        </label>
                                        <select
                                            className="form-select"
                                            value={formData.timezone}
                                            onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                        >
                                            {timezones.map(tz => (
                                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recurring Options */}
                        {formData.scheduleType === 'recurring' && (
                            <div className="schedule-details recurring-form">
                                <div className="form-group">
                                    <label className="form-label">Repeat Every</label>
                                    <select
                                        className="form-select"
                                        value={formData.recurringType}
                                        onChange={e => setFormData({ ...formData, recurringType: e.target.value, recurringDays: [] })}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>

                                {formData.recurringType === 'weekly' && (
                                    <div className="form-group">
                                        <label className="form-label">On Days</label>
                                        <div className="weekday-selector">
                                            {WEEKDAYS.map((day, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`weekday-btn ${formData.recurringDays.includes(idx) ? 'active' : ''}`}
                                                    onClick={() => toggleWeekday(idx)}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">At Time</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={formData.recurringTime}
                                            onChange={e => setFormData({ ...formData, recurringTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">
                                            <Globe size={14} /> Timezone
                                        </label>
                                        <select
                                            className="form-select"
                                            value={formData.timezone}
                                            onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                        >
                                            {timezones.map(tz => (
                                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Max Runs (optional)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Leave empty for unlimited"
                                        value={formData.maxRuns}
                                        onChange={e => setFormData({ ...formData, maxRuns: e.target.value })}
                                        min="1"
                                    />
                                    <p className="form-hint">Set a limit on how many times this broadcast should run</p>
                                </div>
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            gap: 'var(--spacing-md)',
                            marginTop: 'var(--spacing-lg)',
                            paddingTop: 'var(--spacing-lg)',
                            borderTop: '1px solid var(--border-color)'
                        }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => handleSend('draft')}
                            >
                                <FileText size={16} />
                                Save Draft
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 2 }}
                                onClick={() => handleSend()}
                            >
                                {formData.scheduleType === 'now' ? (
                                    <><Send size={16} /> Send Now</>
                                ) : formData.scheduleType === 'scheduled' ? (
                                    <><Clock size={16} /> Schedule</>
                                ) : (
                                    <><Repeat size={16} /> Set Recurring</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Preview Panel */}
                    <div className="card" style={{
                        background: 'var(--bg-secondary)',
                        position: 'sticky',
                        top: 'var(--spacing-xl)',
                        height: 'fit-content'
                    }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Preview</h3>
                                <p className="card-subtitle">How your message will appear</p>
                            </div>
                        </div>

                        <div style={{
                            background: 'linear-gradient(180deg, #0a2e1c 0%, #0d3320 100%)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-lg)',
                            minHeight: '300px'
                        }}>
                            <div style={{
                                background: '#005c4b',
                                color: 'white',
                                padding: 'var(--spacing-md)',
                                borderRadius: 'var(--radius-lg)',
                                borderBottomRightRadius: 'var(--spacing-xs)',
                                maxWidth: '85%',
                                marginLeft: 'auto',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap'
                            }}>
                                {formData.message || 'Your message will appear here...'}
                                <div style={{
                                    fontSize: '0.625rem',
                                    color: 'rgba(255,255,255,0.6)',
                                    textAlign: 'right',
                                    marginTop: 'var(--spacing-xs)'
                                }}>
                                    {format(new Date(), 'HH:mm')} ✓✓
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--spacing-lg)' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                marginBottom: 'var(--spacing-sm)'
                            }}>
                                <span>Recipients</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {formData.tag ? 'By Tag: ' + formData.tag : (
                                        formData.recipients.split('\n').filter(c => c.trim()).length + ' contacts'
                                    )}
                                </span>
                            </div>
                            {formData.scheduleType !== 'now' && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    <span>Schedule</span>
                                    <span style={{ fontWeight: 600, color: 'var(--primary-500)' }}>
                                        {formData.scheduleType === 'scheduled'
                                            ? (formData.scheduledAt ? format(new Date(formData.scheduledAt), 'dd MMM yyyy HH:mm') : 'Not set')
                                            : `${formData.recurringType} at ${formData.recurringTime}`
                                        }
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
                <div className="card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Campaign History</h3>
                            <p className="card-subtitle">View and manage your broadcast campaigns</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setActiveTab('new')}>
                            <Plus size={16} />
                            New Campaign
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader className="animate-spin w-8 h-8 mx-auto text-primary-500" />
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Campaign Name</th>
                                        <th>Status</th>
                                        <th>Type</th>
                                        <th>Sent / Total</th>
                                        <th>Next Run</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.length > 0 ? (
                                        campaigns.map((campaign) => (
                                            <tr key={campaign.id}>
                                                <td style={{ fontWeight: 500 }}>
                                                    {campaign.name}
                                                    {campaign.isRecurring && (
                                                        <span className="badge badge-info" style={{ marginLeft: '8px' }}>
                                                            <Repeat size={10} /> {campaign.recurringType}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{getStatusBadge(campaign.status)}</td>
                                                <td>
                                                    {campaign.isRecurring ? (
                                                        <span style={{ color: 'var(--primary-500)' }}>
                                                            Recurring ({campaign.runCount || 0} runs)
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>One-time</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{ color: 'var(--success)' }}>{campaign.sent || 0}</span>
                                                    {' / '}
                                                    {campaign.totalRecipients || 0}
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>
                                                    {campaign.nextRunAt
                                                        ? format(new Date(campaign.nextRunAt), 'dd MMM HH:mm')
                                                        : campaign.scheduledAt
                                                            ? format(new Date(campaign.scheduledAt), 'dd MMM HH:mm')
                                                            : '-'
                                                    }
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                        {campaign.status === 'scheduled' && (
                                                            <button
                                                                className="btn btn-ghost btn-icon"
                                                                onClick={() => handleRunNow(campaign.id)}
                                                                title="Run Now"
                                                            >
                                                                <Play size={14} />
                                                            </button>
                                                        )}
                                                        {campaign.status === 'scheduled' && campaign.isRecurring && (
                                                            <button
                                                                className="btn btn-ghost btn-icon"
                                                                onClick={() => handlePause(campaign.id)}
                                                                title="Pause"
                                                            >
                                                                <Pause size={14} />
                                                            </button>
                                                        )}
                                                        {campaign.status === 'paused' && (
                                                            <button
                                                                className="btn btn-ghost btn-icon"
                                                                onClick={() => handleResume(campaign.id)}
                                                                title="Resume"
                                                            >
                                                                <Play size={14} />
                                                            </button>
                                                        )}
                                                        <button className="btn btn-ghost btn-icon" title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-4 text-text-muted">No campaigns found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Calendar Tab */}
            {activeTab === 'calendar' && (
                <div className="card broadcast-calendar">
                    <div className="card-header">
                        <div className="calendar-nav">
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h3 className="calendar-month">
                                {format(currentMonth, 'MMMM yyyy', { locale: id })}
                            </h3>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <button className="btn btn-ghost" onClick={fetchCalendarEvents}>
                            <RefreshCw size={16} /> Refresh
                        </button>
                    </div>

                    <div className="calendar-grid">
                        {/* Header */}
                        {WEEKDAYS_FULL.map(day => (
                            <div key={day} className="calendar-header-cell">{day}</div>
                        ))}

                        {/* Empty cells for offset */}
                        {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} className="calendar-cell empty" />
                        ))}

                        {/* Days */}
                        {daysInMonth.map(day => {
                            const events = getEventsForDay(day)
                            const isToday = isSameDay(day, new Date())

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`calendar-cell ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-events' : ''}`}
                                >
                                    <span className="calendar-date">{format(day, 'd')}</span>
                                    <div className="calendar-events">
                                        {events.slice(0, 3).map((event, idx) => (
                                            <div
                                                key={idx}
                                                className="calendar-event"
                                                style={{ '--event-color': event.color }}
                                                title={event.title}
                                            >
                                                {event.isRecurring && <Repeat size={10} />}
                                                <span>{event.title}</span>
                                            </div>
                                        ))}
                                        {events.length > 3 && (
                                            <div className="calendar-more">+{events.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="calendar-legend">
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: '#f59e0b' }} />
                            <span>Scheduled</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: '#6366f1' }} />
                            <span>Recurring</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: '#10b981' }} />
                            <span>Completed</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
