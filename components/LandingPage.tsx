import React from 'react';
import { Button } from './Button';

export const LandingPage: React.FC<{ onAdminClick: () => void }> = ({ onAdminClick }) => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
            {/* Navbar */}
            <nav className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo and Brand */}
                        <div className="flex items-center gap-3">
                            <img
                                src="C:/Users/Adolfo/.gemini/antigravity/brain/4d805fbe-8d7f-40d3-af2f-0ce234a55679/deboeck_exams_logo_1764635468618.png"
                                alt="DeBoeckExams Logo"
                                className="h-10 w-10 object-contain"
                            />
                            <span className="text-white font-bold text-xl tracking-tight">DeBoeckExams</span>
                        </div>

                        {/* Admin Button */}
                        <button
                            onClick={onAdminClick}
                            className="bg-white text-emerald-700 px-5 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            Acceso Profesores
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
                    Bienvenido a <span className="text-emerald-600">DeBoeckExams</span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    La plataforma completa para crear, gestionar y evaluar exámenes en línea de manera profesional y eficiente.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-6 py-3 text-emerald-800">
                        <p className="text-sm font-medium">¿Eres estudiante?</p>
                        <p className="text-xs text-emerald-600 mt-1">Accede mediante el link compartido por tu profesor</p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
                    Características Destacadas
                </h2>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="C:/Users/Adolfo/.gemini/antigravity/brain/4d805fbe-8d7f-40d3-af2f-0ce234a55679/feature_personalized_exams_1764635483107.png"
                                alt="Exámenes Personalizados"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-700 mb-3">Exámenes Personalizados</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Crea exámenes adaptados a tus necesidades. Define unidades, temas, y selecciona preguntas específicas o aleatorias para cada evaluación.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="C:/Users/Adolfo/.gemini/antigravity/brain/4d805fbe-8d7f-40d3-af2f-0ce234a55679/feature_question_management_1764635498941.png"
                                alt="Gestión de Preguntas"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-700 mb-3">Banco de Preguntas</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Organiza y gestiona tu biblioteca de preguntas por temas y unidades. Soporta múltiples tipos: opción múltiple, verdadero/falso, completar espacios y más.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="C:/Users/Adolfo/.gemini/antigravity/brain/4d805fbe-8d7f-40d3-af2f-0ce234a55679/feature_realtime_results_1764635512978.png"
                                alt="Resultados en Tiempo Real"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-700 mb-3">Resultados Instantáneos</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Obtén resultados automáticos al finalizar cada examen. Visualiza estadísticas, promedios y desempeño de tus estudiantes en tiempo real.
                        </p>
                    </div>
                </div>
            </section>

            {/* Additional Features */}
            <section className="bg-emerald-50 py-16 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">
                        ¿Por qué elegir DeBoeckExams?
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Fácil de Usar</h4>
                                <p className="text-gray-600 text-sm">Interfaz intuitiva tanto para profesores como estudiantes.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Sin Instalación</h4>
                                <p className="text-gray-600 text-sm">Acceso desde cualquier dispositivo con navegador web.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Seguro y Confiable</h4>
                                <p className="text-gray-600 text-sm">Tus datos y resultados siempre protegidos.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Reportes Detallados</h4>
                                <p className="text-gray-600 text-sm">Exporta e imprime resultados en formato profesional.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8 mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-gray-400">
                        Idea y desarrollo: <span className="text-emerald-400 font-semibold">A. C. De Boeck</span>
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                        © {new Date().getFullYear()} DeBoeckExams. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
};
