import React from 'react';
import { Button } from './Button';

export const LandingPage: React.FC<{ onAdminClick: () => void }> = ({ onAdminClick }) => {
    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
            {/* Navbar */}
            <nav className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 shadow-2xl sticky top-0 z-50 border-b-2 border-emerald-600">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 relative">
                        {/* Brand */}
                        <div className="flex items-center">
                            <span className="text-white font-bold text-2xl tracking-tight">DeBoeckExams</span>
                        </div>

                        {/* Vertical Divider */}
                        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-emerald-400 to-transparent"></div>

                        {/* Admin Button */}
                        <button
                            onClick={onAdminClick}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-500 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            Acceso Profesores
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
                    Bienvenido a <span className="text-emerald-700">DeBoeckExams</span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    La plataforma completa para crear, gestionar y evaluar exámenes en línea de manera profesional y eficiente.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg px-6 py-3 text-emerald-900">
                        <p className="text-sm font-medium">¿Eres estudiante?</p>
                        <p className="text-xs text-emerald-700 mt-1">Accede mediante el link compartido por tu profesor</p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
                    Ventajas del Sistema
                </h2>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="/images/feature-personalized-exams.png"
                                alt="Exámenes Personalizados"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-800 mb-3">Exámenes Personalizados</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Crea exámenes adaptados a tus necesidades. Define unidades, temas, y selecciona preguntas específicas o aleatorias para cada evaluación.
                        </p>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="/images/feature-question-management.png"
                                alt="Gestión de Preguntas"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-800 mb-3">Banco de Preguntas</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Organiza y gestiona tu biblioteca de preguntas por temas y unidades. Soporta múltiples tipos: opción múltiple, verdadero/falso, completar espacios y más.
                        </p>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                        <div className="mb-6">
                            <img
                                src="/images/feature-realtime-results.png"
                                alt="Resultados en Tiempo Real"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-800 mb-3">Resultados Instantáneos</h3>
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
                            <svg className="w-6 h-6 text-emerald-700 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Fácil de Usar</h4>
                                <p className="text-gray-600 text-sm">Interfaz intuitiva tanto para profesores como estudiantes.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-700 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Sin Instalación</h4>
                                <p className="text-gray-600 text-sm">Acceso desde cualquier dispositivo con navegador web.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-700 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-1">Seguro y Confiable</h4>
                                <p className="text-gray-600 text-sm">Tus datos y resultados siempre protegidos.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 bg-white p-6 rounded-lg shadow-sm">
                            <svg className="w-6 h-6 text-emerald-700 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <footer className="bg-gray-900 text-white py-10 mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-gray-400 mb-3">
                        Idea y desarrollo: <span className="text-emerald-400 font-semibold">A. C. De Boeck</span>
                    </p>
                    <p className="text-gray-400 mb-3">
                        Contacto: <a href="mailto:adolfodeboeck@gmail.com" className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200">adolfodeboeck@gmail.com</a>
                    </p>
                    <p className="text-gray-500 text-sm mt-4">
                        © {new Date().getFullYear()} DeBoeckExams. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
};
