import React, { useState, useEffect } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { StudentView } from './components/StudentView';
import { Login } from './components/Login';
import { storageService } from './services/storageService';

function App() {
  // Simple state routing: 'student', 'adminLogin', 'adminPanel'
  const [view, setView] = useState<'student' | 'adminLogin' | 'adminPanel'>('student');
  const [currentTeacher, setCurrentTeacher] = useState<{ id: string; name: string; isSuperAdmin?: boolean } | null>(null);

  // Run schema migration on app mount
  useEffect(() => {
    storageService.migrateSchema().catch(err => {
      console.error('Schema migration failed:', err);
    });
  }, []);

  const handleLogin = (teacherId: string, teacherName: string, isSuperAdmin?: boolean) => {
    setCurrentTeacher({ id: teacherId, name: teacherName, isSuperAdmin });
    setView('adminPanel');
  };

  const handleLogout = () => {
    setCurrentTeacher(null);
    setView('student');
  };

  return (
    <div className="antialiased text-gray-900 font-sans">
      {view === 'student' && (
        <StudentView onAdminLoginClick={() => setView('adminLogin')} />
      )}

      {view === 'adminLogin' && (
        <Login onLogin={handleLogin} onBack={() => setView('student')} />
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