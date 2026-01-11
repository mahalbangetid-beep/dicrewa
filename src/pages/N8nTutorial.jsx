import { useState } from 'react'
import {
    BookOpen,
    Copy,
    Check,
    ExternalLink,
    Play,
    ArrowRight,
    Zap,
    MessageSquare,
    Webhook,
    Settings,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    CheckCircle,
    Code,
    Database,
    Globe
} from 'lucide-react'

const steps = [
    {
        id: 1,
        title: 'Persiapan n8n',
        description: 'Install dan setup n8n di server atau gunakan n8n cloud'
    },
    {
        id: 2,
        title: 'Dapatkan API Key',
        description: 'Generate API key dari halaman Settings > API Keys'
    },
    {
        id: 3,
        title: 'Konfigurasi HTTP Request',
        description: 'Setup HTTP Request node di n8n workflow'
    },
    {
        id: 4,
        title: 'Setup Webhook Trigger',
        description: 'Terima pesan masuk dari KeWhats ke n8n'
    },
]

const useCases = [
    {
        title: 'Auto-Responder Cerdas',
        description: 'Gunakan n8n + OpenAI untuk membalas pesan dengan AI',
        icon: MessageSquare,
        difficulty: 'Disabled'
    },
    {
        title: 'Order Notification',
        description: 'Kirim notifikasi WhatsApp saat ada order baru di WooCommerce/Shopify',
        icon: Zap,
        difficulty: 'Beginner'
    },
    {
        title: 'CRM Integration',
        description: 'Sync kontak dan pesan ke Airtable, Google Sheets, atau HubSpot',
        icon: Database,
        difficulty: 'Beginner'
    },
    {
        title: 'Scheduled Broadcast',
        description: 'Jadwalkan pengiriman pesan broadcast dari Google Sheets',
        icon: Globe,
        difficulty: 'Disabled'
    },
]

const codeExamples = {
    sendMessage: {
        title: 'Kirim Pesan Text',
        description: 'HTTP Request untuk mengirim pesan WhatsApp',
        code: `// n8n HTTP Request Node Configuration

Method: POST
URL: https://api.kewhats.app/api/messages/send

Headers:
  Authorization: Bearer {{ $credentials.kewhats_api_key }}
  Content-Type: application/json

Body (JSON):
{
  "device_id": "device_123",
  "to": "{{ $json.phone_number }}",
  "message": "Halo {{ $json.customer_name }}, pesanan Anda #{{ $json.order_id }} telah dikonfirmasi!"
}`
    },
    sendImage: {
        title: 'Kirim Gambar',
        description: 'HTTP Request untuk mengirim gambar dengan caption',
        code: `// n8n HTTP Request Node Configuration

Method: POST
URL: https://api.kewhats.app/api/messages/send-media

Headers:
  Authorization: Bearer {{ $credentials.kewhats_api_key }}
  Content-Type: application/json

Body (JSON):
{
  "device_id": "device_123",
  "to": "{{ $json.phone_number }}",
  "type": "image",
  "media_url": "{{ $json.product_image }}",
  "caption": "Produk: {{ $json.product_name }}\\nHarga: Rp {{ $json.price }}"
}`
    },
    webhookReceive: {
        title: 'Terima Pesan (Webhook)',
        description: 'Konfigurasi Webhook node untuk menerima pesan masuk',
        code: `// n8n Webhook Node - Incoming Message

Webhook URL: https://your-n8n.com/webhook/kewhats-incoming

// Payload yang diterima dari KeWhats:
{
  "event": "message.received",
  "timestamp": "2024-12-27T10:30:00Z",
  "data": {
    "message_id": "msg_xyz789",
    "device_id": "device_123",
    "from": "+628987654321",
    "from_name": "John Doe",
    "message": "Saya mau order produk A",
    "type": "text"
  }
}

// Gunakan data ini di node berikutnya:
// {{ $json.data.from }} - Nomor pengirim
// {{ $json.data.message }} - Isi pesan
// {{ $json.data.from_name }} - Nama pengirim`
    },
    credentials: {
        title: 'Setup Credentials',
        description: 'Cara menyimpan API Key sebagai credential di n8n',
        code: `// Langkah Setup Credential di n8n:

1. Buka n8n > Settings > Credentials
2. Click "Add Credential" > "Header Auth"
3. Isi:
   - Name: KeWhats API Key
   - Header Name: Authorization
   - Header Value: Bearer YOUR_API_KEY_HERE

4. Save credential

// Penggunaan di HTTP Request Node:
Authentication: Predefined Credential Type
Credential Type: Header Auth
Credential: KeWhats API Key

// Atau gunakan Expression:
Headers > Add Header:
  Name: Authorization
  Value: Bearer {{ $credentials.kewhats_api_key }}`
    }
}

