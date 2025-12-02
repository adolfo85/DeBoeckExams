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
                    const teacher = await storageService.register(name, email, password);
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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-emerald-500">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-emerald-900 mb-2">DeBoeckExams</h1>
                    <p className="text-gray-500">Panel de Profesores</p>
                </div>

                <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${mode === 'login'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Ingresar
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('register'); setError(''); }}
                        className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${mode === 'register'
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Registrarse
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Nombre Completo
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400"
                                placeholder="Ej: Juan Pérez"
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400"
                            placeholder="profesor@ejemplo.com"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400"
                            placeholder="••••••••"
                            disabled={isLoading}
                        />
                    </div>

                    {error && (
                        <div className={`border rounded-lg p-3 text-sm ${error.includes('Cuenta creada')
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}>
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 text-lg shadow-lg shadow-emerald-200"
                    >
                        {isLoading ? 'Procesando...' : (mode === 'login' ? 'Ingresar' : 'Crear Cuenta')}
                    </Button>

                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full mt-3 text-gray-500 text-sm hover:text-gray-700 transition-colors"
                    >
                        ← Volver
                    </button>
                </form>
            </div>
        </div>
    );
};
