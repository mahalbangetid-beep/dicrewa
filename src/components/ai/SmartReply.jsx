import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Wand2, Brain, ToggleLeft, ToggleRight } from 'lucide-react';
import { API_URL } from '../../utils/config';

/**
 * SmartReply Component - AI-powered reply suggestions
 * Supports optional knowledge base augmentation
 */
export default function SmartReply({ message, context = [], onSelect, language = 'id', tone = 'friendly' }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [detectedIntent, setDetectedIntent] = useState(null);
    const [fromKnowledge, setFromKnowledge] = useState(false);
    const [knowledgeBaseName, setKnowledgeBaseName] = useState(null);
    const [useKnowledge, setUseKnowledge] = useState(true); // Enable by default

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchSuggestions = async () => {
        if (!message || message.trim().length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        setError(null);
        setFromKnowledge(false);
        setKnowledgeBaseName(null);

        try {
            const res = await fetch(`${API_URL}/ai/suggest-replies`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    message,
                    context,
                    language,
                    tone,
                    count: 3,
                    useKnowledge // Pass knowledge preference
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to get suggestions');
            }

            const data = await res.json();
            setSuggestions(data.suggestions || []);
            setDetectedIntent(data.detected_intent);
            setFromKnowledge(data.fromKnowledge || data.used_knowledge || false);
            setKnowledgeBaseName(data.knowledgeBaseName || null);
        } catch (err) {
            console.error('[SmartReply] Error:', err);
            setError(err.message);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when message changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (message && message.length > 10) {
                fetchSuggestions();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [message, useKnowledge]);

    if (!message) return null;

    return (
        <div className="smart-reply-container">
            <div className="smart-reply-header">
                <div className="smart-reply-title">
                    <Sparkles size={16} className="ai-icon" />
                    <span>Smart Reply</span>
                    {detectedIntent && (
                        <span className="intent-badge">{detectedIntent}</span>
                    )}
                    {fromKnowledge && (
                        <span className="intent-badge" style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: 'white'
                        }}>
                            <Brain size={10} style={{ marginRight: '4px' }} />
                            {knowledgeBaseName || 'Knowledge'}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setUseKnowledge(!useKnowledge)}
                        title={useKnowledge ? 'Disable Knowledge Base' : 'Enable Knowledge Base'}
                        style={{
                            padding: '4px',
                            color: useKnowledge ? 'var(--primary-500)' : 'var(--text-muted)'
                        }}
                    >
                        <Brain size={14} />
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={fetchSuggestions}
                        disabled={loading}
                        title="Refresh suggestions"
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="smart-reply-error">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="smart-reply-loading">
                    <Wand2 size={18} className="spin" />
                    <span>AI is thinking{useKnowledge ? ' (with knowledge)' : ''}...</span>
                </div>
            ) : suggestions.length > 0 ? (
                <div className="smart-reply-suggestions">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            className="smart-reply-item"
                            onClick={() => onSelect && onSelect(suggestion)}
                            style={fromKnowledge ? { borderLeft: '3px solid var(--primary-500)' } : {}}
                        >
                            <span className="suggestion-text">{suggestion}</span>
                            <span className="use-btn">Use</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="smart-reply-empty">
                    <span>Click refresh to generate AI suggestions</span>
                </div>
            )}
        </div>
    );
}
