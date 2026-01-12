import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    Smartphone,
    Send,
    Bot,
    Webhook,
    Users,
    MessageSquare,
    Settings,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    FileCode2,
    LogOut,
    BookOpen,
    Zap,
    Inbox,
    FileText,
    Workflow,
    Shield,
    BarChart3,
    Plug,
    Sparkles,
    CreditCard,
    Brain,
    Activity
} from 'lucide-react'
import { useConfirm } from './ConfirmDialog'

const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Inbox', icon: Inbox, path: '/inbox' },
    { name: 'Templates', icon: FileText, path: '/templates' },
    { name: 'Devices', icon: Smartphone, path: '/devices' },
    { name: 'Groups', icon: Users, path: '/groups' },
    { name: 'Broadcast', icon: Send, path: '/broadcast' },
    { name: 'Chatbot', icon: Workflow, path: '/chatbot' },
    { name: 'Smart Knowledge', icon: Brain, path: '/smart-knowledge' },
    { name: 'Auto Reply', icon: Bot, path: '/auto-reply' },
    { name: 'Webhook', icon: Webhook, path: '/webhook' },
    { name: 'Contacts', icon: Users, path: '/contacts' },
    { name: 'Message Logs', icon: MessageSquare, path: '/logs' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'Integrations', icon: Plug, path: '/integrations' },
    { name: 'AI Features', icon: Sparkles, path: '/ai' },
    { name: 'Team', icon: Users, path: '/team' },
]

const settingsNav = [
    { name: 'Billing', icon: CreditCard, path: '/billing' },
    { name: 'Setup N8N', icon: Zap, path: '/n8n-setup' },
    { name: 'API Docs', icon: FileCode2, path: '/api-docs' },
    { name: 'Security', icon: Shield, path: '/security' },
    { name: 'Settings', icon: Settings, path: '/settings' },
]

// Monitoring role specific navigation
const monitoringNav = [
    { name: 'Overview', icon: Activity, path: '/monitoring' },
    { name: 'Users', icon: Users, path: '/monitoring/users' },
    { name: 'Connections', icon: Smartphone, path: '/monitoring/connections' },
    { name: 'Integrations', icon: Plug, path: '/monitoring/integrations' },
    { name: 'Chatbots', icon: Workflow, path: '/monitoring/chatbots' },
    { name: 'Broadcasts', icon: Send, path: '/monitoring/broadcasts' },
    { name: 'Contacts', icon: Users, path: '/monitoring/contacts' },
    { name: 'Webhooks', icon: Webhook, path: '/monitoring/webhooks' },
]

const monitoringSettingsNav = [
    { name: 'Settings', icon: Settings, path: '/settings' },
]

export default function Sidebar({ collapsed, onToggle }) {
    const confirm = useConfirm()
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [branding, setBranding] = useState({
        logo_dashboard: '',
        app_name: 'KeWhats'
    })

    // Load user data from localStorage
    const loadUserData = () => {
        try {
            const userData = localStorage.getItem('user')
            if (userData && userData !== 'undefined') {
                setUser(JSON.parse(userData))
            }
        } catch (e) {
            console.error('Failed to parse user data:', e)
            localStorage.removeItem('user')
        }
    }

    // Fetch branding settings
    const fetchBranding = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
            const res = await fetch(`${API_URL}/system-settings/public`)
            const data = await res.json()
            if (data.success && data.data) {
                setBranding(prev => ({ ...prev, ...data.data }))
            }
        } catch (error) {
            console.error('Failed to fetch branding:', error)
        }
    }

    useEffect(() => {
        loadUserData()
        fetchBranding()

        // Listen for storage changes (e.g., when Billing page updates plan)
        const handleStorageChange = () => {
            loadUserData()
        }

        window.addEventListener('storage', handleStorageChange)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
        }
    }, [])

    const handleLogout = async () => {
        const isConfirmed = await confirm({
            title: 'Logout?',
            message: 'Are you sure you want to log out from this account?',
            confirmText: 'Yes, Logout',
            cancelText: 'Cancel',
            danger: false
        })
        if (isConfirmed) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            navigate('/login')
        }
    }

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    {branding.logo_dashboard ? (
                        <img src={branding.logo_dashboard} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                    ) : (
                        <MessageCircle />
                    )}
                </div>
                <div className="sidebar-brand">
                    <h1>{branding.app_name || 'KeWhats'}</h1>
                    <span>WhatsApp Gateway</span>
                </div>
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={onToggle}
                    style={{ marginLeft: 'auto' }}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    <div className="nav-section-title">{user?.role === 'monitoring' ? 'Monitoring' : 'Main Menu'}</div>
                    {(user?.role === 'monitoring' ? monitoringNav : navigation).map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </div>

                <div className="nav-section">
                    <div className="nav-section-title">System</div>
                    {(user?.role === 'monitoring' ? monitoringSettingsNav : settingsNav).map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                    <button
                        className="nav-item w-full text-left"
                        onClick={handleLogout}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="user-avatar">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{user?.name || 'User'}</div>
                        <div className="user-role">{user?.email || 'user@example.com'}</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
