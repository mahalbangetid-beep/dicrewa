import { useState, useEffect } from 'react';
import { Smile, Frown, Meh, AlertTriangle, Loader2 } from 'lucide-react';
import { API_URL } from '../../utils/config';

/**
 * SentimentBadge Component - Shows sentiment analysis of message
 */
export default function SentimentBadge({ message, showDetails = false, size = 'normal', autoAnalyze = false }) {
    const [sentiment, setSentiment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getAuthHeader = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const analyzeSentiment = async () => {
        if (!message || message.trim().length < 5) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/ai/analyze-sentiment`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ message })
            });

            if (!res.ok) {
                throw new Error('Failed to analyze sentiment');
            }

            const data = await res.json();
            setSentiment(data);
        } catch (err) {
            console.error('[SentimentBadge] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (autoAnalyze && message) {
            analyzeSentiment();
        }
    }, [message, autoAnalyze]);

    const getSentimentIcon = () => {
        if (!sentiment) return null;

        switch (sentiment.sentiment) {
            case 'positive':
                return <Smile className="sentiment-icon positive" />;
            case 'negative':
                return <Frown className="sentiment-icon negative" />;
            default:
                return <Meh className="sentiment-icon neutral" />;
        }
    };

    const getSentimentColor = () => {
        if (!sentiment) return 'var(--text-muted)';

        switch (sentiment.sentiment) {
            case 'positive':
                return 'var(--success)';
            case 'negative':
                return 'var(--error)';
            default:
                return 'var(--warning)';
        }
    };

    const getUrgencyIcon = () => {
        if (!sentiment || sentiment.urgency !== 'high') return null;
        return <AlertTriangle size={12} className="urgency-icon" />;
    };

    if (loading) {
        return (
            <div className={`sentiment-badge loading ${size}`}>
                <Loader2 size={size === 'small' ? 12 : 16} className="spin" />
            </div>
        );
    }

    if (!sentiment && !autoAnalyze) {
        return (
            <button
                className={`sentiment-badge clickable ${size}`}
                onClick={analyzeSentiment}
                title="Analyze sentiment"
            >
                <Meh size={size === 'small' ? 12 : 16} />
            </button>
        );
    }

    if (!sentiment) return null;

    return (
        <div
            className={`sentiment-badge ${sentiment.sentiment} ${size}`}
            style={{ '--sentiment-color': getSentimentColor() }}
            title={sentiment.summary || sentiment.sentiment}
        >
            {getSentimentIcon()}
            {getUrgencyIcon()}

            {showDetails && (
                <div className="sentiment-details">
                    <span className="sentiment-label">{sentiment.sentiment}</span>
                    {sentiment.emotions && sentiment.emotions.length > 0 && (
                        <div className="sentiment-emotions">
                            {sentiment.emotions.slice(0, 2).map((emotion, i) => (
                                <span key={i} className="emotion-tag">{emotion}</span>
                            ))}
                        </div>
                    )}
                    {sentiment.urgency === 'high' && (
                        <span className="urgency-badge">Urgent</span>
                    )}
                </div>
            )}
        </div>
    );
}