const workflowTemplates = [
    {
        name: 'Simple Auto-Reply',
        description: 'Balas pesan otomatis berdasarkan keyword',
        nodes: ['Webhook', 'IF', 'HTTP Request'],
        downloadUrl: '#'
    },
    {
        name: 'Order Confirmation',
        description: 'Kirim konfirmasi order dari WooCommerce',
        nodes: ['WooCommerce Trigger', 'HTTP Request'],
        downloadUrl: '#'
    },
    {
        name: 'AI Chatbot',
        description: 'Chatbot dengan OpenAI GPT',
        nodes: ['Webhook', 'OpenAI', 'HTTP Request'],
        downloadUrl: '#'
    },
    {
        name: 'Broadcast from Sheets',
        description: 'Kirim broadcast dari Google Sheets',
        nodes: ['Schedule', 'Google Sheets', 'Loop', 'HTTP Request'],
        downloadUrl: '#'
    }
]

export default function N8nTutorial() {
    const [activeTab, setActiveTab] = useState('quickstart')
    const [activeExample, setActiveExample] = useState('sendMessage')
    const [copiedCode, setCopiedCode] = useState(null)
    const [expandedStep, setExpandedStep] = useState(1)

    const copyCode = (code, id) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(id)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">N8n Integration Tutorial</h1>
                    <p className="page-subtitle">Panduan lengkap mengintegrasikan KeWhats dengan n8n untuk automation workflow</p>
                </div>
                <a
                    href="https://dicreso.my.id/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                >
                    <ExternalLink size={16} />
                    n8n Unlimited Workflow?
                </a>
            </div>

            {/* Introduction Banner */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.15) 0%, rgba(18, 140, 126, 0.1) 100%)',
                border: '1px solid rgba(37, 211, 102, 0.3)',
                marginBottom: 'var(--spacing-xl)'
            }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-xl)', alignItems: 'center' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--radius-xl)',
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Zap size={40} />
                    </div>
                    <div>
                        <h2 style={{ marginBottom: 'var(--spacing-sm)' }}>Apa itu n8n?</h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            <strong>n8n</strong> adalah platform workflow automation open-source yang memungkinkan Anda menghubungkan
                            berbagai aplikasi dan layanan tanpa coding. Dengan integrasi KeWhats + n8n, Anda bisa membuat
                            chatbot WhatsApp cerdas, notifikasi otomatis, dan berbagai automation lainnya.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <button
                    className={`tab ${activeTab === 'quickstart' ? 'active' : ''}`}
                    onClick={() => setActiveTab('quickstart')}
                >
                    <Play size={16} /> Quick Start
                </button>
                <button
                    className={`tab ${activeTab === 'examples' ? 'active' : ''}`}
                    onClick={() => setActiveTab('examples')}
                >
                    <Code size={16} /> Code Examples
                </button>
                <button
                    className={`tab ${activeTab === 'usecases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('usecases')}
                >
                    <Zap size={16} /> Use Cases
                </button>
                <button
                    className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('templates')}
                >
                    <BookOpen size={16} /> Templates
                </button>
            </div>

            {activeTab === 'quickstart' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xl)' }}>
                    {/* Steps */}
                    <div>
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Langkah-langkah Setup</h3>
                                    <p className="card-subtitle">Ikuti panduan berikut untuk memulai</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                {steps.map((step, index) => (
                                    <div
                                        key={step.id}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            background: expandedStep === step.id ? 'rgba(37, 211, 102, 0.1)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: expandedStep === step.id ? '1px solid rgba(37, 211, 102, 0.3)' : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                        onClick={() => setExpandedStep(step.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: 'var(--radius-full)',
                                                background: expandedStep === step.id ? 'var(--primary-500)' : 'var(--bg-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 600,
                                                fontSize: '0.875rem'
                                            }}>
                                                {step.id}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500 }}>{step.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{step.description}</div>
                                            </div>
                                            {expandedStep === step.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </div>

                                        {expandedStep === step.id && (
                                            <div style={{
                                                marginTop: 'var(--spacing-md)',
                                                paddingTop: 'var(--spacing-md)',
                                                borderTop: '1px solid var(--border-color)'
                                            }}>
                                                {step.id === 1 && (
                                                    <div>
                                                        <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                                                            Ada 2 cara untuk menggunakan n8n:
                                                        </p>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                                            <div style={{
                                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                                background: 'var(--bg-secondary)',
                                                                borderRadius: 'var(--radius-md)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <span style={{ fontSize: '0.875rem' }}>☁️ n8n Official</span>
                                                                <a href="https://n8n.io/cloud" target="_blank" className="btn btn-primary btn-sm">
                                                                    Daftar
                                                                </a>
                                                            </div>
                                                            <div style={{
                                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                                background: 'var(--bg-secondary)',
                                                                borderRadius: 'var(--radius-md)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <span style={{ fontSize: '0.875rem' }}>🚀 n8n Self-Hosted Unlimited</span>
                                                                <a href="https://dicreso.my.id/" target="_blank" className="btn btn-secondary btn-sm">
                                                                    Get it
                                                                </a>
                                                            </div>
                                                            <div style={{
                                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                                background: 'var(--bg-secondary)',
                                                                borderRadius: 'var(--radius-md)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <span style={{ fontSize: '0.875rem' }}>🖥️ Self-hosted (Docker)</span>
                                                                <a href="https://docs.n8n.io/hosting/" target="_blank" className="btn btn-secondary btn-sm">
                                                                    Docs
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {step.id === 2 && (
                                                    <div>
                                                        <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                                                            Buka halaman <strong>Settings &gt; API Keys</strong> dan generate API key baru.
                                                            Simpan key ini dengan aman karena hanya ditampilkan sekali.
                                                        </p>
                                                        <div style={{
                                                            padding: 'var(--spacing-md)',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontFamily: 'var(--font-mono)',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <code style={{ color: 'var(--primary-400)' }}>
                                                                dk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                                                            </code>
                                                        </div>
                                                    </div>
                                                )}
                                                {step.id === 3 && (
                                                    <div>
                                                        <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                                                            Di n8n, tambahkan node <strong>HTTP Request</strong> dengan konfigurasi:
                                                        </p>
                                                        <ul style={{ fontSize: '0.875rem', paddingLeft: '20px', margin: 0 }}>
                                                            <li>Method: POST</li>
                                                            <li>URL: https://api.kewhats.app/api/messages/send</li>
                                                            <li>Authentication: Header Auth</li>
                                                            <li>Body: JSON dengan field to, message, device_id</li>
                                                        </ul>
                                                    </div>
                                                )}
                                                {step.id === 4 && (
                                                    <div>
                                                        <p style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
                                                            Untuk menerima pesan masuk, setup <strong>Webhook</strong> di KeWhats yang mengarah ke n8n webhook URL Anda.
                                                        </p>
                                                        <div style={{
                                                            padding: 'var(--spacing-md)',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>n8n Webhook URL:</div>
                                                            <code style={{ color: 'var(--primary-400)', fontFamily: 'var(--font-mono)' }}>
                                                                https://your-n8n.com/webhook/kewhats
                                                            </code>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Video/Diagram Area */}
                    <div>
                        <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Diagram Integrasi</h3>
                                    <p className="card-subtitle">Alur kerja KeWhats + n8n</p>
                                </div>
                            </div>

                            <div style={{
                                padding: 'var(--spacing-xl)',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-lg)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)'
                            }}>
                                {/* Flow Diagram */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <div style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--gradient-primary)',
                                        borderRadius: 'var(--radius-lg)',
                                        textAlign: 'center',
                                        minWidth: '100px'
                                    }}>
                                        <MessageSquare size={24} />
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>WhatsApp</div>
                                    </div>
                                    <ArrowRight size={24} style={{ color: 'var(--text-muted)' }} />
                                    <div style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--info)',
                                        borderRadius: 'var(--radius-lg)',
                                        textAlign: 'center',
                                        minWidth: '100px'
                                    }}>
                                        <Zap size={24} />
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>KeWhats</div>
                                    </div>
                                    <ArrowRight size={24} style={{ color: 'var(--text-muted)' }} />
                                    <div style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--warning)',
                                        borderRadius: 'var(--radius-lg)',
                                        textAlign: 'center',
                                        minWidth: '100px',
                                        color: 'var(--dark-900)'
                                    }}>
                                        <Webhook size={24} />
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>n8n</div>
                                    </div>
                                </div>

                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    textAlign: 'center',
                                    maxWidth: '300px'
                                }}>
                                    Pesan masuk dari WhatsApp diteruskan ke n8n melalui webhook,
                                    lalu n8n bisa memproses dan membalas melalui API KeWhats
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            )}

            {activeTab === 'examples' && (
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--spacing-xl)' }}>
                    {/* Example Selection */}
                    <div className="card" style={{ height: 'fit-content', padding: 'var(--spacing-sm)' }}>
                        {Object.entries(codeExamples).map(([key, example]) => (
                            <button
                                key={key}
                                className={`nav-item ${activeExample === key ? 'active' : ''}`}
                                onClick={() => setActiveExample(key)}
                                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
                            >
                                <Code size={18} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.875rem' }}>{example.title}</div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{example.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Code Display */}
                    <div className="card">
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">{codeExamples[activeExample].title}</h3>
                                <p className="card-subtitle">{codeExamples[activeExample].description}</p>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => copyCode(codeExamples[activeExample].code, activeExample)}
                            >
                                {copiedCode === activeExample ? <Check size={14} /> : <Copy size={14} />}
                                {copiedCode === activeExample ? 'Copied!' : 'Copy'}
                            </button>
                        </div>

                        <pre style={{
                            padding: 'var(--spacing-lg)',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'auto',
                            maxHeight: '500px',
                            margin: 0
                        }}>
                            <code style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.8rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap'
                            }}>
                                {codeExamples[activeExample].code}
                            </code>
                        </pre>
                    </div>
                </div>
            )}

            {activeTab === 'usecases' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-lg)' }}>
                    {useCases.map((useCase, idx) => (
                        <div key={idx} className="card">
                            <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'rgba(37, 211, 102, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <useCase.icon size={28} style={{ color: 'var(--primary-500)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-sm)' }}>
                                        <h4 style={{ margin: 0 }}>{useCase.title}</h4>
                                        <span className={`badge ${useCase.difficulty === 'Beginner' ? 'badge-success' : useCase.difficulty === 'Disabled' ? 'badge-error' : 'badge-warning'}`}>
                                            {useCase.difficulty}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                                        {useCase.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'templates' && (
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--info-light)',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: 'var(--spacing-xl)'
                    }}>
                        <AlertCircle size={20} style={{ color: 'var(--info)' }} />
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--info)' }}>
                            Download template workflow n8n dan import ke instance n8n Anda untuk memulai dengan cepat.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-lg)' }}>
                        {workflowTemplates.map((template, idx) => (
                            <div key={idx} className="card">
                                <div className="card-header">
                                    <div>
                                        <h4 className="card-title">{template.name}</h4>
                                        <p className="card-subtitle">{template.description}</p>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: 'var(--spacing-xs)',
                                    flexWrap: 'wrap',
                                    marginBottom: 'var(--spacing-md)'
                                }}>
                                    {template.nodes.map((node, nodeIdx) => (
                                        <span
                                            key={nodeIdx}
                                            style={{
                                                padding: '4px 8px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.625rem',
                                                fontWeight: 500
                                            }}
                                        >
                                            {node}
                                        </span>
                                    ))}
                                </div>

                                <button className="btn btn-primary btn-sm w-full">
                                    <ExternalLink size={14} />
                                    Download Template
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
