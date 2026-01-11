import { useState, useEffect, useRef } from 'react'

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false)
    const [activeTab, setActiveTab] = useState('ecommerce')
    const [openFaq, setOpenFaq] = useState(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [billingCycle, setBillingCycle] = useState('monthly')
    const [animatedStats, setAnimatedStats] = useState({ messages: 0, integrations: 0, uptime: 0 })
    const statsRef = useRef(null)
    const [statsAnimated, setStatsAnimated] = useState(false)
    const [language, setLanguage] = useState('id') // 'id' for Indonesia, 'en' for English

    // Testimonials data
    const testimonials = language === 'id' ? [
        { name: 'Ahmad Rizki', role: 'Owner Toko Online', avatar: '👨‍💼', quote: 'KeWhats menghemat 5 jam kerja CS kami per hari! Auto-reply dan chatbot-nya sangat membantu.' },
        { name: 'Siti Nurhaliza', role: 'Marketing Manager', avatar: '👩‍💻', quote: 'Broadcast campaign kami jadi lebih efektif. ROI meningkat 3x lipat sejak pakai KeWhats.' },
        { name: 'Budi Santoso', role: 'Founder Startup', avatar: '👨‍🚀', quote: 'Integrasi dengan n8n sangat mudah. Sekarang semua workflow otomatis terhubung dengan WhatsApp.' },
        { name: 'Diana Putri', role: 'Customer Service Lead', avatar: '👩‍🎤', quote: 'Smart Knowledge (RAG) luar biasa! Customer dapat jawaban akurat 24/7 dari knowledge base kami.' },
    ] : [
        { name: 'Ahmad Rizki', role: 'Online Store Owner', avatar: '👨‍💼', quote: "KeWhats saves our CS team 5 hours of work per day! Its auto-reply and chatbot are incredibly helpful." },
        { name: 'Siti Nurhaliza', role: 'Marketing Manager', avatar: '👩‍💻', quote: "Our broadcast campaigns have become more effective. ROI has tripled since using KeWhats." },
        { name: 'Budi Santoso', role: 'Startup Founder', avatar: '👨‍🚀', quote: "Integration with n8n is very easy. Now all workflows are automatically connected to WhatsApp." },
        { name: 'Diana Putri', role: 'Customer Service Lead', avatar: '👩‍🎤', quote: "Smart Knowledge (RAG) is amazing! Customers get accurate answers 24/7 from our knowledge base." },
    ]

    // Trusted by logos
    const trustedBy = ['TechCorp', 'StartupID', 'MegaStore', 'CloudServe', 'DataFlow']

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Stats counter animation
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !statsAnimated) {
                    setStatsAnimated(true)
                    animateCounter('messages', 10000, 2000)
                    animateCounter('integrations', 50, 1500)
                    animateCounter('uptime', 99.9, 1800)
                }
            },
            { threshold: 0.5 }
        )
        if (statsRef.current) observer.observe(statsRef.current)
        return () => observer.disconnect()
    }, [statsAnimated])

    const animateCounter = (key, target, duration) => {
        const start = 0
        const startTime = Date.now()
        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const current = key === 'uptime'
                ? (start + (target - start) * progress).toFixed(1)
                : Math.floor(start + (target - start) * progress)
            setAnimatedStats(prev => ({ ...prev, [key]: current }))
            if (progress < 1) requestAnimationFrame(animate)
        }
        animate()
    }

    const scrollToSection = (id) => {
        const element = document.getElementById(id)
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const CheckIcon = () => (
        <svg className="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
    )

    const CrossIcon = () => (
        <svg className="cross-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
    )

    const features = language === 'id' ? [
        { icon: '🔌', title: 'Unified Multi-Device Control', desc: 'Sentralisasi operasional WhatsApp Anda. Kelola puluhan nomor dan tim CS dalam satu dashboard terintegrasi dengan monitoring real-time.' },
        { icon: '🤖', title: 'Intelligent Auto-Response', desc: 'Otomatisasi layanan pelanggan 24/7 dengan logika keyword canggih, regex pattern matching, dan integrasi database dinamis untuk respons yang personal.' },
        { icon: '🎨', title: 'Enterprise Flow Builder', desc: 'Rancang alur percakapan kompleks dengan antarmuka visual drag-and-drop. Deploy asisten virtual cerdas tanpa memerlukan tim engineering.' },
        { icon: '🧠', title: 'AI-Powered Knowledge Base', desc: 'Transformasi dokumen bisnis Anda menjadi otak AI. Sistem RAG (Retrieval-Augmented Generation) menjawab pertanyaan pelanggan secara akurat dan kontekstual.' },
        { icon: '📢', title: 'High-Performance Broadcast', desc: 'Eksekusi kampanye marketing skala besar dengan penjadwalan presisi, personalisasi dinamis, dan analisis performa kampanye yang mendalam.' },
        { icon: '🔗', title: 'Limitless Integration Ecosystem', desc: 'Hubungkan WhatsApp dengan CRM, ERP, dan ribuan aplikasi lain via Webhook & REST API. Sinkronisasi data bisnis secara seamless.' },
        { icon: '👥', title: 'Start-to-Scale Team Management', desc: 'Sistem hierarki akses bertingkat untuk kolaborasi tim yang efisien. Dilengkapi audit log komprehensif untuk keamanan dan transparansi maksimal.' },
        { icon: '📈', title: 'Advanced Analytics Suite', desc: 'Keputusan berbasis data dengan visualisasi metrik performa. Analisis tren percakapan, efektivitas agen, dan ROI kampanye secara mendetail.' },
    ] : [
        { icon: '🔌', title: 'Unified Multi-Device Control', desc: 'Centralize your WhatsApp operations. Manage dozens of numbers and CS teams in one integrated dashboard with real-time monitoring.' },
        { icon: '🤖', title: 'Intelligent Auto-Response', desc: 'Automate customer service 24/7 with advanced keyword logic, regex pattern matching, and dynamic database integration for personal responses.' },
        { icon: '🎨', title: 'Enterprise Flow Builder', desc: 'Design complex conversation flows with a visual drag-and-drop interface. Deploy smart virtual assistants without needing an engineering team.' },
        { icon: '🧠', title: 'AI-Powered Knowledge Base', desc: 'Transform your business documents into an AI brain. RAG (Retrieval-Augmented Generation) system answers customer queries accurately and contextually.' },
        { icon: '📢', title: 'High-Performance Broadcast', desc: 'Execute large-scale marketing campaigns with precision scheduling, dynamic personalization, and deep campaign performance analysis.' },
        { icon: '🔗', title: 'Limitless Integration Ecosystem', desc: 'Connect WhatsApp with CRM, ERP, and thousands of other apps via Webhook & REST API. Seamless business data synchronization.' },
        { icon: '👥', title: 'Start-to-Scale Team Management', desc: 'Tiered access hierarchy for efficient team collaboration. Equipped with comprehensive audit logs for maximum security and transparency.' },
        { icon: '📈', title: 'Advanced Analytics Suite', desc: 'Data-driven decisions with performance metric visualizations. Analyze conversation trends, agent effectiveness, and campaign ROI in detail.' },
    ]

    const useCases = language === 'id' ? {
        ecommerce: [
            { icon: '📦', title: 'Transaction Automation', desc: 'Notifikasi pesanan & resi otomatis via API' },
            { icon: '🚚', title: 'Real-time Logistics', desc: 'Update status pengiriman instan ke pelanggan' },
            { icon: '🎫', title: 'Retention Marketing', desc: 'Blast promo personalisasi untuk loyal customer' },
            { icon: '💬', title: '24/7 Virtual Assistant', desc: 'Handle FAQ produk & komplain tanpa jeda' },
        ],
        service: [
            { icon: '📅', title: 'Smart Appointment', desc: 'Reminder jadwal & konfirmasi otomatis' },
            { icon: '⭐', title: 'Reputation Management', desc: 'Otomatisasi permintaan ulasan & feedback' },
            { icon: '🔔', title: 'Progress Notifications', desc: 'Update status layanan secara transparan' },
            { icon: '💡', title: 'Customer Onboarding', desc: 'Panduan & edukasi klien secara terprogram' },
        ],
        marketing: [
            { icon: '🎯', title: 'Precision Campaigns', desc: 'Targeting audiens spesifik dengan pesan relevan' },
            { icon: '📊', title: 'Lead Qualification', desc: 'Filter & nurturing prospek secara otomatis' },
            { icon: '🎁', title: 'Loyalty Engine', desc: 'Distribusi rewards & voucher sistematis' },
            { icon: '📣', title: 'Event Engagement', desc: 'Undangan & interaksi peserta webinar/event' },
        ],
    } : {
        ecommerce: [
            { icon: '📦', title: 'Transaction Automation', desc: 'Automated order & receipt notifications via API' },
            { icon: '🚚', title: 'Real-time Logistics', desc: 'Instant delivery status updates for customers' },
            { icon: '🎫', title: 'Retention Marketing', desc: 'Personalized promo blasts for loyal customers' },
            { icon: '💬', title: '24/7 Virtual Assistant', desc: 'Handle product FAQs & complaints without delay' },
        ],
        service: [
            { icon: '📅', title: 'Smart Appointment', desc: 'Automated schedule reminders & confirmations' },
            { icon: '⭐', title: 'Reputation Management', desc: 'Automate review & feedback requests' },
            { icon: '🔔', title: 'Progress Notifications', desc: 'Transparent service status updates' },
            { icon: '💡', title: 'Customer Onboarding', desc: 'Programmed client guides & onboarding' },
        ],
        marketing: [
            { icon: '🎯', title: 'Precision Campaigns', desc: 'Targeting specific audiences with relevant messages' },
            { icon: '📊', title: 'Lead Qualification', desc: 'Automatically filter & nurture leads' },
            { icon: '🎁', title: 'Loyalty Engine', desc: 'Systematic distribution of rewards & vouchers' },
            { icon: '📣', title: 'Event Engagement', desc: 'Webinar/event invitations & participant interaction' },
        ],
    }

    const integrations = ['n8n', 'Make', 'Zapier', 'Google Sheets', 'REST API', 'Webhook', 'CRM', 'E-Commerce']

    const plans = language === 'id' ? [
        { name: 'Free', monthlyPrice: 'Gratis', yearlyPrice: 'Gratis', desc: 'Mulai eksplorasi platform', features: ['1,500 pesan/bulan', '1 Device WhatsApp', '100 Contacts', '5 Auto-Reply Rules', 'Visual Chatbot Builder', 'Message History 7 hari', 'Webhook & API Access', 'Community Support'], warning: '⚠️ Watermark pada pesan', popular: false },
        { name: 'Pro', monthlyPrice: 'Rp 20k', yearlyPrice: 'Rp 200k', desc: 'Untuk bisnis berkembang', features: ['5,000 pesan/bulan', '3 Devices WhatsApp', '5,000 Contacts', 'Unlimited Auto-Reply', 'Smart Knowledge (RAG)', '3 Knowledge Bases', 'Scheduled Broadcast', 'Tanpa Watermark', 'Priority Support'], popular: true },
        { name: 'Enterprise', monthlyPrice: 'Rp 50k', yearlyPrice: 'Rp 500k', desc: 'Untuk organisasi besar', features: ['15,000 pesan/bulan', '10 Devices WhatsApp', '50,000 Contacts', '20 Knowledge Bases', '1,000 RAG Query/bulan', 'Team Management', 'Audit Logs', 'Dedicated Support', 'SLA Guarantee'], popular: false },
        { name: 'Unlimited', monthlyPrice: 'Rp 100k', yearlyPrice: 'Rp 1jt', desc: 'Tanpa batas, penuh kuasa', features: ['∞ Unlimited Messages', '∞ Unlimited Devices', '∞ Unlimited Contacts', '∞ Unlimited RAG Query', 'White-label Branding', 'Custom Domain Ready', '24/7 Priority Support', 'Semua Fitur Premium'], popular: false },
    ] : [
        { name: 'Free', monthlyPrice: '$0', yearlyPrice: '$0', desc: 'Start exploring the platform', features: ['1,500 messages/month', '1 WhatsApp Device', '100 Contacts', '5 Auto-Reply Rules', 'Visual Chatbot Builder', '7-day Message History', 'Webhook & API Access', 'Community Support'], warning: '⚠️ Message Watermark', popular: false },
        { name: 'Pro', monthlyPrice: '$2', yearlyPrice: '$20', desc: 'For growing businesses', features: ['5,000 messages/month', '3 WhatsApp Devices', '5,000 Contacts', 'Unlimited Auto-Reply', 'Smart Knowledge (RAG)', '3 Knowledge Bases', 'Scheduled Broadcast', 'No Watermark', 'Priority Support'], popular: true },
        { name: 'Enterprise', monthlyPrice: '$4', yearlyPrice: '$40', desc: 'For large organizations', features: ['15,000 messages/month', '10 WhatsApp Devices', '50,000 Contacts', '20 Knowledge Bases', '1,000 RAG Queries/month', 'Team Management', 'Audit Logs', 'Dedicated Support', 'SLA Guarantee'], popular: false },
        { name: 'Unlimited', monthlyPrice: '$10', yearlyPrice: '$100', desc: 'No limits, full power', features: ['∞ Unlimited Messages', '∞ Unlimited Devices', '∞ Unlimited Contacts', '∞ Unlimited RAG Queries', 'White-label Branding', 'Custom Domain Ready', '24/7 Priority Support', 'All Premium Features'], popular: false },
    ]

    const faqs = language === 'id' ? [
        { q: 'Apa itu KeWhats?', a: 'KeWhats adalah platform WhatsApp Gateway berbasis cloud (SaaS) yang memungkinkan Anda mengirim pesan otomatis, membuat chatbot cerdas, dan mengintegrasikan WhatsApp dengan sistem bisnis Anda. Tidak perlu setup server — cukup daftar dan langsung pakai.' },
        { q: 'Apakah ada biaya per pesan?', a: 'Tidak ada! Anda hanya membayar subscription bulanan atau tahunan sesuai plan yang dipilih. Tidak ada hidden fee atau biaya per pesan yang dikirim.' },
        { q: 'Apakah nomor WhatsApp aman?', a: 'Ya, KeWhats menggunakan teknologi yang meminimalisir risiko pemblokiran. Kami menerapkan random delay, queue priority, dan rate limiting otomatis sesuai best practice WhatsApp.' },
        { q: 'Bagaimana keamanan data saya?', a: 'Data Anda disimpan di server cloud yang aman dengan enkripsi SSL/TLS end-to-end. Kami mematuhi standar keamanan industri dan tidak pernah membagikan data ke pihak ketiga.' },
        { q: 'Apa itu Smart Knowledge (RAG)?', a: 'Smart Knowledge adalah fitur AI yang memungkinkan chatbot menjawab pertanyaan pelanggan berdasarkan dokumen, FAQ, atau knowledge base yang Anda upload. AI akan mencari dan memberikan jawaban relevan secara otomatis.' },
        { q: 'Bisa upgrade atau downgrade kapan saja?', a: 'Tentu! Anda bisa mengubah plan kapan saja langsung dari dashboard. Perubahan akan berlaku segera dengan penyesuaian kuota dan fitur.' },
    ] : [
        { q: 'What is KeWhats?', a: "KeWhats is a cloud-based WhatsApp Gateway platform (SaaS) that allows you to send automated messages, create smart chatbots, and integrate WhatsApp with your business systems. No server setup required — just sign up and start using." },
        { q: 'Is there a cost per message?', a: "No! You only pay a monthly or yearly subscription based on the plan you choose. There are no hidden fees or costs per message sent." },
        { q: 'Is my WhatsApp number safe?', a: "Yes, KeWhats uses technology to minimize the risk of being blocked. We implement random delays, queue priority, and automatic rate limiting according to WhatsApp best practices." },
        { q: 'How secure is my data?', a: "Your data is stored on secure cloud servers with end-to-end SSL/TLS encryption. We comply with industry security standards and never share data with third parties." },
        { q: 'What is Smart Knowledge (RAG)?', a: "Smart Knowledge is an AI feature that allows chatbots to answer customer questions based on documents, FAQs, or knowledge bases you upload. The AI automatically finds and provides relevant answers." },
        { q: 'Can I upgrade or downgrade anytime?', a: "Of course! You can change your plan anytime directly from the dashboard. Changes will take effect immediately with quota and feature adjustments." },
    ]

    const t = {
        nav: {
            features: language === 'id' ? 'Fitur' : 'Features',
            useCases: language === 'id' ? 'Solusi' : 'Use Cases',
            pricing: language === 'id' ? 'Harga' : 'Pricing',
            faq: language === 'id' ? 'FAQ' : 'FAQ',
            login: language === 'id' ? 'Masuk' : 'Login',
            getStarted: language === 'id' ? 'Mulai Gratis' : 'Get Started'
        },
        hero: {
            badge: language === 'id' ? '✨ Enterprise-Grade WhatsApp Solution' : '✨ Enterprise-Grade WhatsApp Solution',
            title: language === 'id' ? 'Akselerasi Pertumbuhan Bisnis<br />dengan Intelligent WhatsApp Automation' : 'Accelerate Business Growth<br />with Intelligent WhatsApp Automation',
            sub: language === 'id' ? 'Transformasi cara Anda terhubung dengan pelanggan. Platform terpadu untuk broadcast presisi, interaksi AI personal, dan manajemen percakapan skala besar tanpa hambatan.' : 'Transform the way you connect with customers. A unified platform for precision broadcasting, personalized AI interaction, and seamless large-scale conversation management.',
            ctaPrimary: language === 'id' ? '🚀 Mulai Transformasi Sekarang' : '🚀 Start Transformation Now',
            ctaSecondary: language === 'id' ? '💎 Pelajari Solusi' : '💎 Explore Solutions',
            trust: language === 'id' ? ['High-Performance Engine', 'Data Security Guaranteed', '5-Minute Onboarding'] : ['High-Performance Engine', 'Data Security Guaranteed', '5-Minute Onboarding']
        },
        stats: {
            messages: language === 'id' ? 'Pesan/hari' : 'Messages/day',
            integrations: language === 'id' ? 'Integrasi' : 'Integrations',
            uptime: language === 'id' ? 'Uptime' : 'Uptime',
            support: language === 'id' ? 'Dukungan' : 'Support'
        },
        headers: {
            trusted: language === 'id' ? 'Dipercaya oleh Bisnis Indonesia' : 'Trusted by Modern Businesses',
            featuresBadge: language === 'id' ? 'Core Capabilities' : 'Core Capabilities',
            featuresTitle: language === 'id' ? 'Ekosistem Komunikasi Terpadu' : 'Unified Communication Ecosystem',
            featuresDesc: language === 'id' ? 'Direkayasa untuk efisiensi, skalabilitas, dan keandalan tinggi bagi pertumbuhan bisnis Anda.' : 'Engineered for efficiency, scalability, and high reliability for your business growth.',
            howBadge: language === 'id' ? 'Seamless Onboarding' : 'Seamless Onboarding',
            howTitle: language === 'id' ? 'Akselerasi Bisnis dalam Hitungan Menit' : 'Accelerate Business in Minutes',
            howDesc: language === 'id' ? 'Integrasi tanpa hambatan. Mulai transformasi komunikasi pelanggan Anda hari ini.' : 'Seamless integration. Start transforming your customer communication today.',
            useCaseBadge: language === 'id' ? 'Industry Solutions' : 'Industry Solutions',
            useCaseTitle: language === 'id' ? 'Transformasi Digital Lintas Sektor' : 'Cross-Sector Digital Transformation',
            useCaseDesc: language === 'id' ? 'Adaptabilitas tinggi untuk berbagai model bisnis dan kebutuhan operasional.' : 'High adaptability for various business models and operational needs.',
            testimonialsBadge: language === 'id' ? 'Success Stories' : 'Success Stories',
            testimonialsTitle: language === 'id' ? 'Mitra Pertumbuhan Bisnis' : 'Business Growth Partners',
            testimonialsDesc: language === 'id' ? 'Pengalaman nyata dari para visioner bisnis yang telah beralih ke KeWhats.' : 'Real experiences from business visionaries who have switched to KeWhats.',
            integrationsBadge: language === 'id' ? 'Connectivity' : 'Connectivity',
            integrationsTitle: language === 'id' ? 'Terhubung dengan Ekosistem Anda' : 'Connect with Your Ecosystem',
            integrationsDesc: language === 'id' ? 'Sinkronisasi data tanpa batas dengan stack teknologi favorit Anda.' : 'Seamless data synchronization with your favorite technology stack.',
            pricingBadge: language === 'id' ? 'Investment' : 'Investment',
            pricingTitle: language === 'id' ? 'Paket Fleksibel untuk Setiap Tahapan' : 'Flexible Plans for Every Stage',
            pricingDesc: language === 'id' ? 'Investasi cerdas dengan skalabilitas yang mengikuti pertumbuhan bisnis Anda.' : 'Smart investment with scalability that grows with your business.',
            faqTitle: language === 'id' ? 'Pertanyaan Umum' : 'Frequently Asked Questions'
        },
        steps: {
            s1Title: language === 'id' ? 'Connect WhatsApp' : 'Connect WhatsApp',
            s1Desc: language === 'id' ? 'Scan QR code dari dashboard untuk menghubungkan WhatsApp Anda.' : 'Scan the QR code from the dashboard to link your WhatsApp account.',
            s2Title: language === 'id' ? 'Setup Automation' : 'Setup Automation',
            s2Desc: language === 'id' ? 'Atur auto-reply, chatbot, atau webhook sesuai kebutuhan.' : 'Configure auto-reply, chatbots, or webhooks as needed.',
            s3Title: language === 'id' ? 'Launch Automation' : 'Launch Automation',
            s3Desc: language === 'id' ? 'Aktifkan sistem. Biarkan KeWhats menangani interaksi pelanggan secara otonom 24/7.' : 'Activate the system. Let KeWhats handle customer interactions autonomously 24/7.'
        },
        pricing: {
            monthly: language === 'id' ? 'Bulanan' : 'Monthly',
            yearly: language === 'id' ? 'Tahunan' : 'Yearly',
            save: language === 'id' ? 'Hemat 17%' : 'Save 17%',
            free: language === 'id' ? 'Gratis' : 'Free',
            periodMonth: language === 'id' ? '/bulan' : '/month',
            periodYear: language === 'id' ? '/tahun' : '/year',
            mostPopular: language === 'id' ? 'Paling Populer' : 'Most Popular',
            select: language === 'id' ? 'Pilih' : 'Select',
            startFree: language === 'id' ? 'Mulai Gratis' : 'Start for Free'
        },
        compare: {
            title: language === 'id' ? 'Bandingkan Semua Fitur' : 'Compare All Features',
            colFeatures: language === 'id' ? 'Fitur' : 'Features',
            catMessaging: language === 'id' ? '📨 Messaging' : '📨 Messaging',
            rowQuota: language === 'id' ? 'Kuota Pesan/bulan' : 'Message Limit/month',
            rowDevices: language === 'id' ? 'Device WhatsApp' : 'WhatsApp Devices',
            rowHistory: language === 'id' ? 'Message History' : 'Message History',
            valDays: language === 'id' ? 'hari' : 'days',
            catContacts: language === 'id' ? '👥 Contacts' : '👥 Contacts',
            rowContacts: language === 'id' ? 'Jumlah Kontak' : 'Contact Count',
            rowImport: language === 'id' ? 'Import/Export CSV' : 'CSV Import/Export',
            rowTags: language === 'id' ? 'Tags & Labels' : 'Tags & Labels',
            catBroadcast: language === 'id' ? '📢 Broadcast' : '📢 Broadcast',
            rowBroadcast: language === 'id' ? 'Broadcast Messages' : 'Broadcast Messages',
            rowScheduled: language === 'id' ? 'Scheduled Broadcast' : 'Scheduled Broadcast',
            rowAnalytics: language === 'id' ? 'Broadcast Analytics' : 'Broadcast Analytics',
            catAuto: language === 'id' ? '⚡ Auto-Reply' : '⚡ Auto-Reply',
            rowRules: language === 'id' ? 'Auto-Reply Rules' : 'Auto-Reply Rules',
            rowSheets: language === 'id' ? 'Google Sheets Sync' : 'Google Sheets Sync',
            rowRegex: language === 'id' ? 'Regex Matching' : 'Regex Matching',
            catRag: language === 'id' ? '🧠 Smart Knowledge (RAG)' : '🧠 Smart Knowledge (RAG)',
            rowKb: language === 'id' ? 'Knowledge Bases' : 'Knowledge Bases',
            rowQuery: language === 'id' ? 'RAG Query/bulan' : 'RAG Queries/month',
            rowByok: language === 'id' ? 'BYOK (Bring Your Own Key)' : 'BYOK (Bring Your Own Key)',
            catChatbot: language === 'id' ? '🤖 Chatbot Builder' : '🤖 Chatbot Builder',
            rowVisual: language === 'id' ? 'Visual Builder' : 'Visual Builder',
            rowMaxBots: language === 'id' ? 'Max Chatbots' : 'Max Chatbots',
            rowNodeTypes: language === 'id' ? 'All Node Types' : 'All Node Types',
            catInt: language === 'id' ? '🔗 Integrations' : '🔗 Integrations',
            rowApi: language === 'id' ? 'Webhook & API' : 'Webhook & API',
            rowAllInt: language === 'id' ? 'All Integrations' : 'All Integrations',
            rowReports: language === 'id' ? 'Export Reports' : 'Export Reports',
            catSecurity: language === 'id' ? '🔒 Team & Security' : '🔒 Team & Security',
            rowTeam: language === 'id' ? 'Team Management' : 'Team Management',
            rowAudit: language === 'id' ? 'Audit Logs' : 'Audit Logs',
            rowSla: language === 'id' ? 'SLA Guarantee' : 'SLA Guarantee',
            catBranding: language === 'id' ? '🎨 Branding' : '🎨 Branding',
            rowWatermark: language === 'id' ? 'Watermark' : 'Watermark',
            rowWhite: language === 'id' ? 'White-label' : 'White-label',
            rowCustomBrand: language === 'id' ? 'Custom Branding' : 'Custom Branding',
            catSupport: language === 'id' ? '💬 Support' : '💬 Support',
            rowSupportLevel: language === 'id' ? 'Support Level' : 'Support Level',
            valWatermark: language === 'id' ? '⚠️ Ada' : '⚠️ Yes',
            valNoWatermark: language === 'id' ? '✓ Tidak Ada' : '✓ None',
            valHistoryPerm: language === 'id' ? 'Permanen' : 'Permanent',
            valSupportCommunity: language === 'id' ? 'Komunitas' : 'Community',
            valSupportPriority: language === 'id' ? 'Prioritas' : 'Priority',
            valSupportDedicated: language === 'id' ? 'Dedicated' : 'Dedicated'
        },
        cta: {
            title: language === 'id' ? '🚀 Siap Mengotomatisasi Bisnis Anda?' : '🚀 Ready to Automate Your Business?',
            desc: language === 'id' ? 'Bergabung dengan 500+ bisnis yang sudah menghemat waktu dengan KeWhats. Mulai gratis hari ini!' : 'Join 500+ businesses already saving time with KeWhats. Start for free today!',
            button: language === 'id' ? '🎉 Daftar Gratis Sekarang' : '🎉 Register for Free Now',
            trust: language === 'id' ? '✓ Tidak perlu kartu kredit  ✓ Setup dalam 5 menit  ✓ Cancel kapan saja' : '✓ No credit card required  ✓ 5-minute setup  ✓ Cancel anytime',
            ssl: language === 'id' ? 'SSL Encrypted' : 'SSL Encrypted',
            uptime: language === 'id' ? '99.9% Uptime' : '99.9% Uptime',
            whatsappCompliant: language === 'id' ? 'Sesuai Kebijakan WA' : 'WhatsApp Compliant'
        },
        footer: {
            desc: language === 'id' ? 'Infrastruktur komunikasi enterprise-grade untuk otomatisasi bisnis tanpa batas. Skalabel, aman, dan cerdas.' : 'Enterprise-grade communication infrastructure for limitless business automation. Scalable, secure, and intelligent.',
            newsTitle: language === 'id' ? 'Berlangganan' : 'Subscribe',
            newsPlaceholder: language === 'id' ? 'Email Anda...' : 'Your Email...',
            colProduct: language === 'id' ? 'Produk' : 'Product',
            colResources: language === 'id' ? 'Sumber Daya' : 'Resources',
            colLegal: language === 'id' ? 'Legal' : 'Legal',
            copy: language === 'id' ? '© 2026 KeWhats. Hak cipta dilindungi.' : '© 2026 KeWhats. All rights reserved.'
        }
    }

    return (
        <div className="lp">
            <style>{`
                .lp { font-family: 'Inter', -apple-system, sans-serif; background: #0a0f1a; color: #f8fafc; line-height: 1.6; overflow-x: hidden; }
                
                /* Navbar */
                .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 1rem 2rem; background: rgba(10, 15, 26, 0.9); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(148, 163, 184, 0.1); transition: all 0.3s; }
                .lp-nav.scrolled { padding: 0.75rem 2rem; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3); }
                .lp-nav-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
                .lp-logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit; }
                .lp-logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .lp-logo-icon svg { width: 24px; height: 24px; color: white; }
                .lp-logo-text { font-weight: 700; font-size: 1.25rem; }
                .lp-nav-links { display: flex; gap: 2rem; }
                .lp-nav-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; cursor: pointer; }
                .lp-nav-link:hover { color: #25D366; }
                .lp-nav-cta { display: flex; gap: 1rem; }
                
                /* Buttons */
                .lp-btn { padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.3s; border: none; cursor: pointer; }
                .lp-btn-primary { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3); }
                .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 25px rgba(37, 211, 102, 0.4); }
                .lp-btn-secondary { background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); }
                .lp-btn-secondary:hover { background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.3); }
                
                /* Hero */
                .lp-hero { padding: 10rem 2rem 6rem; text-align: center; position: relative; overflow: hidden; }
                .lp-hero::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 150%; height: 100%; background: radial-gradient(ellipse at center top, rgba(37, 211, 102, 0.15) 0%, transparent 60%); pointer-events: none; }
                .lp-hero-badge { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(37, 211, 102, 0.1); border: 1px solid rgba(37, 211, 102, 0.3); padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.85rem; color: #25D366; margin-bottom: 2rem; }
                .lp-hero h1 { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 800; margin-bottom: 1.5rem; line-height: 1.1; background: linear-gradient(135deg, #fff 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .lp-hero-sub { font-size: 1.2rem; color: #94a3b8; max-width: 700px; margin: 0 auto 2.5rem; }
                .lp-hero-cta { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 3rem; }
                .lp-hero-trust { display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; color: #64748b; font-size: 0.9rem; }
                .lp-hero-trust span { display: flex; align-items: center; gap: 0.5rem; }
                
                /* Language Switcher */
                .lp-lang-switcher { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem; }
                .lp-lang-btn { padding: 0.5rem 1.25rem; border-radius: 100px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.3s; border: 1px solid rgba(148, 163, 184, 0.2); background: rgba(255, 255, 255, 0.05); color: #94a3b8; display: flex; align-items: center; gap: 0.5rem; }
                .lp-lang-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(148, 163, 184, 0.3); }
                .lp-lang-btn.active { background: rgba(37, 211, 102, 0.15); border-color: rgba(37, 211, 102, 0.4); color: #25D366; }
                .lp-lang-btn .flag { font-size: 1.1rem; }
                
                /* Stats */
                .lp-stats { padding: 4rem 2rem; background: rgba(17, 24, 39, 0.5); border-top: 1px solid rgba(148, 163, 184, 0.1); border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
                .lp-stats-inner { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; text-align: center; }
                .lp-stat-num { font-size: 2.5rem; font-weight: 800; color: #25D366; margin-bottom: 0.25rem; }
                .lp-stat-label { color: #94a3b8; font-size: 0.9rem; }
                
                /* Section Common */
                .lp-section { padding: 6rem 2rem; }
                .lp-section-header { text-align: center; max-width: 700px; margin: 0 auto 4rem; }
                .lp-section-badge { display: inline-block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #25D366; margin-bottom: 1rem; }
                .lp-section-title { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 700; margin-bottom: 1rem; }
                .lp-section-desc { font-size: 1.1rem; color: #94a3b8; }
                
                /* Features */
                .lp-features { background: linear-gradient(180deg, #0a0f1a 0%, #111827 100%); }
                .lp-features-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
                .lp-feature-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 16px; padding: 2rem; transition: all 0.3s; }
                .lp-feature-card:hover { transform: translateY(-5px); border-color: rgba(37, 211, 102, 0.3); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); }
                .lp-feature-icon { font-size: 2.5rem; margin-bottom: 1rem; }
                .lp-feature-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
                .lp-feature-desc { color: #94a3b8; font-size: 0.9rem; line-height: 1.6; }
                
                /* How It Works */
                .lp-how { background: #0a0f1a; }
                .lp-steps { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; }
                .lp-step { text-align: center; }
                .lp-step-num { width: 64px; height: 64px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; margin: 0 auto 1.5rem; box-shadow: 0 0 30px rgba(37, 211, 102, 0.3); }
                .lp-step-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
                .lp-step-desc { color: #94a3b8; font-size: 0.9rem; }
                
                /* Use Cases */
                .lp-usecases { background: linear-gradient(180deg, #111827 0%, #0a0f1a 100%); }
                .lp-tabs { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 3rem; flex-wrap: wrap; }
                .lp-tab { padding: 0.75rem 1.5rem; border-radius: 100px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; cursor: pointer; transition: all 0.3s; font-size: 0.9rem; }
                .lp-tab.active { background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25D366; }
                .lp-usecase-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
                .lp-usecase-card { background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 12px; padding: 1.5rem; display: flex; align-items: flex-start; gap: 1rem; }
                .lp-usecase-icon { font-size: 2rem; }
                .lp-usecase-title { font-weight: 600; margin-bottom: 0.25rem; }
                .lp-usecase-desc { color: #94a3b8; font-size: 0.85rem; }
                
                /* Integrations */
                .lp-integrations { background: #0a0f1a; }
                .lp-int-grid { max-width: 800px; margin: 0 auto; display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; }
                .lp-int-badge { padding: 1rem 2rem; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 12px; font-weight: 500; transition: all 0.3s; }
                .lp-int-badge:hover { border-color: rgba(37, 211, 102, 0.3); transform: translateY(-3px); }
                
                /* Pricing */
                .lp-pricing { background: linear-gradient(180deg, #0a0f1a 0%, #111827 100%); }
                .lp-pricing-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
                .lp-price-card { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 20px; padding: 2rem; text-align: center; position: relative; display: flex; flex-direction: column; transition: all 0.3s; }
                .lp-price-card.popular { background: rgba(37, 211, 102, 0.05); border-color: rgba(37, 211, 102, 0.3); transform: scale(1.02); }
                .lp-price-card:hover { transform: translateY(-10px); border-color: rgba(37, 211, 102, 0.3); }
                .lp-price-card.popular:hover { transform: scale(1.02) translateY(-10px); }
                .lp-price-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #25D366, #128C7E); color: white; padding: 0.25rem 1rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
                .lp-price-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .lp-price-amount { font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem; }
                .lp-price-amount span { font-size: 0.9rem; color: #94a3b8; font-weight: 500; }
                .lp-price-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem; }
                .lp-price-features { list-style: none; padding: 0; margin: 0 0 1.5rem; text-align: left; flex-grow: 1; }
                .lp-price-feature { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.6rem; font-size: 0.8rem; color: #cbd5e1; }
                .lp-price-feature.warning { color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 0.4rem; border-radius: 6px; }
                .check-icon { width: 16px; height: 16px; color: #25D366; flex-shrink: 0; }
                .cross-icon { width: 16px; height: 16px; color: #ef4444; flex-shrink: 0; }
                
                /* Feature Comparison Table */
                .lp-compare-section { margin-top: 4rem; padding-top: 3rem; border-top: 1px solid rgba(148, 163, 184, 0.1); }
                .lp-compare-title { text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem; color: #f8fafc; }
                .lp-compare-table-wrapper { max-width: 1100px; margin: 0 auto; overflow-x: auto; border-radius: 16px; background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(148, 163, 184, 0.1); }
                .lp-compare-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .lp-compare-table thead { background: rgba(17, 24, 39, 0.8); position: sticky; top: 0; }
                .lp-compare-table th { padding: 1rem; text-align: center; font-weight: 600; color: #f8fafc; border-bottom: 2px solid rgba(37, 211, 102, 0.3); }
                .lp-compare-table th:first-child { text-align: left; min-width: 200px; }
                .lp-compare-table th.highlight { background: rgba(37, 211, 102, 0.15); color: #25D366; }
                .lp-compare-table td { padding: 0.75rem 1rem; text-align: center; border-bottom: 1px solid rgba(148, 163, 184, 0.08); color: #cbd5e1; }
                .lp-compare-table td:first-child { text-align: left; font-weight: 500; color: #f8fafc; }
                .lp-compare-table td.highlight { background: rgba(37, 211, 102, 0.05); }
                .lp-compare-table tr:hover td { background: rgba(37, 211, 102, 0.03); }
                .lp-compare-table tr.category-row td { background: rgba(17, 24, 39, 0.6); font-weight: 700; color: #f8fafc; font-size: 0.9rem; padding: 1rem; text-align: left; }
                .lp-compare-table .warning-cell { color: #fbbf24; }
                .lp-compare-table .success-cell { color: #25D366; }
                .lp-compare-table .check-icon { margin: 0 auto; display: block; }
                .lp-compare-table .cross-icon { margin: 0 auto; display: block; }
                
                /* FAQ */
                .lp-faq { background: #0a0f1a; }
                .lp-faq-list { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; align-items: start; }
                .lp-faq-item { border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 12px; overflow: hidden; height: fit-content; }
                .lp-faq-q { padding: 1.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 500; transition: background 0.3s; min-height: 80px; }
                .lp-faq-q h3 { font-size: 1rem; margin: 0; line-height: 1.5; padding-right: 1rem; }
                .lp-faq-q:hover { background: rgba(37, 211, 102, 0.05); }
                .lp-faq-q svg { width: 24px; height: 24px; color: #94a3b8; transition: transform 0.3s; flex-shrink: 0; }
                .lp-faq-q.open svg { transform: rotate(180deg); color: #25D366; }
                .lp-faq-a { padding: 0 1.5rem 1.5rem; color: #94a3b8; font-size: 0.95rem; line-height: 1.7; border-top: 1px solid rgba(148, 163, 184, 0.05); }
                
                /* CTA */
                .lp-cta { padding: 6rem 2rem; background: linear-gradient(180deg, #111827 0%, #0a0f1a 100%); text-align: center; }
                .lp-cta-box { max-width: 700px; margin: 0 auto; padding: 4rem; background: linear-gradient(135deg, rgba(37, 211, 102, 0.1) 0%, rgba(18, 140, 126, 0.05) 100%); border: 1px solid rgba(37, 211, 102, 0.2); border-radius: 24px; }
                .lp-cta h2 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
                .lp-cta p { color: #94a3b8; margin-bottom: 2rem; }
                .lp-cta-trust { color: #64748b; font-size: 0.9rem; margin-top: 1.5rem; }
                
                /* Footer */
                .lp-footer { padding: 4rem 2rem 2rem; background: #050810; border-top: 1px solid rgba(148, 163, 184, 0.1); }
                .lp-footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr repeat(3, 1fr); gap: 3rem; }
                .lp-footer-brand p { color: #64748b; font-size: 0.9rem; margin-top: 1rem; }
                .lp-footer-col h4 { font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; color: #f8fafc; }
                .lp-footer-links { list-style: none; padding: 0; margin: 0; }
                .lp-footer-links li { margin-bottom: 0.5rem; }
                .lp-footer-links a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
                .lp-footer-links a:hover { color: #25D366; }
                .lp-footer-bottom { max-width: 1200px; margin: 3rem auto 0; padding-top: 2rem; border-top: 1px solid rgba(148, 163, 184, 0.1); text-align: center; color: #64748b; font-size: 0.85rem; }
                
                /* Responsive */
                @media (max-width: 1024px) { .lp-pricing-grid { grid-template-columns: repeat(2, 1fr); } .lp-compare-table { font-size: 0.75rem; } }
                @media (max-width: 768px) {
                    .lp-nav-links, .lp-nav-cta { display: none; }
                    .lp-mobile-toggle { display: flex; }
                    .lp-stats-inner { grid-template-columns: repeat(2, 1fr); }
                    .lp-steps { grid-template-columns: 1fr; gap: 2rem; }
                    .lp-usecase-grid { grid-template-columns: 1fr; }
                    .lp-pricing-grid { grid-template-columns: 1fr; }
                    .lp-footer-inner { grid-template-columns: 1fr; text-align: center; }
                    .lp-hero-content { flex-direction: column; text-align: center; }
                    .lp-testimonials-grid { grid-template-columns: 1fr; }
                    .lp-compare-table-wrapper { margin: 0 -1rem; border-radius: 0; }
                    .lp-compare-table { font-size: 0.7rem; }
                    .lp-compare-table th, .lp-compare-table td { padding: 0.5rem; }
                    .lp-compare-table th:first-child { min-width: 120px; }
                    .lp-faq-list { grid-template-columns: 1fr; }
                }

                /* Mobile Menu */
                .lp-mobile-toggle { display: none; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; cursor: pointer; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
                .lp-mobile-toggle span { width: 20px; height: 2px; background: #fff; transition: all 0.3s; }
                .lp-mobile-toggle.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
                .lp-mobile-toggle.open span:nth-child(2) { opacity: 0; }
                .lp-mobile-toggle.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
                .lp-mobile-menu { position: fixed; top: 70px; left: 0; right: 0; background: rgba(10,15,26,0.98); backdrop-filter: blur(20px); padding: 2rem; display: flex; flex-direction: column; gap: 1rem; transform: translateY(-100%); opacity: 0; transition: all 0.3s; z-index: 999; border-bottom: 1px solid rgba(148,163,184,0.1); }
                .lp-mobile-menu.open { transform: translateY(0); opacity: 1; }
                .lp-mobile-menu a, .lp-mobile-menu span { color: #f8fafc; text-decoration: none; padding: 0.75rem; font-size: 1rem; cursor: pointer; border-radius: 8px; transition: background 0.2s; }
                .lp-mobile-menu a:hover, .lp-mobile-menu span:hover { background: rgba(37,211,102,0.1); }

                /* Trusted By */
                .lp-trusted { padding: 3rem 2rem; background: rgba(17,24,39,0.3); }
                .lp-trusted-inner { max-width: 1000px; margin: 0 auto; text-align: center; }
                .lp-trusted-label { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.1em; }
                .lp-trusted-logos { display: flex; justify-content: center; align-items: center; gap: 3rem; flex-wrap: wrap; opacity: 0.6; }
                .lp-trusted-logo { font-size: 1.2rem; font-weight: 600; color: #94a3b8; padding: 0.75rem 1.5rem; background: rgba(30,41,59,0.3); border-radius: 8px; }

                /* Testimonials */
                .lp-testimonials { background: linear-gradient(180deg, #0a0f1a 0%, #111827 100%); }
                .lp-testimonials-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
                .lp-testimonial-card { background: rgba(30,41,59,0.4); border: 1px solid rgba(148,163,184,0.1); border-radius: 16px; padding: 2rem; transition: all 0.3s; }
                .lp-testimonial-card:hover { border-color: rgba(37,211,102,0.3); transform: translateY(-5px); }
                .lp-testimonial-quote { font-size: 1rem; color: #cbd5e1; line-height: 1.7; margin-bottom: 1.5rem; font-style: italic; }
                .lp-testimonial-author { display: flex; align-items: center; gap: 1rem; }
                .lp-testimonial-avatar { width: 48px; height: 48px; background: linear-gradient(135deg, #25D366, #128C7E); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                .lp-testimonial-info h4 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.25rem; }
                .lp-testimonial-info span { font-size: 0.8rem; color: #64748b; }

                /* Billing Toggle */
                .lp-billing-toggle { display: flex; justify-content: center; gap: 1rem; align-items: center; margin-bottom: 3rem; }
                .lp-toggle-btn { padding: 0.75rem 1.5rem; border-radius: 100px; font-size: 0.9rem; cursor: pointer; transition: all 0.3s; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; }
                .lp-toggle-btn.active { background: linear-gradient(135deg, #25D366, #128C7E); color: white; border-color: transparent; }
                .lp-toggle-save { background: rgba(251,191,36,0.1); color: #fbbf24; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 600; }

                /* Newsletter */
                .lp-newsletter { display: flex; gap: 0.75rem; margin-top: 1.5rem; max-width: 400px; }
                .lp-newsletter input { flex: 1; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(148,163,184,0.2); background: rgba(30,41,59,0.5); color: #f8fafc; font-size: 0.9rem; }
                .lp-newsletter input:focus { outline: none; border-color: #25D366; }
                .lp-newsletter button { padding: 0.75rem 1.25rem; border-radius: 8px; background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none; cursor: pointer; font-weight: 600; transition: all 0.3s; }
                .lp-newsletter button:hover { transform: translateY(-2px); }

                /* Trust Badges */
                .lp-trust-badges { display: flex; justify-content: center; gap: 2rem; margin-top: 2rem; flex-wrap: wrap; }
                .lp-trust-badge { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.85rem; padding: 0.5rem 1rem; background: rgba(30,41,59,0.3); border-radius: 8px; }
                .lp-trust-badge svg { width: 18px; height: 18px; color: #25D366; }

                /* Fade In Animation */
                .lp-fade-in { opacity: 0; transform: translateY(30px); animation: lpFadeIn 0.6s ease forwards; }
                @keyframes lpFadeIn { to { opacity: 1; transform: translateY(0); } }
                .lp-section:nth-child(1) { animation-delay: 0s; }
                .lp-section:nth-child(2) { animation-delay: 0.1s; }
                .lp-section:nth-child(3) { animation-delay: 0.2s; }
            `}</style>

            {/* Navbar */}
            <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
                <div className="lp-nav-inner">
                    <a href="/" className="lp-logo">
                        <div className="lp-logo-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
                        </div>
                        <span className="lp-logo-text">KeWhats</span>
                    </a>
                    <div className="lp-nav-links">
                        <span className="lp-nav-link" onClick={() => scrollToSection('features')}>{t.nav.features}</span>
                        <span className="lp-nav-link" onClick={() => scrollToSection('usecases')}>{t.nav.useCases}</span>
                        <span className="lp-nav-link" onClick={() => scrollToSection('pricing')}>{t.nav.pricing}</span>
                        <span className="lp-nav-link" onClick={() => scrollToSection('faq')}>{t.nav.faq}</span>
                    </div>
                    <div className="lp-nav-cta">
                        <a href="/login" className="lp-btn lp-btn-secondary">{t.nav.login}</a>
                        <a href="/register" className="lp-btn lp-btn-primary">{t.nav.getStarted}</a>
                    </div>
                    {/* Mobile Menu Toggle */}
                    <button className={`lp-mobile-toggle ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        <span></span><span></span><span></span>
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            <div className={`lp-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
                <span onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }}>{t.nav.features}</span>
                <span onClick={() => { scrollToSection('usecases'); setMobileMenuOpen(false); }}>{t.nav.useCases}</span>
                <span onClick={() => { scrollToSection('pricing'); setMobileMenuOpen(false); }}>{t.nav.pricing}</span>
                <span onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }}>{t.nav.faq}</span>
                <a href="/login" onClick={() => setMobileMenuOpen(false)}>{t.nav.login}</a>
                <a href="/register" className="lp-btn lp-btn-primary" onClick={() => setMobileMenuOpen(false)}>{t.nav.getStarted}</a>
            </div>

            {/* Hero */}
            <section className="lp-hero">
                {/* Language Switcher */}
                <div className="lp-lang-switcher">
                    <button
                        className={`lp-lang-btn ${language === 'id' ? 'active' : ''}`}
                        onClick={() => setLanguage('id')}
                    >
                        Indonesia
                    </button>
                    <button
                        className={`lp-lang-btn ${language === 'en' ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                    >
                        English
                    </button>
                </div>
                <div className="lp-hero-badge">{t.hero.badge}</div>
                <h1 dangerouslySetInnerHTML={{ __html: t.hero.title }}></h1>
                <p className="lp-hero-sub">{t.hero.sub}</p>
                <div className="lp-hero-cta">
                    <a href="/register" className="lp-btn lp-btn-primary">{t.hero.ctaPrimary}</a>
                    <a href="#pricing" className="lp-btn lp-btn-secondary">{t.hero.ctaSecondary}</a>
                </div>
                <div className="lp-hero-trust">
                    {t.hero.trust.map((item, i) => <span key={i}>✓ {item}</span>)}
                </div>
            </section>

            {/* Stats */}
            <section className="lp-stats" ref={statsRef}>
                <div className="lp-stats-inner">
                    <div><div className="lp-stat-num">{animatedStats.messages.toLocaleString()}+</div><div className="lp-stat-label">{t.stats.messages}</div></div>
                    <div><div className="lp-stat-num">{animatedStats.integrations}+</div><div className="lp-stat-label">{t.stats.integrations}</div></div>
                    <div><div className="lp-stat-num">{animatedStats.uptime}%</div><div className="lp-stat-label">{t.stats.uptime}</div></div>
                    <div><div className="lp-stat-num">24/7</div><div className="lp-stat-label">{t.stats.support}</div></div>
                </div>
            </section>

            {/* Trusted By */}
            <section className="lp-trusted">
                <div className="lp-trusted-inner">
                    <div className="lp-trusted-label">{t.headers.trusted}</div>
                    <div className="lp-trusted-logos">
                        {trustedBy.map((name, i) => (
                            <div className="lp-trusted-logo" key={i}>{name}</div>
                        ))}
                    </div>
                </div>
            </section>
            {/* Features */}
            <section className="lp-section lp-features" id="features">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.featuresBadge}</span>
                    <h2 className="lp-section-title">{t.headers.featuresTitle}</h2>
                    <p className="lp-section-desc">{t.headers.featuresDesc}</p>
                </div>
                <div className="lp-features-grid">
                    {features.map((f, i) => (
                        <div className="lp-feature-card" key={i}>
                            <div className="lp-feature-icon">{f.icon}</div>
                            <h3 className="lp-feature-title">{f.title}</h3>
                            <p className="lp-feature-desc">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="lp-section lp-how">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.howBadge}</span>
                    <h2 className="lp-section-title">{t.headers.howTitle}</h2>
                    <p className="lp-section-desc">{t.headers.howDesc}</p>
                </div>
                <div className="lp-steps">
                    <div className="lp-step">
                        <div className="lp-step-num">1</div>
                        <h3 className="lp-step-title">{t.steps.s1Title}</h3>
                        <p className="lp-step-desc">{t.steps.s1Desc}</p>
                    </div>
                    <div className="lp-step">
                        <div className="lp-step-num">2</div>
                        <h3 className="lp-step-title">{t.steps.s2Title}</h3>
                        <p className="lp-step-desc">{t.steps.s2Desc}</p>
                    </div>
                    <div className="lp-step">
                        <div className="lp-step-num">3</div>
                        <h3 className="lp-step-title">{t.steps.s3Title}</h3>
                        <p className="lp-step-desc">{t.steps.s3Desc}</p>
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="lp-section lp-usecases" id="usecases">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.useCaseBadge}</span>
                    <h2 className="lp-section-title">{t.headers.useCaseTitle}</h2>
                    <p className="lp-section-desc">{t.headers.useCaseDesc}</p>
                </div>
                <div className="lp-tabs">
                    <div className={`lp-tab ${activeTab === 'ecommerce' ? 'active' : ''}`} onClick={() => setActiveTab('ecommerce')}>E-Commerce</div>
                    <div className={`lp-tab ${activeTab === 'service' ? 'active' : ''}`} onClick={() => setActiveTab('service')}>Service</div>
                    <div className={`lp-tab ${activeTab === 'marketing' ? 'active' : ''}`} onClick={() => setActiveTab('marketing')}>Marketing</div>
                </div>
                <div className="lp-usecase-grid">
                    {useCases[activeTab].map((u, i) => (
                        <div className="lp-usecase-card" key={i}>
                            <div className="lp-usecase-icon">{u.icon}</div>
                            <div>
                                <div className="lp-usecase-title">{u.title}</div>
                                <div className="lp-usecase-desc">{u.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Testimonials */}
            <section className="lp-section lp-testimonials" id="testimonials">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.testimonialsBadge}</span>
                    <h2 className="lp-section-title">{t.headers.testimonialsTitle}</h2>
                    <p className="lp-section-desc">{t.headers.testimonialsDesc}</p>
                </div>
                <div className="lp-testimonials-grid">
                    {testimonials.map((t, i) => (
                        <div className="lp-testimonial-card" key={i}>
                            <p className="lp-testimonial-quote">"{t.quote}"</p>
                            <div className="lp-testimonial-author">
                                <div className="lp-testimonial-avatar">{t.avatar}</div>
                                <div className="lp-testimonial-info">
                                    <h4>{t.name}</h4>
                                    <span>{t.role}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Integrations */}
            <section className="lp-section lp-integrations">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.integrationsBadge}</span>
                    <h2 className="lp-section-title">{t.headers.integrationsTitle}</h2>
                    <p className="lp-section-desc">{t.headers.integrationsDesc}</p>
                </div>
                <div className="lp-int-grid">
                    {integrations.map((int, i) => <div className="lp-int-badge" key={i}>{int}</div>)}
                </div>
            </section>

            {/* Pricing */}
            <section className="lp-section lp-pricing" id="pricing">
                <div className="lp-section-header">
                    <span className="lp-section-badge">{t.headers.pricingBadge}</span>
                    <h2 className="lp-section-title">{t.headers.pricingTitle}</h2>
                    <p className="lp-section-desc">{t.headers.pricingDesc}</p>
                </div>
                {/* Billing Toggle */}
                <div className="lp-billing-toggle">
                    <button className={`lp-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`} onClick={() => setBillingCycle('monthly')}>{t.pricing.monthly}</button>
                    <button className={`lp-toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`} onClick={() => setBillingCycle('yearly')}>{t.pricing.yearly}</button>
                    {billingCycle === 'yearly' && <span className="lp-toggle-save">{t.pricing.save}</span>}
                </div>
                <div className="lp-pricing-grid">
                    {plans.map((plan, i) => {
                        const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
                        const period = billingCycle === 'yearly' ? t.pricing.periodYear : t.pricing.periodMonth
                        return (
                            <div className={`lp-price-card ${plan.popular ? 'popular' : ''}`} key={i}>
                                {plan.popular && <div className="lp-price-badge">{t.pricing.mostPopular}</div>}
                                <div className="lp-price-name">{plan.name}</div>
                                <div className="lp-price-amount">{price}{price !== t.pricing.free && <span>{period}</span>}</div>
                                <div className="lp-price-desc">{plan.desc}</div>
                                <ul className="lp-price-features">
                                    {plan.features.map((f, j) => (
                                        <li className="lp-price-feature" key={j}><CheckIcon /> {f}</li>
                                    ))}
                                    {plan.warning && <li className="lp-price-feature warning">{plan.warning}</li>}
                                </ul>
                                <a href="/register" className={`lp-btn ${plan.popular ? 'lp-btn-primary' : 'lp-btn-secondary'}`}>
                                    {plan.name === 'Free' ? t.pricing.startFree : `${t.pricing.select} ${plan.name}`}
                                </a>
                            </div>
                        )
                    })}
                </div>

                {/* Feature Comparison Table */}
                <div className="lp-compare-section">
                    <h3 className="lp-compare-title">{t.compare.title}</h3>
                    <div className="lp-compare-table-wrapper">
                        <table className="lp-compare-table">
                            <thead>
                                <tr>
                                    <th>{t.compare.colFeatures}</th>
                                    <th>Free</th>
                                    <th className="highlight">Pro</th>
                                    <th>Enterprise</th>
                                    <th>Unlimited</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Messaging */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catMessaging}</td></tr>
                                <tr><td>{t.compare.rowQuota}</td><td>1,500</td><td className="highlight">5,000</td><td>15,000</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowDevices}</td><td>1</td><td className="highlight">3</td><td>10</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowHistory}</td><td>7 {t.compare.valDays}</td><td className="highlight">{t.compare.valHistoryPerm}</td><td>{t.compare.valHistoryPerm}</td><td>{t.compare.valHistoryPerm}</td></tr>

                                {/* Contacts */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catContacts}</td></tr>
                                <tr><td>{t.compare.rowContacts}</td><td>100</td><td className="highlight">5,000</td><td>50,000</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowImport}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowTags}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Broadcast */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catBroadcast}</td></tr>
                                <tr><td>{t.compare.rowBroadcast}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowScheduled}</td><td><CrossIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowAnalytics}</td><td><CrossIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Auto-Reply */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catAuto}</td></tr>
                                <tr><td>{t.compare.rowRules}</td><td>5 rules</td><td className="highlight">Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
                                <tr><td>{t.compare.rowSheets}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowRegex}</td><td><CrossIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Smart Knowledge */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catRag}</td></tr>
                                <tr><td>{t.compare.rowKb}</td><td><CrossIcon /></td><td className="highlight">3</td><td>20</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowQuery}</td><td><CrossIcon /></td><td className="highlight">50</td><td>1,000</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowByok}</td><td><CrossIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Chatbot */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catChatbot}</td></tr>
                                <tr><td>{t.compare.rowVisual}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowMaxBots}</td><td>2</td><td className="highlight">5</td><td>10</td><td>∞ Unlimited</td></tr>
                                <tr><td>{t.compare.rowNodeTypes}</td><td>Basic</td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Integrations */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catInt}</td></tr>
                                <tr><td>{t.compare.rowApi}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowAllInt}</td><td><CheckIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowReports}</td><td><CrossIcon /></td><td className="highlight"><CheckIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Team & Security */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catSecurity}</td></tr>
                                <tr><td>{t.compare.rowTeam}</td><td><CrossIcon /></td><td className="highlight"><CrossIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowAudit}</td><td><CrossIcon /></td><td className="highlight"><CrossIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowSla}</td><td><CrossIcon /></td><td className="highlight"><CrossIcon /></td><td><CheckIcon /></td><td><CheckIcon /></td></tr>

                                {/* Branding */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catBranding}</td></tr>
                                <tr><td>{t.compare.rowWatermark}</td><td className="warning-cell">{t.compare.valWatermark}</td><td className="highlight success-cell">{t.compare.valNoWatermark}</td><td className="success-cell">{t.compare.valNoWatermark}</td><td className="success-cell">{t.compare.valNoWatermark}</td></tr>
                                <tr><td>{t.compare.rowWhite}</td><td><CrossIcon /></td><td className="highlight"><CrossIcon /></td><td><CrossIcon /></td><td><CheckIcon /></td></tr>
                                <tr><td>{t.compare.rowCustomBrand}</td><td><CrossIcon /></td><td className="highlight"><CrossIcon /></td><td><CrossIcon /></td><td><CheckIcon /></td></tr>

                                {/* Support */}
                                <tr className="category-row"><td colSpan="5">{t.compare.catSupport}</td></tr>
                                <tr><td>{t.compare.rowSupportLevel}</td><td>{t.compare.valSupportCommunity}</td><td className="highlight">{t.compare.valSupportPriority}</td><td>{t.compare.valSupportDedicated}</td><td>24/7 Priority</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="lp-section lp-faq" id="faq">
                <div className="lp-section-header">
                    <span className="lp-section-badge">FAQ</span>
                    <h2 className="lp-section-title">{t.headers.faqTitle}</h2>
                </div>
                <div className="lp-faq-list">
                    {faqs.map((faq, i) => (
                        <div className="lp-faq-item" key={i}>
                            <div className={`lp-faq-q ${openFaq === i ? 'open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                <h3>{faq.q}</h3>
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {openFaq === i && <div className="lp-faq-a">{faq.a}</div>}
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="lp-cta">
                <div className="lp-cta-box">
                    <h2>{t.cta.title}</h2>
                    <p>{t.cta.desc}</p>
                    <a href="/register" className="lp-btn lp-btn-primary">{t.cta.button}</a>
                    <div className="lp-cta-trust">{t.cta.trust}</div>
                    {/* Trust Badges */}
                    <div className="lp-trust-badges">
                        <div className="lp-trust-badge">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            {t.cta.ssl}
                        </div>
                        <div className="lp-trust-badge">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {t.cta.uptime}
                        </div>
                        <div className="lp-trust-badge">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            {t.cta.whatsappCompliant}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="lp-footer">
                <div className="lp-footer-inner">
                    <div className="lp-footer-brand">
                        <a href="/" className="lp-logo">
                            <div className="lp-logo-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
                            </div>
                            <span className="lp-logo-text">KeWhats</span>
                        </a>
                        <p>{t.footer.desc}</p>
                        {/* Newsletter */}
                        <div className="lp-newsletter">
                            <input type="email" placeholder={t.footer.newsPlaceholder} />
                            <button>{t.footer.newsTitle}</button>
                        </div>
                    </div>
                    <div className="lp-footer-col">
                        <h4>{t.footer.colProduct}</h4>
                        <ul className="lp-footer-links">
                            <li><a href="#features">{t.nav.features}</a></li>
                            <li><a href="#pricing">{t.nav.pricing}</a></li>
                            <li><a href="#usecases">{t.nav.useCases}</a></li>
                        </ul>
                    </div>
                    <div className="lp-footer-col">
                        <h4>{t.footer.colResources}</h4>
                        <ul className="lp-footer-links">
                            <li><a href="https://kewhats-docs.vercel.app/" target="_blank" rel="noopener noreferrer">Documentation</a></li>
                            <li><a href="/api">API Reference</a></li>
                            <li><a href="#faq">{t.nav.faq}</a></li>
                        </ul>
                    </div>
                    <div className="lp-footer-col">
                        <h4>{t.footer.colLegal}</h4>
                        <ul className="lp-footer-links">
                            <li><a href="/terms">Terms of Service</a></li>
                            <li><a href="/privacy">Privacy Policy</a></li>
                        </ul>
                    </div>
                </div>
                <div className="lp-footer-bottom">{t.footer.copy}</div>
            </footer>
        </div>
    )
}
