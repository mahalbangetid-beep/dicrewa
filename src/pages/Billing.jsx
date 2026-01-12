import { useState, useEffect } from 'react';
import {
    CreditCard,
    Check,
    Crown,
    Zap,
    Star,
    Rocket,
    Loader,
    FileText,
    Calendar,
    Download,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    X,
    Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { API_URL } from '../utils/config';
import { useConfirm } from '../components/ConfirmDialog';

// Format currency
const formatPrice = (amount, lang, planName, billingCycle) => {
    if (lang === 'en') {
        const usdPrices = {
            free: { monthly: 0, yearly: 0 },
            pro: { monthly: 2, yearly: 20 },
            enterprise: { monthly: 4, yearly: 40 },
            unlimited: { monthly: 10, yearly: 100 }
        };
        const price = usdPrices[planName.toLowerCase()]?.[billingCycle] ?? 0;
        return `$${price}`;
    }
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const formatInvoiceCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Plan icons
const planIcons = {
    free: Star,
    pro: Zap,
    enterprise: Rocket,
    unlimited: Crown
};

// Invoice status badge
const getStatusBadge = (status) => {
    switch (status) {
        case 'paid':
            return <span className="badge badge-success"><CheckCircle size={12} /> Paid</span>;
        case 'pending':
            return <span className="badge badge-warning"><Clock size={12} /> Pending</span>;
        case 'failed':
            return <span className="badge badge-error"><XCircle size={12} /> Failed</span>;
        case 'expired':
            return <span className="badge badge-neutral"><AlertCircle size={12} /> Expired</span>;
        default:
            return <span className="badge badge-neutral">{status}</span>;
    }
};

export default function Billing() {
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [subscription, setSubscription] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [upgrading, setUpgrading] = useState(false);
    const [currentPlan, setCurrentPlan] = useState('free');
    const [usage, setUsage] = useState({ quota: 0, used: 0 });
    const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);
    const [language, setLanguage] = useState('id');

    const t = {
        title: { id: 'Billing & Langganan', en: 'Billing & Subscription' },
        subtitle: { id: 'Kelola paket, lihat invoice, dan upgrade kapan saja', en: 'Manage your plan, view invoices, and upgrade anytime' },
        currentPlan: { id: 'Paket Saat Ini', en: 'Current Plan' },
        renews: { id: 'Perpanjang pada', en: 'Renews' },
        usage: { id: 'Penggunaan Pesan', en: 'Message Usage' },
        remaining: { id: 'tersisa', en: 'remaining' },
        unlimitedLabel: { id: 'Pesan tak terbatas', en: 'Unlimited messages' },
        tabs: {
            plans: { id: 'Paket', en: 'Plans' },
            invoices: { id: 'Invoice', en: 'Invoices' }
        },
        billingCycle: {
            monthly: { id: 'Bulanan', en: 'Monthly' },
            yearly: { id: 'Tahunan', en: 'Yearly' },
            save: { id: 'Hemat 17%', en: 'Save 17%' }
        },
        planNames: {
            free: { id: 'Free', en: 'Free' },
            pro: { id: 'Pro', en: 'Pro' },
            enterprise: { id: 'Enterprise', en: 'Enterprise' },
            unlimited: { id: 'Unlimited', en: 'Unlimited' }
        },
        popularBadge: { id: 'Paling Populer', en: 'Most Popular' },
        viewAll: { id: 'Lihat semua {n} fitur', en: 'View all {n} features' },
        upgrade: { id: 'Upgrade', en: 'Upgrade' },
        downgrade: { id: 'Downgrade', en: 'Downgrade' },
        isCurrentPlan: { id: 'Paket Aktif', en: 'Current Plan' },
        cancelSubs: { id: 'Batalkan Langganan', en: 'Cancel Subscription' },
        notSatisfied: { id: 'Tidak puas dengan paket saat ini?', en: 'Not satisfied with your current plan?' },
        invoices: {
            title: { id: 'Riwayat Invoice', en: 'Invoice History' },
            subtitle: { id: 'Lihat dan unduh riwayat pembayaran Anda', en: 'View and download your payment history' },
            noInvoices: { id: 'Belum ada invoice', en: 'No invoices yet' },
            refresh: { id: 'Perbarui', en: 'Refresh' },
            colInvoice: { id: 'Invoice', en: 'Invoice' },
            colDate: { id: 'Tanggal', en: 'Date' },
            colAmount: { id: 'Jumlah', en: 'Amount' },
            colStatus: { id: 'Status', en: 'Status' },
            colActions: { id: 'Aksi', en: 'Actions' },
            pay: { id: 'Bayar', en: 'Pay' }
        },
        modal: {
            featuresOf: { id: 'Fitur Paket ', en: 'Features of ' },
            close: { id: 'Tutup', en: 'Close' },
            upgradeTo: { id: 'Upgrade ke ', en: 'Upgrade to ' }
        },
        pricing: {
            free: { id: 'Gratis', en: 'Free' }
        },
        period: {
            month: { id: '/bulan', en: '/month' },
            year: { id: '/tahun', en: '/year' }
        }
    };

    const getTranslatedPlan = (plan) => {
        const planKey = plan.name.toLowerCase();

        const descriptions = {
            free: { id: 'Mulai eksplorasi platform', en: 'Start exploring the platform' },
            pro: { id: 'Untuk bisnis berkembang', en: 'For growing businesses' },
            enterprise: { id: 'Untuk organisasi besar', en: 'For large organizations' },
            unlimited: { id: 'Tanpa batas, penuh kuasa', en: 'No limits, full power' }
        };

        const features = {
            free: language === 'id'
                ? ['1,500 pesan/bulan', '1 Device WhatsApp', '100 Contacts', '5 Auto-Reply Rules', 'Builder Chatbot Visual', 'Riwayat Pesan 7 hari', 'Akses Webhook & API', 'Dukungan Komunitas']
                : ['1,500 messages/month', '1 WhatsApp Device', '100 Contacts', '5 Auto-Reply Rules', 'Visual Chatbot Builder', '7-day Message History', 'Webhook & API Access', 'Community Support'],
            pro: language === 'id'
                ? ['5,000 pesan/bulan', '3 Devices WhatsApp', '5,000 Contacts', 'Auto-Reply Tanpa Batas', 'Smart Knowledge (RAG)', '3 Knowledge Bases', 'Broadcast Terjadwal', 'Tanpa Watermark', 'Dukungan Prioritas']
                : ['5,000 messages/month', '3 WhatsApp Devices', '5,000 Contacts', 'Unlimited Auto-Reply', 'Smart Knowledge (RAG)', '3 Knowledge Bases', 'Scheduled Broadcast', 'No Watermark', 'Priority Support'],
            enterprise: language === 'id'
                ? ['15,000 pesan/bulan', '10 Devices WhatsApp', '50,000 Contacts', '20 Knowledge Bases', '1,000 AI Query/bulan', 'Manajemen Tim', 'Audit Logs', 'Dukungan Dedicated', 'Jaminan SLA']
                : ['15,000 messages/month', '10 WhatsApp Devices', '50,000 Contacts', '20 Knowledge Bases', '1,000 AI Queries/month', 'Team Management', 'Audit Logs', 'Dedicated Support', 'SLA Guarantee'],
            unlimited: language === 'id'
                ? ['∞ Pesan Tak Terbatas', '∞ Device Tak Terbatas', '∞ Kontak Tak Terbatas', '∞ AI Query Tak Terbatas', 'White-label Branding', 'Custom Domain Ready', 'Dukungan Prioritas 24/7', 'Semua Fitur Premium']
                : ['∞ Unlimited Messages', '∞ Unlimited Devices', '∞ Unlimited Contacts', '∞ Unlimited AI Queries', 'White-label Branding', 'Custom Domain Ready', '24/7 Priority Support', 'All Premium Features']
        };

        return {
            ...plan,
            displayName: t.planNames[planKey]?.[language] || plan.displayName,
            description: descriptions[planKey]?.[language] || plan.description,
            features: features[planKey] || plan.features
        };
    };

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchPlans(),
                fetchSubscription(),
                activeTab === 'invoices' && fetchInvoices()
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await fetch(`${API_URL}/billing/plans`);
            const data = await res.json();
            if (data.success) {
                setPlans(data.data);
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
        }
    };

    const fetchSubscription = async () => {
        try {
            const res = await fetch(`${API_URL}/billing/subscription`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setSubscription(data.data.subscription);
                setCurrentPlan(data.data.currentPlan);
                setUsage({ quota: data.data.quota, used: data.data.used });

                // Sync to localStorage so Sidebar and other components get updated data
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                const updatedUser = {
                    ...storedUser,
                    plan: data.data.currentPlan,
                    quota: data.data.quota
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                // Dispatch storage event to notify other components
                window.dispatchEvent(new Event('storage'));
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
        }
    };

    const fetchInvoices = async () => {
        try {
            const res = await fetch(`${API_URL}/billing/invoices`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            if (data.success) {
                setInvoices(data.data);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleUpgrade = async (planName) => {
        if (planName === currentPlan) {
            toast.error('You are already on this plan');
            return;
        }

        setUpgrading(true);
        try {
            const res = await fetch(`${API_URL}/billing/subscribe`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    plan: planName,
                    billingCycle
                })
            });
            const data = await res.json();

            if (data.success) {
                if (data.data.paymentRequired && data.data.paymentUrl) {
                    // Redirect to payment
                    window.location.href = data.data.paymentUrl;
                } else {
                    // Free plan, already upgraded
                    toast.success('Plan updated successfully!');
                    fetchSubscription();
                }
            } else {
                toast.error(data.error || 'Failed to upgrade');
            }
        } catch (error) {
            console.error('Error upgrading:', error);
            toast.error('Failed to process upgrade');
        } finally {
            setUpgrading(false);
        }
    };

    const handleCancelSubscription = async () => {
        const isConfirmed = await confirm({
            title: 'Cancel Subscription?',
            message: 'Are you sure you want to cancel your subscription? Premium features will be unavailable after the period ends.',
            confirmText: 'Yes, Cancel',
            cancelText: 'Keep Subscription',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`${API_URL}/billing/cancel`, {
                method: 'POST',
                headers: getAuthHeader()
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Subscription cancelled');
                fetchSubscription();
            } else {
                toast.error(data.error || 'Failed to cancel');
            }
        } catch (error) {
            console.error('Error cancelling:', error);
            toast.error('Failed to cancel subscription');
        }
    };

    const usagePercent = usage.quota > 0 ? Math.min((usage.used / usage.quota) * 100, 100) : 0;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t.title[language]}</h1>
                    <p className="page-subtitle">{t.subtitle[language]}</p>
                </div>
            </div>

            {/* Current Plan Summary */}
            <div className="billing-summary">
                <div className="summary-card current-plan">
                    <div className="plan-icon-large">
                        {planIcons[currentPlan] &&
                            (() => { const Icon = planIcons[currentPlan]; return <Icon size={32} />; })()
                        }
                    </div>
                    <div className="plan-info">
                        <span className="plan-label">{t.currentPlan[language]}</span>
                        <h2 className="plan-name">{t.planNames[currentPlan.toLowerCase()]?.[language] || currentPlan.toUpperCase()}</h2>
                        {subscription?.currentPeriodEnd && (
                            <span className="plan-renewal">
                                {t.renews[language]} {format(new Date(subscription.currentPeriodEnd), 'dd MMMM yyyy', { locale: language === 'id' ? id : undefined })}
                            </span>
                        )}
                    </div>
                </div>

                <div className="summary-card usage-card">
                    <div className="usage-header">
                        <span>{t.usage[language]}</span>
                        <span className="usage-numbers">
                            {usage.used.toLocaleString()} / {usage.quota === 999999 ? '∞' : usage.quota.toLocaleString()}
                        </span>
                    </div>
                    <div className="usage-bar">
                        <div
                            className="usage-fill"
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                    <span className="usage-hint">
                        {usage.quota === 999999 ? t.unlimitedLabel[language] : `${(100 - usagePercent).toFixed(0)}% ${t.remaining[language]}`}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <button
                    className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
                    onClick={() => setActiveTab('plans')}
                >
                    <CreditCard size={16} /> {t.tabs.plans[language]}
                </button>
                <button
                    className={`tab ${activeTab === 'invoices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invoices')}
                >
                    <FileText size={16} /> {t.tabs.invoices[language]}
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <Loader className="animate-spin" size={32} />
                </div>
            ) : (
                <>
                    {/* Plans Tab */}
                    {activeTab === 'plans' && (
                        <div className="plans-section">
                            {/* Language Switcher */}
                            <div className="lp-lang-switcher" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                                <button
                                    className={`lp-lang-btn ${language === 'id' ? 'active' : ''}`}
                                    onClick={() => setLanguage('id')}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-color)',
                                        background: language === 'id' ? 'var(--primary)' : 'transparent',
                                        color: language === 'id' ? 'white' : 'var(--text-primary)',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Indonesia
                                </button>
                                <button
                                    className={`lp-lang-btn ${language === 'en' ? 'active' : ''}`}
                                    onClick={() => setLanguage('en')}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '20px',
                                        border: '1px solid var(--border-color)',
                                        background: language === 'en' ? 'var(--primary)' : 'transparent',
                                        color: language === 'en' ? 'white' : 'var(--text-primary)',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    English
                                </button>
                            </div>

                            {/* Billing Cycle Toggle */}
                            <div className="billing-toggle">
                                <button
                                    className={`toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                                    onClick={() => setBillingCycle('monthly')}
                                >
                                    {t.billingCycle.monthly[language]}
                                </button>
                                <button
                                    className={`toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
                                    onClick={() => setBillingCycle('yearly')}
                                >
                                    {t.billingCycle.yearly[language]}
                                    <span className="save-badge">{t.billingCycle.save[language]}</span>
                                </button>
                            </div>

                            {/* Plans Grid */}
                            <div className="plans-grid">
                                {plans.map((p) => {
                                    const plan = getTranslatedPlan(p);
                                    const Icon = planIcons[plan.name] || Star;
                                    const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                                    const isCurrentPlan = plan.name === currentPlan;

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`plan-card ${isCurrentPlan ? 'current' : ''} ${plan.name === 'enterprise' ? 'popular' : ''}`}
                                        >
                                            {plan.name === 'enterprise' && (
                                                <div className="popular-badge">{t.popularBadge[language]}</div>
                                            )}

                                            <div className="plan-header">
                                                <div className="plan-icon">
                                                    <Icon size={24} />
                                                </div>
                                                <h3 className="plan-title">{plan.displayName}</h3>
                                                <p className="plan-description">{plan.description}</p>
                                            </div>

                                            <div className="plan-price">
                                                {price === 0 ? (
                                                    <span className="price-free">{t.pricing?.free?.[language] || (language === 'id' ? 'Gratis' : 'Free')}</span>
                                                ) : (
                                                    <>
                                                        <span className="price-amount">
                                                            {formatPrice(price, language, plan.name, billingCycle)}
                                                        </span>
                                                        <span className="price-period">
                                                            {billingCycle === 'yearly' ? t.period.year[language] : t.period.month[language]}
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            <ul className="plan-features">
                                                {plan.features.slice(0, 8).map((feature, idx) => (
                                                    <li key={idx}>
                                                        <Check size={16} className="feature-check" />
                                                        {feature}
                                                    </li>
                                                ))}
                                                {plan.features.length > 8 && (
                                                    <li
                                                        className="more-features"
                                                        onClick={() => setSelectedPlanDetail(plan)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <Eye size={14} />
                                                        <span>{t.viewAll[language].replace('{n}', plan.features.length)}</span>
                                                    </li>
                                                )}
                                            </ul>

                                            <button
                                                className={`btn ${isCurrentPlan ? 'btn-secondary' : 'btn-primary'} plan-btn`}
                                                onClick={() => handleUpgrade(plan.name)}
                                                disabled={upgrading || isCurrentPlan}
                                            >
                                                {upgrading ? (
                                                    <Loader size={16} className="animate-spin" />
                                                ) : isCurrentPlan ? (
                                                    t.isCurrentPlan[language]
                                                ) : price === 0 ? (
                                                    t.downgrade[language]
                                                ) : (
                                                    t.upgrade[language]
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Invoices Tab */}
                    {activeTab === 'invoices' && (
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">{t.invoices.title[language]}</h3>
                                    <p className="card-subtitle">{t.invoices.subtitle[language]}</p>
                                </div>
                                <button className="btn btn-ghost" onClick={fetchInvoices}>
                                    <RefreshCw size={16} /> {t.invoices.refresh[language]}
                                </button>
                            </div>

                            <div className="table-container" style={{ border: 'none' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>{t.invoices.colInvoice[language]}</th>
                                            <th>{t.invoices.colDate[language]}</th>
                                            <th>{t.invoices.colAmount[language]}</th>
                                            <th>{t.invoices.colStatus[language]}</th>
                                            <th>{t.invoices.colActions[language]}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.length > 0 ? (
                                            invoices.map((invoice) => (
                                                <tr key={invoice.id}>
                                                    <td>
                                                        <span className="invoice-number">{invoice.invoiceNumber}</span>
                                                        <span className="invoice-desc">{invoice.description}</span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)' }}>
                                                        {format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {formatInvoiceCurrency(invoice.amount)}
                                                    </td>
                                                    <td>{getStatusBadge(invoice.status)}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                            {invoice.paymentUrl && invoice.status === 'pending' && (
                                                                <a
                                                                    href={invoice.paymentUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-primary btn-sm"
                                                                >
                                                                    <ExternalLink size={14} /> Pay
                                                                </a>
                                                            )}
                                                            <button className="btn btn-ghost btn-icon btn-sm">
                                                                <Download size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="text-center py-8 text-text-muted">
                                                    {t.invoices.noInvoices[language]}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Cancel Subscription */}
            {subscription && subscription.status === 'active' && currentPlan !== 'free' && activeTab === 'plans' && (
                <div className="cancel-section">
                    <p>{t.notSatisfied[language]}</p>
                    <button
                        className="btn btn-ghost"
                        onClick={handleCancelSubscription}
                    >
                        {t.cancelSubs[language]}
                    </button>
                </div>
            )}

            {/* Feature Detail Modal */}
            {selectedPlanDetail && (
                <div className="modal-overlay open" onClick={() => setSelectedPlanDetail(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                {planIcons[selectedPlanDetail.name.toLowerCase()] &&
                                    (() => { const Icon = planIcons[selectedPlanDetail.name.toLowerCase()]; return <Icon size={24} />; })()
                                }
                                {t.modal.featuresOf[language]} {t.planNames[selectedPlanDetail.name.toLowerCase()]?.[language] || selectedPlanDetail.displayName}
                            </h3>
                            <button className="modal-close" onClick={() => setSelectedPlanDetail(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-muted)' }}>
                                {selectedPlanDetail.description}
                            </p>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: 'var(--spacing-xs)'
                            }}>
                                {selectedPlanDetail.features.map((feature, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 'var(--spacing-xs)',
                                        padding: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface-secondary)'
                                    }}>
                                        <Check size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                                        <span style={{ fontSize: '0.875rem' }}>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setSelectedPlanDetail(null)}
                            >
                                {t.modal.close[language]}
                            </button>
                            {selectedPlanDetail.name !== currentPlan && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        handleUpgrade(selectedPlanDetail.name);
                                        setSelectedPlanDetail(null);
                                    }}
                                    disabled={upgrading}
                                >
                                    {upgrading ? <Loader size={16} className="animate-spin" /> : t.modal.upgradeTo[language] + (t.planNames[selectedPlanDetail.name.toLowerCase()]?.[language] || selectedPlanDetail.displayName)}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
