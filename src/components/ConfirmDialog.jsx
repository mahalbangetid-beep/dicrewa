import { useState, createContext, useContext, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// Context untuk ConfirmDialog
const ConfirmContext = createContext(null);

/**
 * ConfirmDialog Provider
 * Wrap aplikasi dengan provider ini agar bisa menggunakan useConfirm hook
 */
export function ConfirmProvider({ children }) {
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        title: 'Confirm',
        message: 'Are you sure?',
        confirmText: 'Yes',
        cancelText: 'Cancel',
        danger: false,
        resolve: null
    });

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            setConfirmState({
                isOpen: true,
                title: options.title || 'Confirm',
                message: options.message || 'Are you sure?',
                confirmText: options.confirmText || 'Yes',
                cancelText: options.cancelText || 'Cancel',
                danger: options.danger || false,
                resolve
            });
        });
    }, []);

    const handleConfirm = () => {
        confirmState.resolve?.(true);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    const handleCancel = () => {
        confirmState.resolve?.(false);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}

            {/* Confirm Dialog Modal */}
            <div
                className={`modal-overlay ${confirmState.isOpen ? 'open' : ''}`}
                onClick={handleCancel}
                style={{ zIndex: 10000 }}
            >
                <div
                    className="modal confirm-dialog"
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth: '400px' }}
                >
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            {confirmState.danger && (
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
                                </div>
                            )}
                            <h3 className="modal-title">{confirmState.title}</h3>
                        </div>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={handleCancel}
                            type="button"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.9375rem',
                            lineHeight: '1.6',
                            margin: 0
                        }}>
                            {confirmState.message}
                        </p>
                    </div>
                    <div className="modal-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={handleCancel}
                            type="button"
                        >
                            {confirmState.cancelText}
                        </button>
                        <button
                            className={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`}
                            onClick={handleConfirm}
                            type="button"
                            autoFocus
                        >
                            {confirmState.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </ConfirmContext.Provider>
    );
}

/**
 * Hook to use confirm dialog
 * 
 * Usage:
 * ```
 * const confirm = useConfirm();
 * 
 * const handleDelete = async () => {
 *     const isConfirmed = await confirm({
 *         title: 'Delete Item?',
 *         message: 'This action cannot be undone.',
 *         confirmText: 'Delete',
 *         cancelText: 'Cancel',
 *         danger: true
 *     });
 *     
 *     if (isConfirmed) {
 *         // perform deletion
 *     }
 * };
 * ```
 */
export function useConfirm() {
    const confirm = useContext(ConfirmContext);
    if (!confirm) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return confirm;
}

export default ConfirmProvider;
