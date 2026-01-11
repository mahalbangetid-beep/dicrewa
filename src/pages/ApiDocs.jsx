import { useState } from 'react'
import {
    FileCode2,
    Copy,
    Check,
    ChevronRight,
    ChevronDown,
    Send,
    MessageSquare,
    Smartphone,
    Users,
    Webhook,
    Globe,
    Play,
    Bot,
    Calendar,
    BarChart3,
    Settings,
    Shield,
    CreditCard,
    UserPlus,
    Mail,
    Zap,
    Database,
    Key
} from 'lucide-react'

const endpoints = [
    {
        category: 'Authentication',
        icon: Key,
        items: [
            { method: 'POST', path: '/api/auth/register', description: 'Register new user account' },
            { method: 'POST', path: '/api/auth/login', description: 'Login and get access token' },
            { method: 'GET', path: '/api/auth/profile', description: 'Get current user profile' },
            { method: 'PUT', path: '/api/auth/profile', description: 'Update user profile' },
            { method: 'POST', path: '/api/auth/change-password', description: 'Change user password' },
        ]
    },
    {
        category: 'Messages',
        icon: MessageSquare,
        items: [
            { method: 'GET', path: '/api/messages', description: 'List all messages with pagination' },
            { method: 'GET', path: '/api/messages/:id', description: 'Get message details by ID' },
            { method: 'POST', path: '/api/messages/send', description: 'Send a text message' },
            { method: 'POST', path: '/api/messages/send-media', description: 'Send media (image, video, document)' },
            { method: 'POST', path: '/api/messages/send-list', description: 'Send interactive list message' },
            { method: 'POST', path: '/api/messages/send-buttons', description: 'Send button message' },
        ]
    },
    {
        category: 'Devices',
        icon: Smartphone,
        items: [
            { method: 'GET', path: '/api/devices', description: 'List all connected devices' },
            { method: 'GET', path: '/api/devices/:id', description: 'Get device details' },
            { method: 'POST', path: '/api/devices', description: 'Add new device (returns QR code)' },
            { method: 'PUT', path: '/api/devices/:id', description: 'Update device settings' },
            { method: 'DELETE', path: '/api/devices/:id', description: 'Disconnect and remove device' },
            { method: 'POST', path: '/api/devices/:id/restart', description: 'Restart device session' },
            { method: 'GET', path: '/api/devices/:id/qr', description: 'Get latest QR code' },
        ]
    },
    {
        category: 'Contacts',
        icon: Users,
        items: [
            { method: 'GET', path: '/api/contacts', description: 'List contacts with search & filter by tag (?tag=customer)' },
            { method: 'GET', path: '/api/contacts/:id', description: 'Get contact details' },
            { method: 'POST', path: '/api/contacts', description: 'Create new contact' },
            { method: 'PUT', path: '/api/contacts/:id', description: 'Update contact' },
            { method: 'DELETE', path: '/api/contacts/:id', description: 'Delete contact' },
            { method: 'POST', path: '/api/contacts/import', description: 'Bulk import contacts' },
        ]
    },
    {
        category: 'Groups',
        icon: Users,
        items: [
            { method: 'GET', path: '/api/groups', description: 'List all synced groups' },
            { method: 'GET', path: '/api/groups/device/:deviceId', description: 'Get groups for device' },
            { method: 'GET', path: '/api/groups/stats/:deviceId', description: 'Get group statistics' },
            { method: 'GET', path: '/api/groups/:groupId', description: 'Get group details' },
            { method: 'POST', path: '/api/groups/sync/:deviceId', description: 'Sync groups from WhatsApp' },
            { method: 'POST', path: '/api/groups/:groupId/sync-members', description: 'Sync group members' },
            { method: 'GET', path: '/api/groups/:groupId/members', description: 'Get group members' },
            { method: 'PUT', path: '/api/groups/:groupId', description: 'Update group settings' },
            { method: 'DELETE', path: '/api/groups/:groupId', description: 'Remove group from database' },
            { method: 'POST', path: '/api/groups/:groupId/send', description: 'Send message to group' },
        ]
    },
    {
        category: 'Broadcast',
        icon: Send,
        items: [
            { method: 'GET', path: '/api/broadcast', description: 'List broadcast campaigns' },
            { method: 'GET', path: '/api/broadcast/:id', description: 'Get campaign details' },
            { method: 'POST', path: '/api/broadcast', description: 'Create new broadcast campaign' },
            { method: 'POST', path: '/api/broadcast/:id/cancel', description: 'Cancel a campaign' },
            { method: 'GET', path: '/api/broadcast/:id/recipients', description: 'Get campaign recipients' },
        ]
    },
    {
        category: 'Auto Reply',
        icon: Zap,
        items: [
            { method: 'GET', path: '/api/auto-reply', description: 'List all auto-reply rules' },
            { method: 'GET', path: '/api/auto-reply/:id', description: 'Get rule details' },
            { method: 'POST', path: '/api/auto-reply', description: 'Create auto-reply rule' },
            { method: 'PUT', path: '/api/auto-reply/:id', description: 'Update rule' },
            { method: 'DELETE', path: '/api/auto-reply/:id', description: 'Delete rule' },
            { method: 'POST', path: '/api/auto-reply/:id/toggle', description: 'Toggle rule active status' },
        ]
    },
    {
        category: 'Chatbots',
        icon: Bot,
        items: [
            { method: 'GET', path: '/api/chatbots', description: 'List all chatbot flows' },
            { method: 'GET', path: '/api/chatbots/:id', description: 'Get chatbot details' },
            { method: 'POST', path: '/api/chatbots', description: 'Create new chatbot' },
            { method: 'PUT', path: '/api/chatbots/:id', description: 'Update chatbot flow' },
            { method: 'DELETE', path: '/api/chatbots/:id', description: 'Delete chatbot' },
            { method: 'POST', path: '/api/chatbots/:id/activate', description: 'Activate/deactivate chatbot' },
            { method: 'POST', path: '/api/chatbots/:id/duplicate', description: 'Duplicate chatbot' },
        ]
    },
    {
        category: 'Templates',
        icon: FileCode2,
        items: [
            { method: 'GET', path: '/api/templates', description: 'List message templates' },
            { method: 'GET', path: '/api/templates/:id', description: 'Get template details' },
            { method: 'POST', path: '/api/templates', description: 'Create new template' },
            { method: 'PUT', path: '/api/templates/:id', description: 'Update template' },
            { method: 'DELETE', path: '/api/templates/:id', description: 'Delete template' },
        ]
    },
    {
        category: 'Inbox',
        icon: Mail,
        items: [
            { method: 'GET', path: '/api/inbox/conversations', description: 'List conversations' },
            { method: 'GET', path: '/api/inbox/conversations/:id/messages', description: 'Get conversation messages' },
            { method: 'POST', path: '/api/inbox/conversations/:id/send', description: 'Send message in conversation' },
            { method: 'POST', path: '/api/inbox/conversations/:id/read', description: 'Mark as read' },
            { method: 'POST', path: '/api/inbox/conversations/:id/pin', description: 'Toggle pin' },
            { method: 'POST', path: '/api/inbox/conversations/:id/archive', description: 'Toggle archive' },
            { method: 'GET', path: '/api/inbox/unread-count', description: 'Get unread count' },
            { method: 'GET', path: '/api/inbox/quick-replies', description: 'List quick replies' },
            { method: 'POST', path: '/api/inbox/quick-replies', description: 'Create quick reply' },
        ]
    },
    {
        category: 'Scheduler',
        icon: Calendar,
        items: [
            { method: 'GET', path: '/api/scheduler', description: 'List scheduled messages' },
            { method: 'GET', path: '/api/scheduler/:id', description: 'Get schedule details' },
            { method: 'POST', path: '/api/scheduler', description: 'Create scheduled message' },
            { method: 'PUT', path: '/api/scheduler/:id', description: 'Update schedule' },
            { method: 'DELETE', path: '/api/scheduler/:id', description: 'Delete schedule' },
        ]
    },
    {
        category: 'Analytics',
        icon: BarChart3,
        items: [
            { method: 'GET', path: '/api/analytics/overview', description: 'Get analytics overview' },
            { method: 'GET', path: '/api/analytics/messages', description: 'Message statistics' },
            { method: 'GET', path: '/api/analytics/devices', description: 'Device statistics' },
        ]
    },
    {
        category: 'Webhooks',
        icon: Webhook,
        items: [
            { method: 'GET', path: '/api/webhooks', description: 'List all webhooks' },
            { method: 'GET', path: '/api/webhooks/:id', description: 'Get webhook details' },
            { method: 'POST', path: '/api/webhooks', description: 'Create new webhook' },
            { method: 'PUT', path: '/api/webhooks/:id', description: 'Update webhook' },
            { method: 'DELETE', path: '/api/webhooks/:id', description: 'Delete webhook' },
            { method: 'POST', path: '/api/webhooks/:id/test', description: 'Test webhook endpoint' },
            { method: 'GET', path: '/api/webhooks/meta/events', description: 'Get available events' },
        ]
    },
    {
        category: 'Integrations',
        icon: Database,
        items: [
            { method: 'GET', path: '/api/integrations/available', description: 'List available integrations' },
            { method: 'GET', path: '/api/integrations', description: 'List configured integrations' },
            { method: 'POST', path: '/api/integrations', description: 'Create integration' },
            { method: 'PUT', path: '/api/integrations/:id', description: 'Update integration' },
            { method: 'DELETE', path: '/api/integrations/:id', description: 'Delete integration' },
            { method: 'POST', path: '/api/integrations/:id/toggle', description: 'Toggle active status' },
            { method: 'POST', path: '/api/integrations/:id/sync', description: 'Trigger sync' },
            { method: 'POST', path: '/api/integrations/test-config', description: 'Test configuration' },
        ]
    },
    {
        category: 'AI',
        icon: Bot,
        items: [
            { method: 'GET', path: '/api/ai/config', description: 'Get AI configuration' },
            { method: 'POST', path: '/api/ai/chat', description: 'AI chat completion' },
            { method: 'POST', path: '/api/ai/analyze-sentiment', description: 'Analyze message sentiment' },
            { method: 'POST', path: '/api/ai/generate-reply', description: 'Generate smart reply' },
            { method: 'POST', path: '/api/ai/compose', description: 'AI compose message' },
        ]
    },
    {
        category: 'Team',
        icon: UserPlus,
        items: [
            { method: 'GET', path: '/api/team', description: 'List team members' },
            { method: 'GET', path: '/api/team/:id', description: 'Get member details' },
            { method: 'POST', path: '/api/team/invite', description: 'Invite team member' },
            { method: 'PUT', path: '/api/team/:id', description: 'Update member role' },
            { method: 'DELETE', path: '/api/team/:id', description: 'Remove member' },
            { method: 'POST', path: '/api/team/accept-invite', description: 'Accept invitation' },
        ]
    },
    {
        category: 'Billing',
        icon: CreditCard,
        items: [
            { method: 'GET', path: '/api/billing/plans', description: 'List available plans' },
            { method: 'GET', path: '/api/billing/subscription', description: 'Get current subscription' },
            { method: 'POST', path: '/api/billing/subscribe', description: 'Subscribe to plan' },
            { method: 'POST', path: '/api/billing/cancel', description: 'Cancel subscription' },
            { method: 'GET', path: '/api/billing/invoices', description: 'List invoices' },
        ]
    },
    {
        category: 'Settings',
        icon: Settings,
        items: [
            { method: 'GET', path: '/api/settings', description: 'Get user settings' },
            { method: 'PUT', path: '/api/settings', description: 'Update settings' },
            { method: 'GET', path: '/api/settings/notifications', description: 'Notification preferences' },
            { method: 'PUT', path: '/api/settings/notifications', description: 'Update notifications' },
        ]
    },
    {
        category: 'Security',
        icon: Shield,
        items: [
            { method: 'GET', path: '/api/security/api-keys', description: 'List API keys' },
            { method: 'POST', path: '/api/security/api-keys', description: 'Generate new API key' },
            { method: 'DELETE', path: '/api/security/api-keys/:id', description: 'Revoke API key' },
            { method: 'GET', path: '/api/security/sessions', description: 'List active sessions' },
            { method: 'POST', path: '/api/security/sessions/logout-all', description: 'Logout all sessions' },
        ]
    },
]

