import { useState, useEffect } from 'react'
import {
    Copy,
    Check,
    Smartphone,
    Key,
    Zap,
    AlertCircle,
    Loader2,
    Globe,
    Plug,
    Workflow,
    ShieldCheck
} from 'lucide-react'
import { deviceService, settingsService } from '../services/api'
import { toast } from 'react-hot-toast'
import './N8nSetup.css' // Import custom CSS

export default function N8nSetup() {
    const [devices, setDevices] = useState([])
    const [loadingDevices, setLoadingDevices] = useState(false)
    const [user, setUser] = useState(null)
    const [apiKey, setApiKey] = useState('')
    const [selectedDeviceId, setSelectedDeviceId] = useState('')
    const [generatedJson, setGeneratedJson] = useState('')
    const [copiedId, setCopiedId] = useState(null)
    const [copiedJson, setCopiedJson] = useState(false)
    const [loadingProfile, setLoadingProfile] = useState(false)

    useEffect(() => {
        fetchDevices()
        fetchProfile()
    }, [])

    useEffect(() => {
        if (apiKey && selectedDeviceId) {
            generateNodeJson()
        }
    }, [apiKey, selectedDeviceId])

    const fetchDevices = async () => {
        setLoadingDevices(true)
        try {
            const res = await deviceService.list()
            const deviceList = res.data || []
            setDevices(deviceList)
            const connectedDevice = deviceList.find(d => d.status === 'connected')
            if (connectedDevice) {
                setSelectedDeviceId(connectedDevice.id)
            } else if (deviceList.length > 0) {
                setSelectedDeviceId(deviceList[0].id)
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error)
        } finally {
            setLoadingDevices(false)
        }
    }

    const fetchProfile = async () => {
        setLoadingProfile(true)
        try {
            const res = await settingsService.getProfile()
            setUser(res.data)
            if (res.data?.apiKey) {
                setApiKey(res.data.apiKey)
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error)
        } finally {
            setLoadingProfile(false)
        }
    }

    const handleCopyDevice = (e, id) => {
        e.stopPropagation()
        navigator.clipboard.writeText(id)
        setCopiedId(id)
        toast.success('Device ID copied')
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleCopyJson = () => {
        navigator.clipboard.writeText(generatedJson)
        setCopiedJson(true)
        toast.success('Workflow JSON copied to clipboard')
        setTimeout(() => setCopiedJson(false), 2000)
    }

    const generateNodeJson = () => {
        const n8nNode = {
            "nodes": [
                {
                    "parameters": {
                        "method": "POST",
                        "url": "https://api.kewhats.app/api/messages/send",
                        "sendHeaders": true,
                        "headerParameters": {
                            "parameters": [
                                {
                                    "name": "Authorization",
                                    "value": `Bearer ${apiKey}`
                                }
                            ]
                        },
                        "sendBody": true,
                        "contentType": "form-urlencoded",
                        "bodyParameters": {
                            "parameters": [
                                {
                                    "name": "deviceId",
                                    "value": selectedDeviceId
                                },
                                {
                                    "name": "to",
                                    "value": "6281285159091"
                                },
                                {
                                    "name": "message",
                                    "value": "Hello from n8n Integration! 🚀"
                                }
                            ]
                        },
                        "options": {}
                    },
                    "name": "KeWhats Send",
                    "type": "n8n-nodes-base.httpRequest",
                    "typeVersion": 4.1,
                    "position": [0, 0]
                }
            ],
            "connections": {}
        }
        setGeneratedJson(JSON.stringify(n8nNode, null, 2))
    }

    const [activeTab, setActiveTab] = useState('generator') // 'generator' | 'credential'

    // Helper to colorize JSON for display
    const getColorizedJson = () => {
        if (!generatedJson) return '';
        return generatedJson
            .replace(/"keys":/g, '<span class="json-key">"keys"</span>:')
            .replace(/"string"/g, '<span class="json-string">"string"</span>')
            .replace(/(".*?"):/g, '<span class="json-key">$1</span>:')
            .replace(/: (".*?")/g, ': <span class="json-string">$1</span>')
            .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
            .replace(/: ([0-9]+)/g, ': <span class="json-number">$1</span>');
    }

    const renderCredentialTutorial = () => (
        <div className="credential-tutorial animate-fade-in">
            <div className="tutorial-step">
                <div className="step-number">1</div>
                <div className="step-content">
                    <h3>Create Webhook in KeWhats</h3>
                    <p>Go to the <strong>Webhook</strong> page and click "Add Webhook".</p>
                    <div className="config-box">
                        <div className="config-row">
                            <span className="label">Endpoint URL:</span>
                            <span className="value">Your n8n Webhook URL (Production)</span>
                        </div>
                        <div className="config-row">
                            <span className="label">Events:</span>
                            <span className="value">Message Received</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tutorial-step">
                <div className="step-number">2</div>
                <div className="step-content">
                    <h3>Configure n8n Webhook Node</h3>
                    <p>In n8n, add a <strong>Webhook</strong> node.</p>
                    <div className="config-box">
                        <div className="config-row">
                            <span className="label">HTTP Method:</span>
                            <span className="value">POST</span>
                        </div>
                        <div className="config-row">
                            <span className="label">Path:</span>
                            <span className="value">/webhook (or any path you like)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tutorial-step">
                <div className="step-number">3</div>
                <div className="step-content">
                    <h3>Activate & Test</h3>
                    <p>
                        1. <strong>Activate</strong> your n8n workflow.<br />
                        2. Send a WhatsApp message to your connected device.<br />
                        3. Your n8n workflow should trigger automatically!
                    </p>
                    <div className="note">
                        <AlertCircle size={14} />
                        <span>Ensure your n8n instance is publicly accessible if you are not running it on localhost.</span>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="n8n-container">
            {/* Hero Section */}
            <div className="n8n-hero">
                <div className="n8n-hero-content">
                    <div>
                        <div className="n8n-badge">
                            <Workflow size={14} />
                            <span>Automation Integration</span>
                        </div>
                        <h1 className="n8n-title">
                            Configure Your <br />
                            <span>n8n Workflow</span>
                        </h1>
                        <div className="n8n-description">
                            <p style={{ marginBottom: '1rem' }}>Get started in 2 simple steps:</p>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400" style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
                                <li>Copy the node code from the <b>Generate Workflow</b> tab.</li>
                                <li>Execute Workflow! <span className="text-warning">(Check the phone number in the JSON body, update it with your target number)</span></li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>

            <div className="n8n-tabs">
                <button
                    className={`n8n-tab ${activeTab === 'credential' ? 'active' : ''}`}
                    onClick={() => setActiveTab('credential')}
                >
                    <ShieldCheck size={18} />
                    Setup Webhook
                </button>
                <button
                    className={`n8n-tab ${activeTab === 'generator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generator')}
                >
                    <Zap size={18} />
                    Generate Workflow SEND
                </button>
            </div>

            {activeTab === 'credential' ? (
                renderCredentialTutorial()
            ) : (
                <div className="n8n-grid">

                    {/* Configuration Sidebar */}
                    <div className="n8n-sidebar">

                        {/* Device Selection */}
                        <div className="config-card">
                            <div className="config-header">
                                <div>
                                    <h3>Select Source Device</h3>
                                    <p>Choose the active WhatsApp number</p>
                                </div>
                                <Smartphone size={20} className="text-muted" />
                            </div>

                            <div className="device-list">
                                {loadingDevices ? (
                                    <div className="text-center p-4">
                                        <Loader2 className="animate-spin mx-auto text-primary" size={24} />
                                    </div>
                                ) : devices.length > 0 ? (
                                    devices.map(device => {
                                        const isSelected = selectedDeviceId === device.id
                                        const isConnected = device.status === 'connected'

                                        return (
                                            <div
                                                key={device.id}
                                                onClick={() => setSelectedDeviceId(device.id)}
                                                className={`device-item ${isSelected ? 'active' : ''}`}
                                            >
                                                <div className="device-item-header">
                                                    <span className="device-name">{device.name}</span>
                                                    {isSelected && <Check size={16} className="text-primary" />}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div className="device-status">
                                                        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                                                        <span>{device.status}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <span className="device-phone">
                                                            {device.id || 'Unknown ID'}
                                                        </span>
                                                        <button
                                                            onClick={(e) => handleCopyDevice(e, device.id)}
                                                            className="btn-icon btn-ghost"
                                                            title="Copy ID"
                                                            style={{ width: '24px', height: '24px' }}
                                                        >
                                                            {copiedId === device.id ? <Check size={12} /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-center p-4 text-warning">
                                        <AlertCircle className="mx-auto mb-2" size={24} />
                                        <p>No devices found</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* API Key Status */}
                        <div className="api-status-card">
                            <div className="api-status-info">
                                <div className={`status-icon-box ${apiKey ? 'active' : 'inactive'}`}>
                                    {apiKey ? <ShieldCheck size={24} /> : <Key size={24} />}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>API Authorization</h3>
                                    <p style={{ fontSize: '0.8rem', color: apiKey ? 'var(--success)' : 'var(--error)' }}>
                                        {apiKey ? 'Credential Active & Ready' : 'API Key Missing'}
                                    </p>
                                </div>
                            </div>
                            {!apiKey && (
                                <a href="/settings" className="btn btn-sm btn-danger">
                                    Setup
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Json Generator */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="editor-container">

                            {/* Editor Toolbar */}
                            <div className="editor-toolbar">
                                <div className="window-controls">
                                    <div className="control-dot red"></div>
                                    <div className="control-dot yellow"></div>
                                    <div className="control-dot green"></div>
                                </div>

                                <div className="endpoint-badge">
                                    <span className="endpoint-method">POST</span>
                                    https://api.kewhats.app/api/messages/send
                                </div>

                                <button
                                    onClick={handleCopyJson}
                                    disabled={!apiKey || !selectedDeviceId}
                                    className={`btn btn-sm ${copiedJson ? 'btn-success' : 'btn-primary'}`}
                                >
                                    {copiedJson ? <Check size={14} /> : <Copy size={14} />}
                                    {copiedJson ? 'Copied' : 'Copy Code'}
                                </button>
                            </div>

                            {/* Editor Content */}
                            <div className="editor-content">
                                {/* Overlay if missing config */}
                                {(!apiKey || !selectedDeviceId) && (
                                    <div className="overlay-message">
                                        <div className="overlay-icon">
                                            <Plug size={32} />
                                        </div>
                                        <h3>Awaiting Configuration</h3>
                                        <p style={{ color: 'var(--text-muted)', maxWidth: '400px' }}>
                                            Please select a source device from the left panel to automatically generate your secure n8n integration code.
                                        </p>
                                    </div>
                                )}

                                <div className="line-numbers">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={i}>{i + 1}</div>
                                    ))}
                                </div>

                                <div className="code-area custom-scrollbar">
                                    {generatedJson ? (
                                        <pre dangerouslySetInnerHTML={{ __html: getColorizedJson() }} />
                                    ) : (
                                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>// Code will appear here...</span>
                                    )}
                                </div>
                            </div>

                            {/* Status Bar */}
                            <div className="editor-statusbar">
                                <div>JSON Format • UTF-8</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: apiKey ? '#22c55e' : '#f43f5e' }}></div>
                                    Server Status: Online
                                </div>
                            </div>
                        </div>

                        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Paste this code directly into your n8n canvas (Ctrl+V) to create a new HTTP Request Node.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
