import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Subject, Question, ExamConfig, ExamResult, Unit } from '../types';
import { Button } from './Button';
import { Modal } from './Modal';
import { generateQuestionsAI } from '../services/geminiService';

export const AdminPanel: React.FC<{ onLogout: () => void; teacherId: string; teacherName: string; isSuperAdmin: boolean }> = ({ onLogout, teacherId, teacherName, isSuperAdmin }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState<'subjects' | 'questions' | 'results' | 'users'>('subjects');
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

      <div className={`flex-1 w-full mx-auto p-4 md:p-8 transition-all duration-300 ${activeTab === 'questions' ? 'max-w-[95%]' : 'max-w-7xl'}`}>
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-100 pb-1">
          {(isSuperAdmin
            ? ['subjects', 'questions', 'results', 'users']
            : ['subjects', 'questions', 'results'] as const).map((tab: any) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-50'
                  }`}
              >
                {tab === 'subjects' && 'Espacios Curriculares'}
                {tab === 'questions' && 'Banco de Preguntas/Configuración de Examen'}
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
          <div style={{ display: activeTab === 'subjects' ? 'block' : 'none' }}>
            <SubjectManager subjects={subjects} onUpdate={refreshSubjects} teacherId={teacherId} />
          </div>
          <div style={{ display: activeTab === 'questions' ? 'block' : 'none' }}>
            <QuestionManager subjects={subjects} selectedSubjectId={selectedSubjectId} onSelectSubject={setSelectedSubjectId} />
          </div>
          <div style={{ display: activeTab === 'results' ? 'block' : 'none' }}>
            <ResultsView
              subjects={subjects}
              initialFilterSubjectId={resultsFilterSubjectId}
              teacherId={teacherId}
              isSuperAdmin={isSuperAdmin}
              isActive={activeTab === 'results'}
            />
          </div>
          {isSuperAdmin && (
            <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
              <UserManagement onUpdate={loadPendingCount} />
            </div>
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
  const [newQ, setNewQ] = useState<{ text: string; options: string[]; correctOptionIndex: number | number[]; topic: string }>({
    text: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    topic: ''
  });

  // Integrative Mode States
  const [integrativeMode, setIntegrativeMode] = useState<'random' | 'manual'>('random');
  const [selectedUnitsForIntegrative, setSelectedUnitsForIntegrative] = useState<Set<string>>(new Set());
  const [randomQuestionsPerUnit, setRandomQuestionsPerUnit] = useState<Map<string, number>>(new Map());
  const [manuallySelectedQuestions, setManuallySelectedQuestions] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  // Sorting State
  const [sortBy, setSortBy] = useState<'default' | 'topic'>('default');

  // Topic Filter State
  const [filterTopic, setFilterTopic] = useState<string>('all');

  // Migration State
  const [migrationModal, setMigrationModal] = useState<{ isOpen: boolean; question: Question | null }>({ isOpen: false, question: null });
  const [migrationTargetUnitId, setMigrationTargetUnitId] = useState<string>('');

  // Exam Activation States
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [passingGrade, setPassingGrade] = useState<4 | 6>(6);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [isActivating, setIsActivating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null); // seconds remaining

  useEffect(() => {
    if (selectedSubjectId) {
      loadUnits(selectedSubjectId);
      loadExamConfig(selectedSubjectId);
    } else {
      setQuestions([]);
      setUnits([]);
      setExamConfig(null);
    }
  }, [selectedSubjectId]);

  const loadUnits = async (sId: string) => {
    const u = await storageService.getUnits(sId);
    setUnits(u);
  };

  const loadExamConfig = async (sId: string) => {
    const config = await storageService.getExamConfig(sId);
    setExamConfig(config);
    if (config.passingGrade === 4 || config.passingGrade === 6) {
      setPassingGrade(config.passingGrade as 4 | 6);
    }
    setDurationMinutes(config.durationMinutes ?? 0);
    // Restore countdown if exam is active and has endTimestamp
    if (config.isActive && config.endTimestamp) {
      const rem = Math.floor((config.endTimestamp - Date.now()) / 1000);
      setCountdown(rem > 0 ? rem : 0);
    } else {
      setCountdown(null);
    }
  };

  // Countdown tick + auto-deactivate
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Auto-deactivate when time is up
          if (selectedSubjectId) {
            storageService.getExamConfig(selectedSubjectId).then(cfg => {
              storageService.saveExamConfig({ ...cfg, isActive: false, endTimestamp: undefined });
              setExamConfig(c => c ? { ...c, isActive: false, endTimestamp: undefined } : c);
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown === null ? null : 'active', selectedSubjectId]);

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

  // Derive unique topics from questions
  const uniqueTopics = Array.from(new Set(questions.map(q => q.topic).filter(t => t && t.trim() !== ''))).sort();

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
      correctOptionIndex: 0,
      topic: ''
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

  // Integrative Mode Helper Functions
  const toggleUnitSelection = (unitId: string) => {
    const newSet = new Set(selectedUnitsForIntegrative);
    if (newSet.has(unitId)) {
      newSet.delete(unitId);
      // Clear random count for this unit
      const newMap = new Map(randomQuestionsPerUnit);
      newMap.delete(unitId);
      setRandomQuestionsPerUnit(newMap);
    } else {
      newSet.add(unitId);
      // Set default random count
      if (integrativeMode === 'random') {
        const newMap = new Map(randomQuestionsPerUnit);
        newMap.set(unitId, 2); // Default 2 questions
        setRandomQuestionsPerUnit(newMap);
      }
    }
    setSelectedUnitsForIntegrative(newSet);
  };

  const setRandomCountForUnit = (unitId: string, count: number) => {
    const newMap = new Map(randomQuestionsPerUnit);
    newMap.set(unitId, Math.max(1, count));
    setRandomQuestionsPerUnit(newMap);
  };

  const toggleQuestionForIntegrative = (questionId: string) => {
    const newSet = new Set(manuallySelectedQuestions);
    if (newSet.has(questionId)) {
      newSet.delete(questionId);
    } else {
      newSet.add(questionId);
    }
    setManuallySelectedQuestions(newSet);
  };

  const toggleUnitExpansion = (unitId: string) => {
    const newSet = new Set(expandedUnits);
    if (newSet.has(unitId)) {
      newSet.delete(unitId);
    } else {
      newSet.add(unitId);
    }
    setExpandedUnits(newSet);
  };

  const applyIntegrativeSelection = async (): Promise<boolean> => {
    if (!selectedSubjectId) return false;
    if (selectedUnitsForIntegrative.size === 0 && integrativeMode === 'random') return false;
    if (manuallySelectedQuestions.size === 0 && integrativeMode === 'manual') return false;

    if (integrativeMode === 'random') {
      const allQuestionsToActivate: string[] = [];

      for (const unitId of selectedUnitsForIntegrative) {
        const count = randomQuestionsPerUnit.get(unitId) || 2;
        const unitQuestions = questions.filter(q => q.unitId === unitId);

        // Shuffle and take N questions
        const shuffled = [...unitQuestions].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);
        allQuestionsToActivate.push(...selected.map(q => q.id));
      }

      const allQuestions = await storageService.getQuestions(selectedSubjectId);
      for (const q of allQuestions) {
        await storageService.updateQuestion({ ...q, isActiveIntegrative: allQuestionsToActivate.includes(q.id) });
      }
    } else {
      const allQuestions = await storageService.getQuestions(selectedSubjectId);
      for (const q of allQuestions) {
        await storageService.updateQuestion({ ...q, isActiveIntegrative: manuallySelectedQuestions.has(q.id) });
      }
    }

    loadQuestions(selectedSubjectId, selectedUnitId);
    return true;
  };

  const handleActivateExam = async () => {
    if (!selectedSubjectId) return;
    if (selectedUnitsForIntegrative.size === 0 && integrativeMode === 'random') {
      alert('Por favor, selecciona al menos una unidad antes de activar el examen.');
      return;
    }
    if (manuallySelectedQuestions.size === 0 && integrativeMode === 'manual') {
      alert('Por favor, selecciona al menos una pregunta de forma manual antes de activar el examen.');
      return;
    }
    setIsActivating(true);
    try {
      await applyIntegrativeSelection();
      const endTs = durationMinutes > 0 ? Date.now() + durationMinutes * 60000 : undefined;
      const newConfig: ExamConfig = {
        id: examConfig?.id,
        subjectId: selectedSubjectId,
        unitId: undefined,
        type: 'integrative',
        isActive: true,
        passingGrade,
        integrativeConfig: examConfig?.integrativeConfig,
        durationMinutes,
        endTimestamp: endTs,
      };
      await storageService.saveExamConfig(newConfig);
      await loadExamConfig(selectedSubjectId);
      alert('¡Examen activado correctamente!');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateExam = async () => {
    if (!selectedSubjectId || !examConfig) return;
    setIsActivating(true);
    try {
      await storageService.saveExamConfig({ ...examConfig, isActive: false, endTimestamp: undefined });
      setCountdown(null);
      await loadExamConfig(selectedSubjectId);
    } finally {
      setIsActivating(false);
    }
  };

  const handleMigrateClick = (question: Question) => {
    setMigrationModal({ isOpen: true, question });
    setMigrationTargetUnitId('');
  };

  const confirmMigration = async () => {
    if (!migrationModal.question || !migrationTargetUnitId) return;

    await storageService.updateQuestion({
      ...migrationModal.question,
      unitId: migrationTargetUnitId,
      isActive: false, // Deactivate in new unit by default to be safe
      isActiveIntegrative: false
    });

    setMigrationModal({ isOpen: false, question: null });
    if (selectedSubjectId) loadQuestions(selectedSubjectId, selectedUnitId);
    alert('Pregunta migrada correctamente.');
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

      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        {/* Manual Add - Only visible if a Unit is selected */}
        {selectedUnitId !== 'integrative' ? (
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tema (Opcional)</label>
                <input
                  type="text"
                  value={newQ.topic}
                  onChange={(e) => setNewQ({ ...newQ, topic: e.target.value })}
                  placeholder="Ej: Revolución Francesa, Independencia, etc."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  list="topics-list"
                />
                <datalist id="topics-list">
                  {uniqueTopics.map(topic => (
                    <option key={topic} value={topic} />
                  ))}
                </datalist>
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
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Configuración de Examen Integrador</h3>

            {/* Mode Toggle */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">Modo de Selección</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setIntegrativeMode('random')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${integrativeMode === 'random'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                    }`}
                >
                  🎲 Aleatorio
                </button>
                <button
                  onClick={() => setIntegrativeMode('manual')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${integrativeMode === 'manual'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                    }`}
                >
                  ✋ Manual
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {integrativeMode === 'random'
                  ? 'Selecciona N preguntas aleatorias de cada unidad'
                  : 'Selecciona manualmente preguntas específicas de cada unidad'}
              </p>
            </div>

            {/* Unit Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Unidades ({selectedUnitsForIntegrative.size} seleccionadas)
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {units.map(unit => {
                  const isSelected = selectedUnitsForIntegrative.has(unit.id);
                  const isExpanded = expandedUnits.has(unit.id);
                  const unitQuestions = questions.filter(q => q.unitId === unit.id);
                  const randomCount = randomQuestionsPerUnit.get(unit.id) || 2;
                  const manualSelectedInUnit = unitQuestions.filter(q => manuallySelectedQuestions.has(q.id)).length;

                  return (
                    <div key={unit.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 p-3 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUnitSelection(unit.id)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">{unit.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({unitQuestions.length} preguntas)</span>
                        </div>

                        {isSelected && integrativeMode === 'random' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={unitQuestions.length}
                              value={randomCount}
                              onChange={(e) => setRandomCountForUnit(unit.id, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-gray-600">preguntas</span>
                          </div>
                        )}

                        {isSelected && integrativeMode === 'manual' && (
                          <button
                            onClick={() => toggleUnitExpansion(unit.id)}
                            className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            {manualSelectedInUnit} seleccionadas
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Manual Mode: Show questions when expanded */}
                      {isSelected && integrativeMode === 'manual' && isExpanded && (
                        <div className="p-3 bg-white space-y-2 max-h-[200px] overflow-y-auto">
                          {unitQuestions.map((q, idx) => (
                            <div key={q.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded">
                              <input
                                type="checkbox"
                                checked={manuallySelectedQuestions.has(q.id)}
                                onChange={() => toggleQuestionForIntegrative(q.id)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded cursor-pointer mt-0.5"
                              />
                              <div className="flex-1">
                                <p className="text-sm text-gray-800">{q.text}</p>
                                <span className="text-xs text-gray-400">#{idx + 1}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Apply Button */}
            <Button
              onClick={() => applyIntegrativeSelection()}
              disabled={selectedUnitsForIntegrative.size === 0 && integrativeMode === 'random' || manuallySelectedQuestions.size === 0 && integrativeMode === 'manual'}
              className="w-full justify-center mt-4"
              variant="secondary"
            >
              Aplicar Selección de Preguntas
              {integrativeMode === 'random' && selectedUnitsForIntegrative.size > 0 && (
                <span className="ml-2">
                  ({Array.from(selectedUnitsForIntegrative).reduce((sum, unitId) =>
                    sum + (randomQuestionsPerUnit.get(unitId) || 2), 0)} preguntas)
                </span>
              )}
              {integrativeMode === 'manual' && manuallySelectedQuestions.size > 0 && (
                <span className="ml-2">({manuallySelectedQuestions.size} preguntas)</span>
              )}
            </Button>

            {/* Exam Status Banner */}
            {examConfig !== null && (
              <div className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold ${examConfig.isActive
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}>
                <span className={`w-2 h-2 rounded-full ${examConfig.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                EXAMEN {examConfig.isActive ? 'ACTIVO' : 'INACTIVO'}
              </div>
            )}

            {/* Passing Grade Selector */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-semibold text-amber-800 mb-2">📋 Nota de Aprobación</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setPassingGrade(4)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${passingGrade === 4
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-amber-700 border-amber-300 hover:border-amber-500'
                    }`}
                >
                  4 — Cuatro
                </button>
                <button
                  onClick={() => setPassingGrade(6)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${passingGrade === 6
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-amber-700 border-amber-300 hover:border-amber-500'
                    }`}
                >
                  6 — Seis
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                El alumno necesita el <strong>60%</strong> de respuestas correctas para obtener la nota de aprobación ({passingGrade}).
              </p>
            </div>

            {/* Duration Selector */}
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-semibold text-blue-800 mb-2">⏱ Tiempo de Examen</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Math.max(0, Number(e.target.value)))}
                  disabled={examConfig?.isActive}
                  className="w-24 px-3 py-1.5 border border-blue-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-400 outline-none disabled:opacity-50"
                />
                <span className="text-sm text-blue-700 font-medium">minutos</span>
                {durationMinutes > 0 && (
                  <span className="text-xs text-blue-500">
                    ({Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)}h ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60}min` : ''})
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {durationMinutes === 0
                  ? 'Sin límite de tiempo. El examen se desactiva manualmente.'
                  : `Al activar, el examen se cerrará automáticamente en ${durationMinutes} minutos.`}
              </p>
              {/* Countdown display */}
              {countdown !== null && examConfig?.isActive && (
                <div className={`mt-3 px-4 py-3 rounded-lg text-center font-mono font-bold text-2xl tracking-widest border ${countdown <= 60
                  ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                  : countdown <= 300
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-blue-100 text-blue-800 border-blue-200'}`}
                >
                  {countdown <= 0 ? '⏰ Tiempo agotado' : `${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`}
                  <p className="text-xs font-sans font-normal mt-0.5 opacity-75">tiempo restante</p>
                </div>
              )}
            </div>

            {/* Activate / Deactivate Exam Button */}
            <div className="mt-3">
              {examConfig?.isActive ? (
                <Button
                  onClick={handleDeactivateExam}
                  disabled={isActivating}
                  className="w-full justify-center bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  {isActivating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                      Desactivando...
                    </span>
                  ) : '🔴 Desactivar Examen'}
                </Button>
              ) : (
                <Button
                  onClick={handleActivateExam}
                  disabled={isActivating}
                  className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                >
                  {isActivating ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                      Activando...
                    </span>
                  ) : '🟢 Activar Examen'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Question List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[600px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">Banco de Preguntas ({questions.length})</h3>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                {activeCount} Activas {selectedUnitId === 'integrative' ? '(Integrador)' : '(Parcial)'}
              </span>

              {/* Topic Filter Dropdown */}
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-emerald-500"
              >
                <option value="all">Todos los temas</option>
                {uniqueTopics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {selectedUnitId !== 'integrative' && (
                <div className="flex gap-1">
                  <button onClick={() => handleBulkAction('enable')} className="text-xs text-emerald-600 hover:underline">Activar Todas</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => handleBulkAction('disable')} className="text-xs text-gray-500 hover:underline">Desactivar Todas</button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setSortBy(sortBy === 'default' ? 'topic' : 'default')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {sortBy === 'default' ? 'Ordenar por Tema' : 'Orden Original'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {questions
              .filter(q => filterTopic === 'all' || q.topic === filterTopic)
              .sort((a, b) => {
                if (sortBy === 'topic') {
                  const topicA = a.topic || 'Sin tema';
                  const topicB = b.topic || 'Sin tema';
                  return topicA.localeCompare(topicB);
                }
                return 0; // default order
              })
              .map((q, i) => {
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
                          {q.topic && (
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {q.topic}
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
                        {selectedUnitId !== 'integrative' && (
                          <button
                            onClick={() => handleMigrateClick(q)}
                            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-300 hover:text-blue-500 hover:border-blue-200 transition-colors"
                            title="Migrar a otra unidad"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {questions.length === 0 && <p className="text-center text-gray-400 py-10">No hay preguntas en esta materia.</p>}
          </div>
        </div>
      </div>

      {/* Migration Modal */}
      {migrationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Migrar Pregunta</h3>
              <button onClick={() => setMigrationModal({ isOpen: false, question: null })} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4 text-sm">
                Selecciona la unidad de destino para la pregunta:<br />
                <span className="font-medium text-gray-800 italic">"{migrationModal.question?.text.substring(0, 50)}..."</span>
              </p>

              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-500 mb-1">Unidad de Destino</label>
                <select
                  value={migrationTargetUnitId}
                  onChange={(e) => setMigrationTargetUnitId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Seleccionar Unidad...</option>
                  {units.filter(u => u.id !== selectedUnitId).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setMigrationModal({ isOpen: false, question: null })}>Cancelar</Button>
                <Button onClick={confirmMigration} disabled={!migrationTargetUnitId}>Confirmar Migración</Button>
              </div>
            </div>
          </div>
        </div>
      )}
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

const ResultsView: React.FC<{ subjects: Subject[], initialFilterSubjectId: string, teacherId: string, isSuperAdmin: boolean, isActive: boolean }> = ({ subjects, initialFilterSubjectId, teacherId, isSuperAdmin, isActive }) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    setFilterSubjectId(initialFilterSubjectId);
  }, [initialFilterSubjectId]);

  useEffect(() => {
    if (isActive) {
      refreshResults();
    }
  }, [isActive]);

  const refreshResults = async () => {
    try {
      setIsLoading(true);
      setError(null);
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

  // ── Session grouping ──────────────────────────────────────────────────────
  const makeSessionKey = (r: ExamResult) => {
    const dateKey = new Date(r.timestamp).toLocaleDateString('sv-SE'); // YYYY-MM-DD
    return `${r.subjectId}-${r.type || 'integrative'}-${r.unitId || 'integrative'}-${dateKey}`;
  };

  const makeDefaultName = (r: ExamResult) => {
    const dateStr = new Date(r.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const tipo = r.type === 'integrative' ? 'Integrador' : (r.unitName || 'Unidad');
    return `${r.subjectName} — ${tipo} — ${dateStr}`;
  };

  const filteredResults = filterSubjectId === 'all'
    ? results
    : results.filter(r => r.subjectId === filterSubjectId);

  const sessionsMap = new Map<string, { key: string; results: ExamResult[] }>();
  for (const r of filteredResults) {
    const key = makeSessionKey(r);
    if (!sessionsMap.has(key)) sessionsMap.set(key, { key, results: [] });
    sessionsMap.get(key)!.results.push(r);
  }
  const sessions = Array.from(sessionsMap.values()).sort(
    (a, b) => Math.max(...b.results.map(r => r.timestamp)) - Math.max(...a.results.map(r => r.timestamp))
  );

  // ── Session names ─────────────────────────────────────────────────────────
  const [sessionNames, setSessionNamesState] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (results.length > 0) {
      storageService.getAllSessionNames().then(names => setSessionNamesState(names));
    }
  }, [results]);

  const getSessionLabel = (session: { key: string; results: ExamResult[] }) =>
    sessionNames[session.key] || makeDefaultName(session.results[0]);

  const startEditing = (key: string, currentLabel: string) => {
    setEditingKey(key);
    setEditingValue(currentLabel);
  };

  const saveEditing = async () => {
    if (!editingKey || !editingValue.trim()) return;
    await storageService.setSessionName(editingKey, editingValue.trim());
    setSessionNamesState(prev => ({ ...prev, [editingKey]: editingValue.trim() }));
    setEditingKey(null);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Print PDF ─────────────────────────────────────────────────────────────
  const handlePrintPDF = (sessionResults: ExamResult[], sessionLabel: string) => {
    const printWindow = window.open('', '', 'height=800,width=900');
    if (!printWindow) return;
    printWindow.document.write('<html><head><title>Resultados de Exámenes</title>');
    printWindow.document.write(`
        <style>
            body { font-family: sans-serif; padding: 20px; color: #111; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 14px; font-weight: normal; color: #555; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f3f3f3; font-weight: bold; }
            .failed { color: #d32f2f; font-weight: bold; }
            .passed { color: #388e3c; font-weight: bold; }
            @media print { @page { size: A4; margin: 2cm; } }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>DeBoeck Exams</h1><h2>${sessionLabel}</h2>`);
    let html = `<table><thead><tr><th>Alumno</th><th>Aciertos</th><th>Nota</th><th>Estado</th><th>Hora</th></tr></thead><tbody>`;
    sessionResults.forEach(r => {
      html += `<tr><td>${r.studentName}</td><td>${r.score}/${r.totalQuestions} (${r.percentage.toFixed(0)}%)</td><td>${r.grade.toFixed(1)}</td><td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? 'APROBADO' : 'REPROBADO'}</td><td>${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td></tr>`;
    });
    html += `</tbody></table>`;
    printWindow.document.write(html);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  // ── Global stats ──────────────────────────────────────────────────────────
  const total = filteredResults.length;
  const passedTotal = filteredResults.filter(r => r.passed).length;
  const avgGrade = total > 0 ? (filteredResults.reduce((acc, r) => acc + r.grade, 0) / total).toFixed(1) : '-';
  const passRate = total > 0 ? ((passedTotal / total) * 100).toFixed(0) : '-';

  if (!subjects) return <div className="p-4 text-red-500">Error interno: Faltan datos de materias.</div>;

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error al cargar resultados</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={refreshResults} variant="primary">Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & filters */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Historial de Exámenes</h2>
          <p className="text-sm text-gray-500 mt-1">Organizado por sesión de examen. Haz clic para ver los alumnos.</p>
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
          <Button
            variant="danger"
            onClick={() => setDeleteModalOpen(true)}
            disabled={filteredResults.length === 0}
            className="text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
          >
            Borrar Historial
          </Button>
        </div>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Evaluados</span>
          <span className="text-3xl font-bold text-gray-800 mt-1">{total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Promedio Nota</span>
          <span className="text-3xl font-bold text-emerald-600 mt-1">{avgGrade}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aprobados</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-800">{passRate}%</span>
            <span className="text-sm text-gray-400">({passedTotal}/{total})</span>
          </div>
        </div>
      </div>

      {/* Session cards */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400">No hay resultados que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const label = getSessionLabel(session);
            const isExpanded = expandedKeys.has(session.key);
            const sResults = session.results.sort((a, b) => b.timestamp - a.timestamp);
            const sTotal = sResults.length;
            const sPassed = sResults.filter(r => r.passed).length;
            const sAvg = (sResults.reduce((acc, r) => acc + r.grade, 0) / sTotal).toFixed(1);
            const sDate = new Date(Math.max(...sResults.map(r => r.timestamp)));
            const isEditing = editingKey === session.key;

            return (
              <div key={session.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Session header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => !isEditing && toggleExpand(session.key)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') setEditingKey(null); }}
                          className="flex-1 border border-emerald-400 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-gray-800"
                        />
                        <button onClick={saveEditing} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 font-medium">Guardar</button>
                        <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 truncate">{label}</span>
                          <button
                            onClick={e => { e.stopPropagation(); startEditing(session.key, label); }}
                            className="text-gray-300 hover:text-emerald-500 transition-colors flex-shrink-0"
                            title="Renombrar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-xs text-gray-400">
                          {sDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <span className="text-xs font-medium text-gray-500">{sTotal} alumnos</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Prom: {sAvg}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${sPassed === sTotal ? 'bg-green-100 text-green-700' : sPassed === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {sPassed}/{sTotal} aprobados
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handlePrintPDF(sResults, label); }}
                        className="text-gray-300 hover:text-blue-500 transition-colors"
                        title="Imprimir/PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded student table */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100" ref={tableRef}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Alumno</th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Hora</th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Aciertos</th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">% Correctas</th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nota Final</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {sResults.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-gray-800">{r.studentName}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">
                              {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-700">
                              <span className="font-semibold">{r.score}</span>
                              <span className="text-gray-400"> / {r.totalQuestions}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-700">{r.percentage.toFixed(0)}%</td>
                            <td className="px-5 py-3">
                              <span className={`px-3 py-1 text-xs font-bold rounded-full border ${r.passed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {r.grade.toFixed(1)} — {r.passed ? 'APROBADO' : 'REPROBADO'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