const codeExamples = {
    sendMessage: `// Send a text message
const response = await fetch('https://api.kewhats.app/api/messages/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    deviceId: 'device_abc123',
    to: '+628123456789',
    message: 'Hello from KeWhats API!'
  })
});

const data = await response.json();
// { success: true, data: { id: 'msg_xyz', status: 'sent' } }`,

    sendMedia: `// Send an image with caption
const response = await fetch('https://api.kewhats.app/api/messages/send-media', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    deviceId: 'device_abc123',
    to: '+628123456789',
    type: 'image',
    mediaUrl: 'https://example.com/image.jpg',
    caption: 'Check out this image!'
  })
});`,

    createBroadcast: `// Create broadcast campaign
const response = await fetch('https://api.kewhats.app/api/broadcast', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    name: 'Promo Campaign',
    deviceId: 'device_abc123',
    message: 'Special offer for you! 🎉',
    recipients: [
      { phone: '+628111111111', name: 'John' },
      { phone: '+628222222222', name: 'Jane' }
    ]
  })
});`,

    webhookPayload: `// Webhook payload example (message.received)
{
  "event": "message.received",
  "timestamp": "2024-12-27T10:30:00Z",
  "data": {
    "message_id": "msg_xyz789",
    "device_id": "device_abc123",
    "from": "+628987654321",
    "from_name": "John Doe",
    "message": "Hi, I want to order",
    "type": "text",
    "timestamp": "2024-12-27T10:30:00Z"
  },
  "signature": "sha256=abc123..."
}

// Available webhook events:
// - message.received
// - message.sent
// - message.delivered
// - message.read
// - message.failed
// - contact.new
// - device.connected
// - device.disconnected`
}

