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
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const iconColor = variant === 'danger' ? 'text-red-500' : 'text-amber-500';
    const iconBg = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Icon */}
                <div className="flex flex-col items-center pt-8 pb-4 px-6 border-b border-gray-100">
                    <div className={`${iconBg} ${iconColor} w-16 h-16 rounded-full flex items-center justify-center mb-4`}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center">{title}</h3>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-gray-700 text-center leading-relaxed">{message}</p>

                    {warningItems.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <p className="text-sm font-semibold text-gray-600 mb-2">Esto borrará permanentemente:</p>
                            <ul className="space-y-1">
                                {warningItems.map((item, idx) => (
                                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 pt-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="flex-1"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};
