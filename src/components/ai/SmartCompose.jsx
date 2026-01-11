import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Send, X, RefreshCw, Copy, Check } from 'lucide-react';
import { API_URL } from '../../utils/config';

/**
 * SmartCompose Component - AI-powered content generation modal
 */
export default function SmartCompose({ isOpen, onClose, onInsert, initialContext = '' }) {
    const [type, setType] = useState('reply');
    const [context, setContext] = useState(initialContext);
    const [tone, setTone] = useState('friendly');
    const [language, setLanguage] = useState('id');
    const [instructions, setInstructions] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Update context when initialContext changes or modal opens
    useEffect(() => {
        if (isOpen && initialContext) {
            setContext(initialContext);
        }
    }, [isOpen, initialContext]);

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const generateContent = async () => {
        if (!context.trim()) {
            setError('Please provide context or description');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(`${API_URL}/ai/generate`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    type,
                    context,
                    tone,
                    language,
                    instructions
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to generate content');
            }

            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error('[SmartCompose] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleInsert = (text) => {
        if (onInsert) {
            onInsert(text);
        }
        onClose();
    };

    const getPlaceholderByType = () => {
        switch (type) {
            case 'reply':
                return 'e.g., Customer asking about product availability and pricing';
            case 'template':
                return 'e.g., Welcome message for new customers with greeting and discount info';
            case 'broadcast':
                return 'e.g., Flash sale announcement for weekend, 50% off all products';
            case 'improve':
                return 'Paste the message you want to improve here...';
            default:
                return 'Describe what you want to generate...';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div className="modal smart-compose-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title-with-icon">
                        <Wand2 className="ai-icon" />
                        <h2>Smart Compose</h2>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Content Type */}
                    <div className="form-group">
                        <label>What do you want to create?</label>
                        <div className="type-selector">
                            {[
                                { value: 'reply', label: '💬 Reply', desc: 'Generate a response' },
                                { value: 'template', label: '📝 Template', desc: 'Create a template' },
                                { value: 'broadcast', label: '📢 Broadcast', desc: 'Write a broadcast' },
                                { value: 'improve', label: '✨ Improve', desc: 'Enhance existing text' }
                            ].map(t => (
                                <button
                                    key={t.value}
                                    className={`type-btn ${type === t.value ? 'active' : ''}`}
                                    onClick={() => setType(t.value)}
                                >
                                    <span className="type-label">{t.label}</span>
                                    <span className="type-desc">{t.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Context/Input */}
                    <div className="form-group">
                        <label>
                            {type === 'improve' ? 'Text to improve' : 'Context / Description'}
                        </label>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder={getPlaceholderByType()}
                            rows={4}
                        />
                    </div>

                    {/* Options Row */}
                    <div className="options-row">
                        <div className="form-group">
                            <label>Tone</label>
                            <select value={tone} onChange={(e) => setTone(e.target.value)}>
                                <option value="friendly">😊 Friendly</option>
                                <option value="formal">👔 Formal</option>
                                <option value="casual">🎉 Casual</option>
                                <option value="persuasive">💼 Persuasive</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                                <option value="id">🇮🇩 Indonesia</option>
                                <option value="en">🇬🇧 English</option>
                            </select>
                        </div>
                    </div>

                    {/* Additional Instructions */}
                    <div className="form-group">
                        <label>Additional instructions (optional)</label>
                        <input
                            type="text"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="e.g., Include a call to action, mention free shipping..."
                        />
                    </div>

                    {/* Generate Button */}
                    <button
                        className="btn btn-primary btn-full"
                        onClick={generateContent}
                        disabled={loading || !context.trim()}
                    >
                        {loading ? (
                            <>
                                <Sparkles className="spin" size={18} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Generate with AI
                            </>
                        )}
                    </button>

                    {/* Error */}
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="compose-result">
                            <div className="result-header">
                                <span>Generated Content</span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={generateContent}
                                    title="Regenerate"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>

                            {/* Main Content */}
                            <div className="result-content">
                                <div className="result-text">
                                    {result.content || result.improved}
                                </div>
                                <div className="result-actions">
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleCopy(result.content || result.improved)}
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleInsert(result.content || result.improved)}
                                    >
                                        <Send size={14} />
                                        Use This
                                    </button>
                                </div>
                            </div>

                            {/* Alternatives */}
                            {result.alternatives && result.alternatives.length > 0 && (
                                <div className="result-alternatives">
                                    <span className="alternatives-label">Alternatives:</span>
                                    {result.alternatives.map((alt, index) => (
                                        <div key={index} className="alternative-item">
                                            <span className="alt-text">{alt}</span>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleInsert(alt)}
                                            >
                                                Use
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Template Variables */}
                            {result.variables && result.variables.length > 0 && (
                                <div className="template-variables">
                                    <span>Variables: </span>
                                    {result.variables.map((v, i) => (
                                        <code key={i}>{`{{${v}}}`}</code>
                                    ))}
                                </div>
                            )}

                            {/* Improvement Tips */}
                            {result.tips && result.tips.length > 0 && (
                                <div className="improvement-tips">
                                    <span className="tips-label">💡 Tips:</span>
                                    <ul>
                                        {result.tips.map((tip, i) => (
                                            <li key={i}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
