import React, { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { StudentView } from './components/StudentView';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { storageService } from './services/storageService';

function App() {
  // Simple state routing: 'landing', 'student', 'adminLogin', 'adminPanel'
  const [view, setView] = useState<'landing' | 'student' | 'adminLogin' | 'adminPanel'>('landing');
  const [currentTeacher, setCurrentTeacher] = useState<{ id: string; name: string; isSuperAdmin?: boolean } | null>(null);

  // Run schema migration on app mount
  useEffect(() => {
    storageService.migrateSchema().catch(err => {
      console.error('Schema migration failed:', err);
    });

    // Check if there's a teacher ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const teacherId = urlParams.get('t');

    if (teacherId) {
      // If there's a teacher ID, go directly to student view
      setView('student');
    } else {
      // Otherwise, show landing page
      setView('landing');
    }
  }, []);

  const handleLogin = (teacherId: string, teacherName: string, isSuperAdmin?: boolean) => {
    setCurrentTeacher({ id: teacherId, name: teacherName, isSuperAdmin });
    setView('adminPanel');
  };

  const handleLogout = () => {
    setCurrentTeacher(null);
    setView('landing');
  };

  return (
    <div className="antialiased text-gray-900 font-sans">
      {view === 'landing' && (
        <LandingPage onAdminClick={() => setView('adminLogin')} />
      )}

      {view === 'student' && (
        <StudentView onAdminLoginClick={() => setView('adminLogin')} />
      )}

      {view === 'adminLogin' && (
        <Login onLogin={handleLogin} onBack={() => setView('landing')} />
      )}

      {view === 'adminPanel' && currentTeacher && (
        <AdminPanel
          onLogout={handleLogout}
          teacherId={currentTeacher.id}
          teacherName={currentTeacher.name}
          isSuperAdmin={currentTeacher.isSuperAdmin || false}
        />
      )}
    </div>
  );
}

export default App;