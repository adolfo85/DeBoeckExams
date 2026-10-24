import React, { useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    warningItems?: string[];
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    warningItems = [],
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    variant = 'warning'
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isDanger = variant === 'danger';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div
                className="bg-slate-100 rounded-sm border border-slate-400 shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Classic Windows Title Bar */}
                <div className={`px-3 py-1.5 flex items-center justify-between text-white text-xs font-semibold tracking-wide select-none ${
                    isDanger ? 'bg-red-800' : 'bg-slate-800'
                }`}>
                    <span className="truncate">{title}</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-1.5 py-0.5 hover:bg-white/20 active:bg-white/30 text-white font-mono text-xs rounded-xs"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Dialog Content */}
                <div className="p-5 bg-white space-y-4">
                    <p className="text-slate-800 text-sm leading-relaxed">{message}</p>

                    {warningItems.length > 0 && (
                        <div className="bg-slate-50 rounded-sm p-3 border border-slate-300">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                                Elementos afectados:
                            </p>
                            <ul className="space-y-1">
                                {warningItems.map((item, idx) => (
                                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5 font-mono">
                                        <span className="text-red-600 font-bold">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Classic Windows Button Bar (bottom right) */}
                <div className="flex justify-end gap-2 px-4 py-2.5 bg-slate-100 border-t border-slate-300">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="min-w-[80px]"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={isDanger ? 'danger' : 'primary'}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="min-w-[80px]"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};
