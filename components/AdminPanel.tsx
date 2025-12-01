import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Subject, Question, ExamConfig, ExamResult, Unit } from '../types';
import { Button } from './Button';
import { Modal } from './Modal';
import { generateQuestionsAI } from '../services/geminiService';

export const AdminPanel: React.FC<{ onLogout: () => void; teacherId: string; teacherName: string; isSuperAdmin: boolean }> = ({ onLogout, teacherId, teacherName, isSuperAdmin }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState<'subjects' | 'questions' | 'exams' | 'results' | 'users'>('subjects');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // State to handle the "Finish & View Results" workflow
  const [resultsFilterSubjectId, setResultsFilterSubjectId] = useState<string>('all');

  // State for pending teachers count (for badge)
  const [pendingTeachersCount, setPendingTeachersCount] = useState<number>(0);

  useEffect(() => {
    refreshSubjects();
    if (isSuperAdmin) {
      loadPendingCount();
    }
  }, []);

  const refreshSubjects = async () => {
    setSubjects(await storageService.getSubjects(teacherId));
  };

  const loadPendingCount = async () => {
    if (isSuperAdmin) {
      const teachers = await storageService.getAllTeachersForAdmin();
      const pending = teachers.filter(t => !t.is_approved).length;
      setPendingTeachersCount(pending);
    }
  };

  const handleFinishExamAndShowResults = (subjectId: string) => {
    setResultsFilterSubjectId(subjectId);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-emerald-700">Panel de Administración</h1>
          <p className="text-sm text-gray-500">Profesor: {teacherName}</p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => {
              const link = `${window.location.origin}?t=${teacherId}`;
              navigator.clipboard.writeText(link);
              alert('¡Link copiado! Compártelo con tus alumnos.');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Link para Alumnos
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-100 pb-1">
          {(isSuperAdmin
            ? ['subjects', 'questions', 'exams', 'results', 'users']
            : ['subjects', 'questions', 'exams', 'results'] as const).map((tab: any) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-50'
                  }`}
              >
                {tab === 'subjects' && 'Espacios Curriculares'}
                {tab === 'questions' && 'Banco de Preguntas'}
                {tab === 'exams' && 'Configuración de Examen'}
                {tab === 'results' && 'Resultados'}
                {tab === 'users' && (
                  <span className="flex items-center gap-2">
                    Gestión de Usuarios
                    {pendingTeachersCount > 0 && (
                      <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                        !
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
        </div>

        <div>
          {activeTab === 'subjects' && (
            <SubjectManager subjects={subjects} onUpdate={refreshSubjects} teacherId={teacherId} />
          )}
          {activeTab === 'questions' && (
            <QuestionManager subjects={subjects} selectedSubjectId={selectedSubjectId} onSelectSubject={setSelectedSubjectId} />
          )}
          {activeTab === 'exams' && (
            <ExamControl subjects={subjects} onFinishAndShowResults={handleFinishExamAndShowResults} />
          )}
          {activeTab === 'results' && (
            <ResultsView
              subjects={subjects}
              initialFilterSubjectId={resultsFilterSubjectId}
              teacherId={teacherId}
              isSuperAdmin={isSuperAdmin}
            />
          )}
          {activeTab === 'users' && isSuperAdmin && (
            <UserManagement onUpdate={loadPendingCount} />
          )}
        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const UnitManager: React.FC<{ subject: Subject, onClose: () => void }> = ({ subject, onClose }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnitName, setNewUnitName] = useState('');

  useEffect(() => {
    loadUnits();
  }, [subject.id]);

  const loadUnits = async () => {
    setUnits(await storageService.getUnits(subject.id));
  };

  const handleAdd = async () => {
    if (!newUnitName.trim()) return;
    await storageService.addUnit(subject.id, newUnitName);
    setNewUnitName('');
    loadUnits();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar unidad? Se borrarán sus preguntas y exámenes.')) {
      await storageService.deleteUnit(id);
      loadUnits();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Unidades: {subject.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              placeholder="Nombre de la Unidad (ej: Unidad 1)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}>Agregar</Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {units.map(u => (
              <div key={u.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                <span className="font-medium text-gray-700">{u.name}</span>
                <button onClick={() => handleDelete(u.id)} className="text-red-300 hover:text-red-500 transition-colors p-1" title="Eliminar Unidad">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
            {units.length === 0 && <p className="text-gray-400 text-center italic py-4">No hay unidades creadas. Agrega una para comenzar.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const SubjectManager: React.FC<{ subjects: Subject[], onUpdate: () => void, teacherId: string }> = ({ subjects, onUpdate, teacherId }) => {
  const [newName, setNewName] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; subjectId: string; subjectName: string } | null>(null);
  const [selectedSubjectForUnits, setSelectedSubjectForUnits] = useState<Subject | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await storageService.addSubject(newName, teacherId);
    setNewName('');
    onUpdate();
  };

  const confirmDelete = async () => {
    if (deleteModal) {
      await storageService.deleteSubject(deleteModal.subjectId);
      onUpdate();
      setDeleteModal(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Agregar Nuevo Espacio Curricular</h3>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej: Historia de la Música II"
            className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd}>Crear</Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Espacios Curriculares Existentes</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map(s => (
            <div key={s.id} className="flex flex-col p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group relative">
              <div className="flex justify-between items-start mb-4">
                <span className="font-semibold text-gray-800 text-lg leading-tight" title={s.name}>{s.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModal({ isOpen: true, subjectId: s.id, subjectName: s.name });
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar Espacio Curricular"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <Button
                variant="secondary"
                onClick={() => setSelectedSubjectForUnits(s)}
                className="w-full text-sm mt-auto"
              >
                Gestionar Unidades
              </Button>
            </div>
          ))}
          {subjects.length === 0 && <p className="text-gray-400 col-span-full py-8 italic">No hay espacios curriculares cargados.</p>}
        </div>
      </div>

      {/* Unit Manager Modal */}
      {selectedSubjectForUnits && (
        <UnitManager
          subject={selectedSubjectForUnits}
          onClose={() => setSelectedSubjectForUnits(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Eliminar Espacio Curricular"
        message={`Estás a punto de eliminar: "${deleteModal?.subjectName}".`}
        warningItems={[
          "Todas sus unidades",
          "Todas sus preguntas",
          "Todas las notas y exámenes de alumnos"
        ]}
        confirmText="Eliminar Definitivamente"
        variant="danger"
      />
    </div>
  );
};

const QuestionManager: React.FC<{ subjects: Subject[], selectedSubjectId: string | null, onSelectSubject: (id: string) => void }> = ({ subjects, selectedSubjectId, onSelectSubject }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('integrative');

  const [questionType, setQuestionType] = useState<import('../types').QuestionType>('multiple_choice');
  const [optionsCount, setOptionsCount] = useState(4);
  const [newQ, setNewQ] = useState<{ text: string; options: string[]; correctOptionIndex: number | number[] }>({
    text: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0
  });

  useEffect(() => {
    if (selectedSubjectId) {
      loadUnits(selectedSubjectId);
    } else {
      setQuestions([]);
      setUnits([]);
    }
  }, [selectedSubjectId]);

  const loadUnits = async (sId: string) => {
    const u = await storageService.getUnits(sId);
    setUnits(u);
  };

  useEffect(() => {
    if (selectedSubjectId) {
      loadQuestions(selectedSubjectId, selectedUnitId);
    }
  }, [selectedSubjectId, selectedUnitId]);

  const loadQuestions = async (sId: string, uId: string) => {
    if (uId === 'integrative') {
      setQuestions(await storageService.getQuestions(sId));
    } else {
      setQuestions(await storageService.getQuestions(sId, uId));
    }
  };

  // Reset form when switching types or options count
  useEffect(() => {
    if (questionType === 'true_false') {
      setNewQ(prev => ({ ...prev, options: ['Verdadero', 'Falso'], correctOptionIndex: 0 }));
    } else if (questionType === 'fill_blank') {
      setNewQ(prev => ({ ...prev, options: ['', '', ''], correctOptionIndex: 0 }));
    } else if (questionType === 'multiple_select') {
      setNewQ(prev => ({ ...prev, options: Array(optionsCount).fill(''), correctOptionIndex: [] }));
    } else {  // multiple_choice
      setNewQ(prev => ({ ...prev, options: Array(optionsCount).fill(''), correctOptionIndex: 0 }));
    }
  }, [questionType, optionsCount]);

  const handleAddManual = async () => {
    if (!selectedSubjectId || !newQ.text) return;
    if (selectedUnitId === 'integrative') {
      alert("Por favor, selecciona una Unidad específica para agregar nuevas preguntas.");
      return;
    }

    // Validate options are filled
    if (questionType !== 'true_false' && newQ.options.some(o => !o.trim())) return;

    await storageService.addQuestion({
      ...newQ,
      questionType,
      subjectId: selectedSubjectId,
      unitId: selectedUnitId,
      isActive: true,
      isActiveIntegrative: false
    });

    // Reset form
    setNewQ({
      text: '',
      options: questionType === 'true_false' ? ['Verdadero', 'Falso'] : Array(optionsCount).fill(''),
      correctOptionIndex: 0
    });
    loadQuestions(selectedSubjectId, selectedUnitId);
  };

  const handleDelete = async (id: string) => {
    await storageService.deleteQuestion(id);
    if (selectedSubjectId) loadQuestions(selectedSubjectId, selectedUnitId);
  };

  const toggleQuestionStatus = async (question: Question) => {
    let updated;
    if (selectedUnitId === 'integrative') {
      updated = { ...question, isActiveIntegrative: !question.isActiveIntegrative };
    } else {
      updated = { ...question, isActive: !question.isActive };
    }
    await storageService.updateQuestion(updated);
    if (selectedSubjectId) loadQuestions(selectedSubjectId, selectedUnitId);
  };

  const handleBulkAction = async (action: 'enable' | 'disable') => {
    if (!selectedSubjectId) return;
    if (selectedUnitId === 'integrative') {
      alert("La acción masiva solo está disponible dentro de una Unidad específica.");
      return;
    }
    await storageService.updateAllQuestionsStatus(selectedSubjectId, action === 'enable');
    loadQuestions(selectedSubjectId, selectedUnitId);
  };

  if (!selectedSubjectId) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
        <h3 className="text-lg font-medium text-gray-600 mb-6">Selecciona un Espacio Curricular para gestionar sus preguntas</h3>
        <div className="flex flex-wrap gap-3 justify-center max-w-2xl mx-auto px-4">
          {subjects.map(s => (
            <Button key={s.id} variant="outline" onClick={() => onSelectSubject(s.id)} className="border-gray-300 hover:border-emerald-500 hover:text-emerald-600">
              {s.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const activeCount = questions.filter(q => selectedUnitId === 'integrative' ? q.isActiveIntegrative : q.isActive).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{currentSubject?.name}</h2>
          <p className="text-gray-500 text-sm">Gestión de banco de preguntas</p>
        </div>
        <div className="flex gap-4 items-center">
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="integrative">Examen Integrador (Todas)</option>
            {units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => onSelectSubject('')} className="text-sm">Cambiar Espacio</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        {/* Manual Add - Only visible if a Unit is selected */}
        {selectedUnitId !== 'integrative' ? (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                Nueva Pregunta ({units.find(u => u.id === selectedUnitId)?.name})
              </h3>
              <div className="space-y-2">
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as import('../types').QuestionType)}
                  className="text-xs px-3 py-2 rounded-lg border border-gray-300 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="multiple_choice">Opción Múltiple</option>
                  <option value="true_false">Verdadero/Falso</option>
                  <option value="fill_blank">Completar Frase</option>
                  <option value="multiple_select">Selección Múltiple</option>
                </select>

                {questionType === 'multiple_choice' && (
                  <select
                    value={optionsCount}
                    onChange={(e) => setOptionsCount(Number(e.target.value))}
                    className="text-xs px-3 py-2 rounded-lg border border-gray-300 font-medium focus:ring-2 focus:ring-emerald-500 outline-none ml-2"
                  >
                    {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} Opciones</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Enunciado</label>
                <textarea
                  value={newQ.text}
                  onChange={(e) => setNewQ({ ...newQ, text: e.target.value })}
                  placeholder="Escribe la pregunta aquí..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-24"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-500">Opciones (Marca la correcta)</label>
                {newQ.options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type={questionType === 'multiple_select' ? 'checkbox' : 'radio'}
                      name="correctOption"
                      checked={Array.isArray(newQ.correctOptionIndex) ? newQ.correctOptionIndex.includes(idx) : newQ.correctOptionIndex === idx}
                      onChange={() => {
                        if (questionType === 'multiple_select') {
                          const current = Array.isArray(newQ.correctOptionIndex) ? newQ.correctOptionIndex : [];
                          const newIndices = current.includes(idx)
                            ? current.filter(i => i !== idx)
                            : [...current, idx];
                          setNewQ({ ...newQ, correctOptionIndex: newIndices });
                        } else {
                          setNewQ({ ...newQ, correctOptionIndex: idx });
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...newQ.options];
                        newOptions[idx] = e.target.value;
                        setNewQ({ ...newQ, options: newOptions });
                      }}
                      placeholder={`Opción ${idx + 1}`}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                      readOnly={questionType === 'true_false'}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={handleAddManual} className="w-full justify-center">Agregar Pregunta</Button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center h-full">
            <h3 className="text-lg font-bold text-blue-800 mb-2">Modo Examen Integrador</h3>
            <p className="text-blue-600 mb-4">En este modo, seleccionas preguntas existentes de las Unidades para incluirlas en el Examen Integrador.</p>
            <p className="text-sm text-blue-500">Para crear nuevas preguntas, selecciona una Unidad específica en el menú superior.</p>
          </div>
        )}

        {/* Question List */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">Banco de Preguntas ({questions.length})</h3>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                {activeCount} Activas {selectedUnitId === 'integrative' ? '(Integrador)' : '(Parcial)'}
              </span>
              {selectedUnitId !== 'integrative' && (
                <div className="flex gap-1">
                  <button onClick={() => handleBulkAction('enable')} className="text-xs text-emerald-600 hover:underline">Activar Todas</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => handleBulkAction('disable')} className="text-xs text-gray-500 hover:underline">Desactivar Todas</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {questions.map((q, i) => {
              const isActive = selectedUnitId === 'integrative' ? q.isActiveIntegrative : q.isActive;
              return (
                <div key={q.id} className={`p-4 rounded-lg border transition-all ${isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-white opacity-75'}`}>
                  <div className="flex justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${q.questionType === 'multiple_choice' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          q.questionType === 'true_false' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            q.questionType === 'multiple_select' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                              'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                          {q.questionType === 'multiple_choice' ? 'Opción Múltiple' :
                            q.questionType === 'true_false' ? 'V/F' :
                              q.questionType === 'multiple_select' ? 'Sel. Múltiple' : 'Completar'}
                        </span>
                        {selectedUnitId === 'integrative' && q.unitId && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {units.find(u => u.id === q.unitId)?.name || 'Unidad'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 font-medium text-sm mb-2">{q.text}</p>
                      <div className="pl-4 border-l-2 border-gray-100 space-y-1">
                        {q.options.map((opt, idx) => {
                          const isCorrect = Array.isArray(q.correctOptionIndex)
                            ? q.correctOptionIndex.includes(idx)
                            : q.correctOptionIndex === idx;
                          return (
                            <div key={idx} className={`text-xs flex items-center gap-2 ${isCorrect ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                              {isCorrect && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => toggleQuestionStatus(q)}
                        className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        title={isActive ? "Desactivar pregunta" : "Activar pregunta"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-300 hover:text-red-500 hover:border-red-200 transition-colors"
                        title="Eliminar pregunta"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {questions.length === 0 && <p className="text-center text-gray-400 py-10">No hay preguntas en esta materia.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ExamControl: React.FC<{ subjects: Subject[], onFinishAndShowResults: (id: string) => void }> = ({ subjects, onFinishAndShowResults }) => {
  const [examRows, setExamRows] = useState<{
    subjectId: string;
    subjectName: string;
    unitId?: string;
    unitName: string;
    config: ExamConfig;
  }[]>([]);

  useEffect(() => {
    loadAllConfigs();
  }, [subjects]);

  const loadAllConfigs = async () => {
    const rows = [];
    for (const s of subjects) {
      // Integrative Exam
      const intConfig = await storageService.getExamConfig(s.id);
      rows.push({
        subjectId: s.id,
        subjectName: s.name,
        unitName: "Examen Integrador",
        config: intConfig
      });

      // Unit Exams
      const units = await storageService.getUnits(s.id);
      for (const u of units) {
        const uConfig = await storageService.getExamConfig(s.id, u.id);
        rows.push({
          subjectId: s.id,
          subjectName: s.name,
          unitId: u.id,
          unitName: u.name,
          config: uConfig
        });
      }
    }
    setExamRows(rows);
  };

  const toggleActive = async (row: typeof examRows[0]) => {
    const newConfig = { ...row.config, isActive: !row.config.isActive };
    await storageService.saveExamConfig(newConfig);
    await loadAllConfigs();
  };

  const updatePassingGrade = async (row: typeof examRows[0], grade: number) => {
    const newConfig = { ...row.config, passingGrade: grade };
    await storageService.saveExamConfig(newConfig);
    await loadAllConfigs();
  };

  const handleFinishExam = async (row: typeof examRows[0]) => {
    const newConfig = { ...row.config, isActive: false };
    await storageService.saveExamConfig(newConfig);
    await loadAllConfigs();
    onFinishAndShowResults(row.subjectId);
  };

  // Group rows by subject for better visual organization
  type ExamRow = typeof examRows[0];
  const subjectGroups = examRows.reduce((acc, row) => {
    if (!acc[row.subjectId]) {
      acc[row.subjectId] = [];
    }
    acc[row.subjectId].push(row);
    return acc;
  }, {} as Record<string, ExamRow[]>);

  return (
    <div className="space-y-6">
      {Object.entries(subjectGroups).map(([subjectId, rows]: [string, ExamRow[]]) => (
        <div key={subjectId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800">{rows[0].subjectName}</h3>
            <p className="text-xs text-gray-500 mt-1">Configura los exámenes para cada unidad y el examen integrador</p>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Examen</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nota para Aprobar</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, idx) => (
                <tr key={`${row.subjectId}-${row.unitId || 'integrative'}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {!row.unitId && (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                      )}
                      <span className={`text-sm ${!row.unitId ? 'font-bold text-blue-700' : 'font-medium text-gray-900'}`}>
                        {row.unitName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${row.config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {row.config.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={row.config.passingGrade}
                      onChange={(e) => updatePassingGrade(row, Number(e.target.value))}
                      className="bg-white border border-gray-300 rounded-md text-sm py-1 pl-2 pr-8 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                    >
                      <option value={4}>4 (Cuatro)</option>
                      <option value={5}>5 (Cinco)</option>
                      <option value={6}>6 (Seis)</option>
                      <option value={7}>7 (Siete)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {row.config.isActive ? (
                      <Button
                        variant="danger"
                        onClick={() => handleFinishExam(row)}
                        className="text-xs px-4 py-2 flex items-center gap-2"
                        title="Finaliza el examen y muestra resultados"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Finalizar
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => toggleActive(row)}
                        className="text-xs px-4 py-2"
                      >
                        Activar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {subjects.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400">No hay espacios curriculares para configurar.</p>
        </div>
      )}
    </div>
  );
};

const ResultsView: React.FC<{ subjects: Subject[], initialFilterSubjectId: string, teacherId: string, isSuperAdmin: boolean }> = ({ subjects, initialFilterSubjectId, teacherId, isSuperAdmin }) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    setFilterSubjectId(initialFilterSubjectId);
  }, [initialFilterSubjectId]);

  useEffect(() => {
    refreshResults();
  }, []);

  const refreshResults = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // If super admin, fetch all (pass undefined). If teacher, pass teacherId.
      const allResults = await storageService.getResults(isSuperAdmin ? undefined : teacherId);
      setResults(allResults.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error("Error loading results:", e);
      setError("Error al cargar los resultados. Por favor, intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const confirmDeleteHistory = async () => {
    await storageService.deleteResults(filterSubjectId);
    refreshResults();
    setDeleteModalOpen(false);
  };

  const getDeleteMessage = () => {
    const isAll = filterSubjectId === 'all';
    const subjectName = isAll ? 'TODOS los exámenes' : subjects.find(s => s.id === filterSubjectId)?.name;
    return `¿Estás seguro de que quieres borrar el historial de ${subjectName}?`;
  };

  const handlePrintPDF = () => {
    if (!tableRef.current) return;

    // Create a new window for printing
    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) return;

    const filtered = filterSubjectId === 'all'
      ? results
      : results.filter(r => r.subjectId === filterSubjectId);

    const subjectTitle = filterSubjectId === 'all' ? 'Reporte General' : subjects.find(s => s.id === filterSubjectId)?.name;

    printWindow.document.write('<html><head><title>Resultados de Exámenes</title>');
    // Minimal css for print
    printWindow.document.write(`
        <style>
            body { font-family: sans-serif; padding: 20px; color: #111; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 16px; font-weight: normal; color: #555; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f3f3f3; font-weight: bold; }
            .failed { color: #d32f2f; font-weight: bold; }
            .passed { color: #388e3c; font-weight: bold; }
            @media print {
                @page { size: A4; margin: 2cm; }
            }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>DeBoeck Exams</h1>`);
    printWindow.document.write(`<h2>${subjectTitle} - Fecha: ${new Date().toLocaleDateString()}</h2>`);

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Alumno</th>
                    <th>Materia</th>
                    <th>Tipo</th>
                    <th>Aciertos</th>
                    <th>Nota</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    filtered.forEach(r => {
      tableHtml += `
            <tr>
                <td>${new Date(r.timestamp).toLocaleDateString()} ${new Date(r.timestamp).toLocaleTimeString()}</td>
                <td>${r.studentName}</td>
                <td>${r.subjectName}</td>
                <td>${r.type === 'integrative' ? 'Integrador' : (r.unitName || 'Unidad')}</td>
                <td>${r.score}/${r.totalQuestions} (${r.percentage.toFixed(0)}%)</td>
                <td>${r.grade.toFixed(1)}</td>
                <td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? 'APROBADO' : 'REPROBADO'}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    printWindow.document.write(tableHtml);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    // Allow styles to load slightly before printing
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const filteredResults = filterSubjectId === 'all'
    ? results
    : results.filter(r => r.subjectId === filterSubjectId);

  // Stats calculation
  const total = filteredResults.length;
  const passed = filteredResults.filter(r => r.passed).length;
  const avgGrade = total > 0 ? (filteredResults.reduce((acc, r) => acc + r.grade, 0) / total).toFixed(1) : '-';
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(0) : '-';

  // Safety check
  if (!subjects) {
    console.error("ResultsView: subjects prop is missing");
    return <div className="p-4 text-red-500">Error interno: Faltan datos de materias.</div>;
  }

  console.log('ResultsView rendering', { isLoading, error, resultsCount: results.length, subjectsCount: subjects.length });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error al cargar resultados</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={refreshResults} variant="primary">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Historial de Exámenes</h2>
          <p className="text-sm text-gray-500 mt-1">Reporte detallado de alumnos y calificaciones.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg text-sm px-4 py-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            <option value="all">Todas las Materias</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button variant="outline" onClick={refreshResults} className="text-xs border-gray-300">Actualizar</Button>
          <Button variant="secondary" onClick={handlePrintPDF} disabled={filteredResults.length === 0} className="text-xs flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Imprimir / PDF
          </Button>
          <Button variant="danger" onClick={() => setDeleteModalOpen(true)} disabled={filteredResults.length === 0} className="text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
            Borrar Historial
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Evaluados</span>
          <span className="text-3xl font-bold text-gray-800 mt-1">{total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Promedio Nota</span>
          <span className="text-3xl font-bold text-emerald-600 mt-1">{avgGrade}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aprobados</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-800">{passRate}%</span>
            <span className="text-sm text-gray-400">({passed}/{total})</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" ref={tableRef}>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Alumno</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Materia</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Aciertos</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nota Final</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredResults.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(r.timestamp).toLocaleDateString()} <span className="text-xs text-gray-400 ml-1">{new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.studentName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.subjectName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {r.type === 'integrative' ? (
                    <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100">Integrador</span>
                  ) : (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100">{r.unitName || 'Unidad'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="font-medium">{r.score}</span> <span className="text-xs text-gray-400">/ {r.totalQuestions}</span>
                  <span className="text-xs text-gray-400">({r.percentage.toFixed(0)}%)</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${r.passed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {r.grade.toFixed(1)} {r.passed ? 'APROBADO' : 'REPROBADO'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredResults.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay resultados que coincidan con el filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteHistory}
        title="Borrar Historial"
        message={getDeleteMessage()}
        warningItems={["Esta acción es irreversible", "Se perderán todos los registros de notas seleccionados"]}
        confirmText="Borrar Historial"
        variant="danger"
      />
    </div>
  );
};

// UserManagement Component (only for super admins)
const UserManagement: React.FC<{ onUpdate?: () => void }> = ({ onUpdate }) => {
  const [teachers, setTeachers] = useState<import('../types').Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; teacherId: string; teacherName: string } | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setIsLoading(true);
    const allTeachers = await storageService.getAllTeachersForAdmin();
    setTeachers(allTeachers);
    setIsLoading(false);
    onUpdate?.(); // Notify parent to update badge
  };

  const handleToggleApproval = async (teacherId: string, currentStatus: boolean) => {
    await storageService.updateTeacherApproval(teacherId, !currentStatus);
    await loadTeachers();
  };

  const handleDeleteClick = (teacherId: string, teacherName: string) => {
    setDeleteModal({ isOpen: true, teacherId, teacherName });
  };

  const confirmDelete = async () => {
    if (deleteModal) {
      await storageService.deleteTeacher(deleteModal.teacherId);
      setDeleteModal(null);
      await loadTeachers();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const pendingTeachers = teachers.filter(t => !t.is_approved);
  const approvedTeachers = teachers.filter(t => t.is_approved);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestión de Usuarios</h2>

        {/* Pending Approval */}
        {pendingTeachers.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-orange-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Pendientes de Aprobación ({pendingTeachers.length})
            </h3>
            <div className="space-y-3">
              {pendingTeachers.map(teacher => (
                <div key={teacher.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{teacher.name}</p>
                    <p className="text-sm text-gray-600">{teacher.email}</p>
                  </div>
                  <button
                    onClick={() => handleToggleApproval(teacher.id, teacher.is_approved || false)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    Aprobar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved Teachers */}
        <div>
          <h3 className="text-lg font-semibold text-emerald-700 mb-4">
            Profesores Aprobados ({approvedTeachers.length})
          </h3>
          <div className="space-y-3">
            {approvedTeachers.length > 0 ? (
              approvedTeachers.map(teacher => (
                <div key={teacher.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{teacher.name}</p>
                    <p className="text-sm text-gray-600">{teacher.email}</p>
                    {teacher.email === 'profesor.prueba@deboeckexams.com' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1 inline-block">
                        Usuario de Prueba
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleApproval(teacher.id, teacher.is_approved || false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      Desaprobar
                    </button>
                    <button
                      onClick={() => handleDeleteClick(teacher.id, teacher.name)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400">No hay profesores aprobados aún.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal?.isOpen || false}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Eliminar Profesor"
        message={`¿Estás seguro de eliminar a "${deleteModal?.teacherName}"?`}
        warningItems={[
          "Se eliminarán todas sus materias",
          "Se eliminarán todas sus preguntas",
          "Esta acción es irreversible"
        ]}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
};
``