export default function ApiDocs() {
    const [expandedCategories, setExpandedCategories] = useState(['Messages'])
    const [copiedCode, setCopiedCode] = useState(null)
    const [activeExample, setActiveExample] = useState('sendMessage')

    const toggleCategory = (category) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        )
    }

    const copyCode = (code, id) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(id)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const getMethodColor = (method) => {
        switch (method) {
            case 'GET': return 'var(--success)'
            case 'POST': return 'var(--info)'
            case 'PUT': return 'var(--warning)'
            case 'DELETE': return 'var(--error)'
            default: return 'var(--text-muted)'
        }
    }

    // Count total endpoints
    const totalEndpoints = endpoints.reduce((sum, cat) => sum + cat.items.length, 0);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">API Documentation</h1>
                    <p className="page-subtitle">Complete reference for integrating with the WhatsApp Gateway API • {totalEndpoints} endpoints available</p>
                </div>
            </div>

            {/* Quick Start */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Quick Start</h3>
                        <p className="card-subtitle">Get started with the API in minutes</p>
                    </div>
                </div>

                <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Base URL</h4>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem'
                    }}>
                        <code style={{ color: 'var(--primary-400)', flex: 1 }}>https://api.kewhats.app</code>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => copyCode('https://api.kewhats.app', 'baseUrl')}
                        >
                            {copiedCode === 'baseUrl' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>

                <div>
                    <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Authentication</h4>
                    <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                        Include your API key in the Authorization header for all requests:
                    </p>
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem'
                    }}>
                        <code style={{ color: 'var(--text-secondary)' }}>Authorization: </code>
                        <code style={{ color: 'var(--primary-400)' }}>Bearer YOUR_API_KEY</code>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
                {/* Endpoints */}
                <div className="card" style={{ height: 'fit-content', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">API Endpoints</h3>
                            <p className="card-subtitle">{endpoints.length} categories • {totalEndpoints} total endpoints</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {endpoints.map((category) => (
                            <div key={category.category} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden'
                            }}>
                                <button
                                    onClick={() => toggleCategory(category.category)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--spacing-md)',
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--bg-tertiary)',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: 500
                                    }}
                                >
                                    {expandedCategories.includes(category.category)
                                        ? <ChevronDown size={16} />
                                        : <ChevronRight size={16} />
                                    }
                                    <category.icon size={18} style={{ color: 'var(--primary-500)' }} />
                                    {category.category}
                                    <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>
                                        {category.items.length}
                                    </span>
                                </button>

                                {expandedCategories.includes(category.category) && (
                                    <div style={{ padding: 'var(--spacing-sm)' }}>
                                        {category.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-md)',
                                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer'
                                                }}
                                                className="table tbody tr"
                                            >
                                                <span style={{
                                                    fontSize: '0.625rem',
                                                    fontWeight: 600,
                                                    padding: '2px 6px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: `${getMethodColor(item.method)}20`,
                                                    color: getMethodColor(item.method),
                                                    minWidth: '50px',
                                                    textAlign: 'center'
                                                }}>
                                                    {item.method}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <code style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)',
                                                        fontFamily: 'var(--font-mono)',
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.path}
                                                    </code>
                                                    <span style={{
                                                        fontSize: '0.6875rem',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        {item.description}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Code Examples */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Code Examples</h3>
                            <p className="card-subtitle">Copy-paste ready code snippets</p>
                        </div>
                    </div>

                    <div className="tabs" style={{ marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                        <button
                            className={`tab ${activeExample === 'sendMessage' ? 'active' : ''}`}
                            onClick={() => setActiveExample('sendMessage')}
                        >
                            Send Text
                        </button>
                        <button
                            className={`tab ${activeExample === 'sendMedia' ? 'active' : ''}`}
                            onClick={() => setActiveExample('sendMedia')}
                        >
                            Send Media
                        </button>
                        <button
                            className={`tab ${activeExample === 'createBroadcast' ? 'active' : ''}`}
                            onClick={() => setActiveExample('createBroadcast')}
                        >
                            Broadcast
                        </button>
                        <button
                            className={`tab ${activeExample === 'webhookPayload' ? 'active' : ''}`}
                            onClick={() => setActiveExample('webhookPayload')}
                        >
                            Webhook
                        </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-ghost btn-icon"
                            style={{
                                position: 'absolute',
                                top: 'var(--spacing-sm)',
                                right: 'var(--spacing-sm)',
                                zIndex: 1,
                                background: 'var(--bg-secondary)'
                            }}
                            onClick={() => copyCode(codeExamples[activeExample], activeExample)}
                        >
                            {copiedCode === activeExample ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <pre style={{
                            padding: 'var(--spacing-lg)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'auto',
                            maxHeight: '400px',
                            margin: 0
                        }}>
                            <code style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6
                            }}>
                                {codeExamples[activeExample]}
                            </code>
                        </pre>
                    </div>
                </div>
            </div>

            {/* Response Codes */}
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Response Codes</h3>
                        <p className="card-subtitle">Common HTTP response codes and their meanings</p>
                    </div>
                </div>

                <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Status</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { code: 200, status: 'OK', description: 'Request successful', color: 'var(--success)' },
                                { code: 201, status: 'Created', description: 'Resource created successfully', color: 'var(--success)' },
                                { code: 400, status: 'Bad Request', description: 'Invalid request parameters', color: 'var(--warning)' },
                                { code: 401, status: 'Unauthorized', description: 'Invalid or missing API key', color: 'var(--error)' },
                                { code: 403, status: 'Forbidden', description: 'Access denied to this resource', color: 'var(--error)' },
                                { code: 404, status: 'Not Found', description: 'Resource not found', color: 'var(--error)' },
                                { code: 429, status: 'Too Many Requests', description: 'Rate limit exceeded', color: 'var(--warning)' },
                                { code: 500, status: 'Server Error', description: 'Internal server error', color: 'var(--error)' },
                            ].map((item) => (
                                <tr key={item.code}>
                                    <td>
                                        <code style={{
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: `${item.color}20`,
                                            color: item.color,
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}>
                                            {item.code}
                                        </code>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{item.status}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{item.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rate Limits */}
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <div>
                        <h3 className="card-title">Rate Limits</h3>
                        <p className="card-subtitle">API rate limits by subscription plan</p>
                    </div>
                </div>

                <div className="table-container" style={{ border: 'none' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Plan</th>
                                <th>Requests/minute</th>
                                <th>Messages/month</th>
                                <th>Devices</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span className="badge badge-neutral">Free</span></td>
                                <td>30</td>
                                <td>1,500</td>
                                <td>1</td>
                            </tr>
                            <tr>
                                <td><span className="badge" style={{ background: 'var(--primary-500)', color: 'white' }}>Pro</span></td>
                                <td>100</td>
                                <td>10,000</td>
                                <td>5</td>
                            </tr>
                            <tr>
                                <td><span className="badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>Business</span></td>
                                <td>300</td>
                                <td>50,000</td>
                                <td>20</td>
                            </tr>
                            <tr>
                                <td><span className="badge" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white' }}>Enterprise</span></td>
                                <td>Unlimited</td>
                                <td>Unlimited</td>
                                <td>Unlimited</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
