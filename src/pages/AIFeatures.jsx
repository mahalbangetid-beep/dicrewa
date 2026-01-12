import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Brain, MessageSquare, BarChart3, Zap, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Key, Trash2, Save } from 'lucide-react';
import SmartCompose from '../components/ai/SmartCompose';
import { API_URL } from '../utils/config';
import { useConfirm } from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function AIFeatures() {
    const confirm = useConfirm();
    const [aiStatus, setAiStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [testMessage, setTestMessage] = useState('');
    const [sentimentResult, setSentimentResult] = useState(null);
    const [suggestionsResult, setSuggestionsResult] = useState(null);
    const [testing, setTesting] = useState({});
    const [showCompose, setShowCompose] = useState(false);

    // API Key management
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [savingKey, setSavingKey] = useState(false);
    const [keyMessage, setKeyMessage] = useState(null);

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    useEffect(() => {
        checkAIStatus();
    }, []);

    const checkAIStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/ai/status`, {
                headers: getAuthHeader()
            });
            const data = await res.json();
            setAiStatus(data);
        } catch (error) {
            console.error('Error checking AI status:', error);
            setAiStatus({ configured: false, message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const saveApiKey = async () => {
        if (!apiKey.trim()) {
            setKeyMessage({ type: 'error', text: 'Please enter API Key' });
            return;
        }

        setSavingKey(true);
        setKeyMessage(null);

        try {
            const res = await fetch(`${API_URL}/ai/save-key`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ apiKey: apiKey.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                setKeyMessage({ type: 'success', text: data.message });
                setApiKey('');
                checkAIStatus();
            } else {
                setKeyMessage({ type: 'error', text: data.error });
            }
        } catch (error) {
            setKeyMessage({ type: 'error', text: error.message });
        } finally {
            setSavingKey(false);
        }
    };

    const removeApiKey = async () => {
        const isConfirmed = await confirm({
            title: 'Delete API Key?',
            message: 'Delete API Key? AI features will not be available.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });
        if (!isConfirmed) return;

        try {
            const res = await fetch(`${API_URL}/ai/remove-key`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });

            if (res.ok) {
                setKeyMessage({ type: 'success', text: 'API Key deleted successfully' });
                checkAIStatus();
            }
        } catch (error) {
            setKeyMessage({ type: 'error', text: error.message });
        }
    };

    const testSentiment = async () => {
        if (!testMessage.trim()) return;

        setTesting(prev => ({ ...prev, sentiment: true }));
        setSentimentResult(null);

        try {
            const res = await fetch(`${API_URL}/ai/analyze-sentiment`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ message: testMessage })
            });
            const data = await res.json();
            if (res.ok) {
                setSentimentResult(data);
            } else {
                setSentimentResult({ error: data.error });
            }
        } catch (error) {
            setSentimentResult({ error: error.message });
        } finally {
            setTesting(prev => ({ ...prev, sentiment: false }));
        }
    };

    const testSuggestions = async () => {
        if (!testMessage.trim()) return;

        setTesting(prev => ({ ...prev, suggestions: true }));
        setSuggestionsResult(null);

        try {
            const res = await fetch(`${API_URL}/ai/suggest-replies`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ message: testMessage, context: [], language: 'id' })
            });
            const data = await res.json();
            if (res.ok) {
                setSuggestionsResult(data);
            } else {
                setSuggestionsResult({ error: data.error });
            }
        } catch (error) {
            setSuggestionsResult({ error: error.message });
        } finally {
            setTesting(prev => ({ ...prev, suggestions: false }));
        }
    };

    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case 'positive': return 'var(--success)';
            case 'negative': return 'var(--error)';
            default: return 'var(--warning)';
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1>✨ AI Smart Features</h1>
                    <p>Powered by Google Gemini - Enhance your WhatsApp experience with AI</p>
                </div>
                {aiStatus?.configured && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCompose(true)}
                    >
                        <Wand2 size={18} />
                        Smart Compose
                    </button>
                )}
            </div>

            {/* API Key Configuration Card */}
            <div className="card ai-config-card">
                <div className="card-header">
                    <h3>
                        <Key size={20} />
                        API Key Configuration
                    </h3>
                    {aiStatus?.configured && (
                        <button
                            className="btn btn-ghost btn-sm btn-danger"
                            onClick={removeApiKey}
                            title="Hapus API Key"
                        >
                            <Trash2 size={14} />
                            Delete Key
                        </button>
                    )}
                </div>

                <div className="ai-config-content">
                    {aiStatus?.configured ? (
                        <div className="ai-status-active">
                            <CheckCircle size={24} className="status-icon success" />
                            <div className="status-text">
                                <strong>AI Active</strong>
                                <span>{aiStatus.message}</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="ai-status-inactive">
                                <XCircle size={24} className="status-icon inactive" />
                                <div className="status-text">
                                    <strong>AI Not Active</strong>
                                    <span>Enter Gemini API Key to enable AI features</span>
                                </div>
                            </div>

                            <div className="api-key-form">
                                <div className="api-key-input-wrapper">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Enter Gemini API Key..."
                                        className="api-key-input"
                                    />
                                    <button
                                        className="btn btn-ghost btn-sm toggle-visibility"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        type="button"
                                    >
                                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={saveApiKey}
                                    disabled={savingKey || !apiKey.trim()}
                                >
                                    {savingKey ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
                                    {savingKey ? 'Saving...' : 'Save & Enable'}
                                </button>
                            </div>

                            {keyMessage && (
                                <div className={`key-message ${keyMessage.type}`}>
                                    {keyMessage.text}
                                </div>
                            )}

                            <div className="api-key-help">
                                <p>How to get an API Key:</p>
                                <ol>
                                    <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                                    <li>Login with your Google account</li>
                                    <li>Click "Create API Key"</li>
                                    <li>Copy the key and paste it above</li>
                                </ol>
                                <p className="free-note">💡 Free API Key with a limit of 60 requests/minute</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Feature Cards */}
            <div className="ai-features-grid">
                <div className="ai-feature-card">
                    <div className="feature-icon">
                        <MessageSquare />
                    </div>
                    <h3>Smart Reply</h3>
                    <p>AI generates intelligent reply suggestions based on incoming messages</p>
                    <ul>
                        <li>Context-aware responses</li>
                        <li>Multiple suggestions</li>
                        <li>Intent detection</li>
                    </ul>
                </div>

                <div className="ai-feature-card">
                    <div className="feature-icon sentiment">
                        <Sparkles />
                    </div>
                    <h3>Sentiment Analysis</h3>
                    <p>Understand the emotional tone of messages automatically</p>
                    <ul>
                        <li>Positive/Negative/Neutral</li>
                        <li>Emotion detection</li>
                        <li>Urgency level</li>
                    </ul>
                </div>

                <div className="ai-feature-card">
                    <div className="feature-icon analytics">
                        <BarChart3 />
                    </div>
                    <h3>Smart Insights</h3>
                    <p>AI-powered analytics and business recommendations</p>
                    <ul>
                        <li>Trend analysis</li>
                        <li>Performance tips</li>
                        <li>Action recommendations</li>
                    </ul>
                </div>

                <div className="ai-feature-card">
                    <div className="feature-icon compose">
                        <Wand2 />
                    </div>
                    <h3>Smart Compose</h3>
                    <p>Generate messages, templates, and broadcasts with AI</p>
                    <ul>
                        <li>Reply generation</li>
                        <li>Template creation</li>
                        <li>Broadcast writing</li>
                    </ul>
                </div>
            </div>

            {/* Test Section - Only show if configured */}
            {aiStatus?.configured && (
                <div className="card ai-test-section">
                    <div className="card-header">
                        <h3>
                            <Zap size={20} />
                            Try AI Features
                        </h3>
                    </div>

                    <div className="test-input-section">
                        <div className="form-group">
                            <label>Sample Message</label>
                            <textarea
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Enter a customer message sample to test AI features..."
                                rows={3}
                            />
                        </div>

                        <div className="test-buttons">
                            <button
                                className="btn btn-secondary"
                                onClick={testSentiment}
                                disabled={testing.sentiment || !testMessage.trim()}
                            >
                                {testing.sentiment ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}
                                Analyze Sentiment
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={testSuggestions}
                                disabled={testing.suggestions || !testMessage.trim()}
                            >
                                {testing.suggestions ? <RefreshCw className="spin" size={14} /> : <MessageSquare size={14} />}
                                Suggest Replies
                            </button>
                        </div>
                    </div>

                    {/* Sentiment Result */}
                    {sentimentResult && (
                        <div className="test-result">
                            <h4>Sentiment Analysis Result</h4>
                            {sentimentResult.error ? (
                                <div className="result-error">{sentimentResult.error}</div>
                            ) : (
                                <div className="sentiment-result-content">
                                    <div className="sentiment-main" style={{ borderColor: getSentimentColor(sentimentResult.sentiment) }}>
                                        <span className="sentiment-label" style={{ color: getSentimentColor(sentimentResult.sentiment) }}>
                                            {sentimentResult.sentiment?.toUpperCase()}
                                        </span>
                                        <span className="sentiment-score">Score: {sentimentResult.score?.toFixed(2)}</span>
                                    </div>
                                    {sentimentResult.emotions && (
                                        <div className="sentiment-emotions">
                                            <span>Emotions: </span>
                                            {sentimentResult.emotions.map((e, i) => (
                                                <span key={i} className="emotion-tag">{e}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="sentiment-meta">
                                        <span>Urgency: <strong>{sentimentResult.urgency}</strong></span>
                                        {sentimentResult.summary && <span>Summary: {sentimentResult.summary}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Suggestions Result */}
                    {suggestionsResult && (
                        <div className="test-result">
                            <h4>Suggested Replies</h4>
                            {suggestionsResult.error ? (
                                <div className="result-error">{suggestionsResult.error}</div>
                            ) : (
                                <div className="suggestions-result-content">
                                    {suggestionsResult.detected_intent && (
                                        <div className="detected-intent">
                                            Detected Intent: <strong>{suggestionsResult.detected_intent}</strong>
                                        </div>
                                    )}
                                    <div className="suggestions-list">
                                        {suggestionsResult.suggestions?.map((suggestion, index) => (
                                            <div key={index} className="suggestion-item">
                                                <span className="suggestion-number">{index + 1}</span>
                                                <span className="suggestion-text">{suggestion}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Smart Compose Modal */}
            <SmartCompose
                isOpen={showCompose}
                onClose={() => setShowCompose(false)}
                onInsert={(text) => {
                    navigator.clipboard.writeText(text);
                    toast.success('Copied to clipboard!');
                }}
            />
        </div>
    );
}
