import React from 'react';
import { Button } from './Button';

export const LandingPage: React.FC<{ onAdminClick: () => void }> = ({ onAdminClick }) => {
    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
            {/* Top Windows Application Bar */}
            <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        {/* Brand */}
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-lg tracking-wide">DeBoeckExams</span>
                            <span className="text-slate-400 font-mono text-xs hidden sm:inline">[Sistema de Evaluación Académica]</span>
                        </div>

                        {/* Admin Push Button */}
                        <Button
                            variant="primary"
                            onClick={onAdminClick}
                            className="text-xs"
                        >
                            Acceso Profesores
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <div className="inline-block bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-sm text-xs font-mono font-bold text-emerald-900 uppercase tracking-widest mb-4">
                    Plataforma Institucional de Exámenes
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                    Sistema de Gestión y Evaluación de Exámenes
                </h1>
                <p className="text-lg text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                    Entorno estructurado para la confección, administración y supervisión de evaluaciones en línea, garantizando integridad académica y precisión en los resultados.
                </p>
                <div className="flex justify-center">
                    <div className="bg-white border border-slate-300 rounded-sm px-6 py-3 text-slate-800 shadow-xs max-w-md w-full">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">¿Es alumno de la cátedra?</p>
                        <p className="text-xs text-slate-500 mt-1">Acceda directamente a través del enlace facilitado por su docente titular.</p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="border-b border-slate-300 pb-3 mb-8">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Módulos Principales del Sistema
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Funcionalidades orientadas a la gestión docente y control de exámenes
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Feature 1 */}
                    <div className="bg-white rounded-sm border border-slate-300 shadow-xs p-6 flex flex-col justify-between">
                        <div>
                            <div className="mb-4 bg-slate-100 border border-slate-200 overflow-hidden rounded-xs">
                                <img
                                    src="/images/feature-personalized-exams.png"
                                    alt="Exámenes Personalizados"
                                    className="w-full h-44 object-cover"
                                />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                                [ MÓDULO 01 ]
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Exámenes Personalizados</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Confección de exámenes adaptados por unidades y temas, con selección de preguntas específicas o aleatorias y cronometraje sincronizado.
                            </p>
                        </div>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white rounded-sm border border-slate-300 shadow-xs p-6 flex flex-col justify-between">
                        <div>
                            <div className="mb-4 bg-slate-100 border border-slate-200 overflow-hidden rounded-xs">
                                <img
                                    src="/images/feature-question-management.png"
                                    alt="Gestión de Preguntas"
                                    className="w-full h-44 object-cover"
                                />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                                [ MÓDULO 02 ]
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Banco de Preguntas</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Organización estructurada de reactivos pedagógicos con soporte de formatos múltiples: opción única, opción múltiple y verdadero/falso.
                            </p>
                        </div>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white rounded-sm border border-slate-300 shadow-xs p-6 flex flex-col justify-between">
                        <div>
                            <div className="mb-4 bg-slate-100 border border-slate-200 overflow-hidden rounded-xs">
                                <img
                                    src="/images/feature-realtime-results.png"
                                    alt="Resultados en Tiempo Real"
                                    className="w-full h-44 object-cover"
                                />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                                [ MÓDULO 03 ]
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Resultados Inmediatos</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Calificación instantánea, cálculo de calificaciones ponderadas y auditoría de integridad académica en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security & Reliability Section */}
            <section className="bg-slate-200/70 border-t border-b border-slate-300 py-12 mt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-xl font-bold text-center text-slate-900 mb-8 tracking-tight">
                        Seguridad y Especificaciones Técnicas
                    </h2>

                    <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                        <div className="bg-white p-5 rounded-sm border border-slate-300">
                            <span className="text-xs font-mono font-bold text-emerald-800 block mb-1">[ AUDITORÍA ]</span>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Control de Foco e Integridad</h4>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                Registro automático de pérdida de foco, cambios de pestaña y eventos sospechosos con identificación de dispositivo (UUID).
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-sm border border-slate-300">
                            <span className="text-xs font-mono font-bold text-emerald-800 block mb-1">[ CONECTIVIDAD ]</span>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Operación Sin Instalación</h4>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                Funcionamiento autónomo en cualquier navegador web moderno, optimizado para equipos de escritorio y dispositivos móviles.
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-sm border border-slate-300">
                            <span className="text-xs font-mono font-bold text-emerald-800 block mb-1">[ ALMACENAMIENTO ]</span>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Persistencia Centralizada</h4>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                Base de datos relacional en la nube para resguardo íntegro de respuestas, preguntas y eventos de auditoría.
                            </p>
                        </div>

                        <div className="bg-white p-5 rounded-sm border border-slate-300">
                            <span className="text-xs font-mono font-bold text-emerald-800 block mb-1">[ INFORMES ]</span>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Actas de Examen Exportables</h4>
                            <p className="text-slate-600 text-xs leading-relaxed">
                                Generación de actas institucionales detalladas con estadísticas de aprobación y revisión individual de respuestas.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-white py-8 border-t border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs">
                    <p className="text-slate-400 mb-1">
                        Desarrollo y diseño de plataforma: <span className="text-slate-200 font-semibold">A. C. De Boeck</span>
                    </p>
                    <p className="text-slate-500 mb-2 font-mono">
                        Contacto institucional: adolfodeboeck@gmail.com
                    </p>
                    <p className="text-slate-600 font-mono text-[11px]">
                        DeBoeckExams © {new Date().getFullYear()} — Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
};
