import React, { useState } from 'react';
import { Button } from './Button';

interface LoginProps {
    onLogin: (teacherId: string, teacherName: string, isSuperAdmin?: boolean) => void;
    onBack: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onBack }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { storageService } = await import('../services/storageService');

            if (mode === 'register') {
                if (!name.trim() || !email.trim() || !password.trim()) {
                    setError('Todos los campos son obligatorios');
                    setIsLoading(false);
                    return;
                }

                try {
                    await storageService.register(name, email, password);
                    // Registered users need approval, show message
                    setError('Cuenta creada. Espera la aprobación del administrador.');
                    setIsLoading(false);
                } catch (err: any) {
                    if (err?.message?.includes('unique')) {
                        setError('Este email ya está registrado');
                    } else {
                        setError('Error al registrar. Intenta nuevamente.');
                    }
                    setIsLoading(false);
                }
            } else {
                if (!email.trim() || !password.trim()) {
                    setError('Email y contraseña son obligatorios');
                    setIsLoading(false);
                    return;
                }

                const teacher = await storageService.login(email, password);
                if (teacher) {
                    onLogin(teacher.id, teacher.name, teacher.is_super_admin);
                } else {
                    setError('Email o contraseña incorrectos, o cuenta pendiente de aprobación');
                }
                setIsLoading(false);
            }
        } catch (err) {
            setError('Error de conexión. Intenta nuevamente.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
            {/* Classic Windows Window Container */}
            <div className="max-w-md w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden">
                {/* Title Bar */}
                <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
                    <span className="truncate">DeBoeckExams — Acceso de Profesores</span>
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-1.5 py-0.5 hover:bg-white/20 active:bg-white/30 text-white font-mono text-xs rounded-xs"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Subheader Banner */}
                <div className="bg-slate-50 border-b border-slate-300 px-6 py-4">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">DeBoeckExams</h1>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">Módulo de Administración Docente</p>
                </div>

                {/* Classic Desktop Tabs */}
                <div className="flex border-b border-slate-300 bg-slate-200 px-6 pt-3 gap-1">
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-t-sm transition-colors border-t border-l border-r ${
                            mode === 'login'
                                ? 'bg-white border-slate-300 text-slate-900 -mb-px'
                                : 'bg-slate-200 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-150'
                        }`}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-t-sm transition-colors border-t border-l border-r ${
                            mode === 'register'
                                ? 'bg-white border-slate-300 text-slate-900 -mb-px'
                                : 'bg-slate-200 border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-150'
                        }`}
                    >
                        Registrarse
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 bg-white space-y-4">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                                Nombre Completo
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                placeholder="Ej: Prof. Juan Pérez"
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                            placeholder="profesor@institucion.edu"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className={`border rounded-sm p-3 text-xs font-medium ${
                            error.includes('Cuenta creada')
                                ? 'bg-blue-50 border-blue-300 text-blue-800'
                                : 'bg-red-50 border-red-300 text-red-800'
                        }`}>
                            {error}
                        </div>
                    )}

                    {/* Button Bar */}
                    <div className="pt-2 flex justify-between items-center gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onBack}
                        >
                            Volver al Inicio
                        </Button>

                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Procesando...' : (mode === 'login' ? 'Ingresar' : 'Crear Cuenta')}
                        </Button>
                    </div>
                </form>

                {/* Status Bar */}
                <div className="bg-slate-100 border-t border-slate-300 px-3 py-1.5 text-[11px] text-slate-500 font-mono flex justify-between">
                    <span>Estado: Listo</span>
                    <span>DeBoeckExams v2.0</span>
                </div>
            </div>
        </div>
    );
};
