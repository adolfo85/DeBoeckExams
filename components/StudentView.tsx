import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Subject, Question, ExamConfig, ExamResult, Teacher } from '../types';
import { Button } from './Button';
import { ExamView } from './ExamView';

export const StudentView: React.FC<{ onAdminLoginClick: () => void }> = ({ onAdminLoginClick }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeExams, setActiveExams] = useState<{
    subjectId: string;
    subjectName: string;
    unitId?: string;
    unitName?: string;
    type: 'unit' | 'integrative';
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Teacher selection
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string } | null>(null);
  const activeTeacherIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTeacherIdRef.current = selectedTeacher?.id || null;
  }, [selectedTeacher]);

  const [selectTeacherStep, setSelectTeacherStep] = useState<'selecting' | 'selected'>('selecting');

  const [currentExam, setCurrentExam] = useState<{
    subject: Subject;
    questions: Question[];
    config: ExamConfig;
  } | null>(null);

  const [studentLastName, setStudentLastName] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentDni, setStudentDni] = useState('');
  const [examStep, setExamStep] = useState<'select' | 'name_input' | 'taking' | 'finished'>('select');
  const examStepRef = useRef(examStep);
  useEffect(() => {
    examStepRef.current = examStep;
  }, [examStep]);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [finalResult, setFinalResult] = useState<ExamResult | null>(null);
  const [studentCountdown, setStudentCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const examEndTimestampRef = useRef<number | null>(null); // stores endTimestamp when exam loads

  // Data for the review screen (Incorrect answers)
  const [reviewData, setReviewData] = useState<{
    questions: Question[];
    userAnswers: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const teacherId = urlParams.get('t');

      if (teacherId) {
        const teacher = await storageService.getTeacher(teacherId);
        if (teacher) {
          setSelectedTeacher({ id: teacher.id, name: teacher.name });
          setSelectTeacherStep('selected');
          await loadTeacherExams(teacherId);
        } else {
          await loadTeachersList();
        }
      } else {
        await loadTeachersList();
      }
    };

    const loadTeachersList = async () => {
      const teachers = await storageService.getAllTeachers();
      setAvailableTeachers(teachers);
      setIsLoading(false);
    };

    const loadTeacherExams = async (teacherId: string) => {
      // We still need subjects if the UI references them outside of the exam list, 
      // but activeExams can be loaded in 1 query now.
      try {
        const allSubjects = await storageService.getSubjects(teacherId);
        if (allSubjects && allSubjects.length > 0) {
          setSubjects(allSubjects);
        }

        const active = await storageService.getActiveExams(teacherId);
        setActiveExams(active);
      } catch (err) {
        console.error('Error fetching teacher exams:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Poll every 5 seconds to reflect exam activation/deactivation in real time (only on exam selection screen)
    const interval = setInterval(async () => {
      if (examStepRef.current !== 'select') return;
      const urlParams = new URLSearchParams(window.location.search);
      const teacherId = urlParams.get('t') || activeTeacherIdRef.current;
      if (teacherId) {
        await loadTeacherExams(teacherId);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleStartExam = async (exam: typeof activeExams[0]) => {
    const subject = subjects.find(s => s.id === exam.subjectId);
    if (!subject) return;

    let activeQuestions: Question[] = [];

    if (exam.type === 'integrative') {
      const allSubjectQuestions = await storageService.getQuestions(exam.subjectId);
      activeQuestions = allSubjectQuestions.filter(q => q.isActiveIntegrative);
    } else {
      const unitQuestions = await storageService.getQuestions(exam.subjectId, exam.unitId);
      activeQuestions = unitQuestions.filter(q => q.isActive);
    }

    if (activeQuestions.length === 0) {
      alert("Este examen no tiene preguntas activas disponibles.");
      return;
    }

    const shuffledQuestions = [...activeQuestions].sort(() => Math.random() - 0.5);
    const config = await storageService.getExamConfig(exam.subjectId, exam.unitId);

    // Store endTimestamp in ref immediately — no closure issues
    examEndTimestampRef.current = config.endTimestamp ? Number(config.endTimestamp) : null;
    console.log('[Timer] config.endTimestamp:', config.endTimestamp, '→ ref:', examEndTimestampRef.current);

    setCurrentExam({ subject, questions: shuffledQuestions, config });
    setExamStep('name_input');
  };

  const confirmNameAndStart = () => {
    if (!studentLastName.trim() || !studentFirstName.trim() || !studentDni.trim()) return;
    const formatted = `${studentLastName.trim().toUpperCase()}, ${studentFirstName.trim()}`;
    setStudentName(formatted);
    setExamStep('taking');
  };

  // Start countdown when exam begins (reads from ref, not stale closure)
  useEffect(() => {
    if (examStep !== 'taking') return;
    // The countdown + auto-submit now live inside ExamView (it owns the answers).
    // Keeping a second timer here would submit an empty answer set.
    if (true) return;

    const endTs = examEndTimestampRef.current;
    console.log('[Timer] examStep→taking, endTs from ref:', endTs);

    if (!endTs) {
      console.log('[Timer] No time limit configured, skipping countdown');
      return;
    }

    const rem = Math.floor((endTs - Date.now()) / 1000);
    console.log('[Timer] seconds remaining:', rem);

    if (rem <= 0) {
      submitExamWithAnswers();
      return;
    }

    setStudentCountdown(rem);
    timerRef.current = setInterval(() => {
      setStudentCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          submitExamWithAnswers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [examStep]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Updated handleAnswer to support multiple select (checkbox) and single choice (radio)
  const handleAnswer = (questionId: string, optionIndex: number, isMultipleSelect = false) => {
    setAnswers(prev => {
      if (isMultipleSelect) {
        const current = Array.isArray(prev[questionId]) ? (prev[questionId] as number[]) : [];
        const newVals = current.includes(optionIndex)
          ? current.filter(i => i !== optionIndex)
          : [...current, optionIndex];
        return { ...prev, [questionId]: newVals };
      } else {
        return { ...prev, [questionId]: optionIndex };
      }
    });
  };

  const submitExam = async (overrideAnswers?: Record<string, number | number[]>) => {
    if (!currentExam) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const usedAnswers = overrideAnswers ?? answers;

    let correctCount = 0;
    currentExam.questions.forEach(q => {
      const userAns = usedAnswers[q.id];
      if (Array.isArray(q.correctOptionIndex)) {
        if (Array.isArray(userAns) && userAns.length === q.correctOptionIndex.length && q.correctOptionIndex.every(idx => userAns.includes(idx))) {
          correctCount++;
        }
      } else if (q.questionType === 'fill_blank') {
        if (userAns === q.correctOptionIndex) correctCount++;
      } else {
        if (userAns === q.correctOptionIndex) correctCount++;
      }
    });

    const total = currentExam.questions.length;
    const percentage = total === 0 ? 0 : (correctCount / total) * 100;
    const passingGrade = currentExam.config.passingGrade;

    // Grade on a 0–10 scale: linear from 0→passingGrade over [0%,60%],
    // then linear from passingGrade→10 over [60%,100%].
    let grade = 0;
    if (percentage < 60) {
      grade = (passingGrade * percentage) / 60;
    } else {
      grade = passingGrade + ((10 - passingGrade) * (percentage - 60)) / 40;
    }
    grade = Math.round(grade * 10) / 10;
    if (grade > 10) grade = 10;

    const passed = percentage >= 60;

    const result: ExamResult = {
      id: crypto.randomUUID(),
      studentName,
      subjectId: currentExam.subject.id,
      subjectName: currentExam.subject.name,
      score: correctCount,
      totalQuestions: total,
      percentage,
      grade,
      passed,
      timestamp: Date.now()
    };

    await storageService.saveResult(result);
    setFinalResult(result);

    setReviewData({
      questions: currentExam.questions,
      userAnswers: usedAnswers as Record<string, number>
    });

    setCurrentExam(null);
    setAnswers({});
    setStudentCountdown(null);
    setExamStep('finished');
  };

  // Ref trick: capture latest answers so auto-submit can access them from interval closure
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const submitExamWithAnswers = () => {
    submitExam(answersRef.current);
  };

  const exitCampus = () => {
    // Force redirect to external blog
    window.location.href = "https://db-ismuntblog.netlify.app/";
  };

  // --- Renders ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <div className="bg-slate-100 border border-slate-400 p-6 rounded-sm shadow-md text-center max-w-xs w-full">
          <p className="text-sm font-semibold text-slate-800">Cargando sistema...</p>
          <p className="text-xs text-slate-500 font-mono mt-1">Espere un momento por favor</p>
        </div>
      </div>
    );
  }

  // Teacher selection screen
  if (selectTeacherStep === 'selecting') {
    return (
      <div className="min-h-screen bg-slate-200 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden">
          {/* Title Bar */}
          <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
            <span className="truncate">DeBoeckExams — Selección de Docente</span>
            <span className="text-[10px] text-slate-300 font-mono">[Sistema de Exámenes]</span>
          </div>

          {/* Subheader Banner */}
          <div className="bg-slate-50 border-b border-slate-300 px-6 py-4">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">DeBoeckExams</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              Seleccione el docente a cargo de la cátedra
            </p>
          </div>

          <div className="p-6 bg-white space-y-2">
            {availableTeachers.length > 0 ? (
              availableTeachers.map(teacher => (
                <button
                  key={teacher.id}
                  onClick={async () => {
                    setSelectedTeacher({ id: teacher.id, name: teacher.name });
                    setSelectTeacherStep('selected');
                    setIsLoading(true);

                    // Load teacher's exams with single optimized query
                    const allSubjects = await storageService.getSubjects(teacher.id);
                    setSubjects(allSubjects);

                    const active = await storageService.getActiveExams(teacher.id);
                    setActiveExams(active);
                    setIsLoading(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-sm border border-slate-300 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-600 transition-colors font-medium text-slate-800 text-sm flex justify-between items-center group cursor-pointer"
                >
                  <span className="font-semibold text-slate-800 group-hover:text-emerald-800">
                    {teacher.name}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500 group-hover:text-emerald-700">
                    [ SELECCIONAR ]
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center p-6 bg-slate-50 rounded-sm border border-slate-300">
                <p className="text-xs text-slate-500 font-mono">No hay profesores registrados disponibles.</p>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 text-xs text-slate-600 flex justify-between items-center">
            <span className="font-mono text-[11px] text-slate-500">Módulo Estudiante</span>
            <button
              onClick={onAdminLoginClick}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
            >
              Acceso Profesores
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'select') {
    return (
      <div className="min-h-screen bg-slate-200 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden">
          {/* Title Bar */}
          <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
            <span className="truncate">DeBoeckExams — Exámenes Habilitados</span>
            <span className="text-[10px] text-slate-300 font-mono">[Portal de Evaluación]</span>
          </div>

          {/* Subheader Banner */}
          <div className="bg-slate-50 border-b border-slate-300 px-6 py-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">DeBoeckExams</h1>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                  Evaluaciones Disponibles en Línea
                </p>
              </div>
              {selectedTeacher && (
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Profesor</span>
                  <span className="text-xs font-semibold text-slate-800 font-mono">{selectedTeacher.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-white space-y-3">
            {activeExams.length > 0 ? (
              activeExams.map((exam, idx) => (
                <button
                  key={`${exam.subjectId}-${exam.unitId || 'int'}-${idx}`}
                  onClick={() => handleStartExam(exam)}
                  className="w-full text-left p-4 rounded-sm border border-slate-300 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-600 transition-colors group cursor-pointer block"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-base block text-slate-900 group-hover:text-emerald-900">
                        {exam.subjectName}
                      </span>
                      <span className="text-xs font-medium text-slate-600 mt-0.5 block">
                        {exam.type === 'integrative' ? 'Examen Integrador' : exam.unitName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-bold uppercase rounded-xs">
                      [ Habilitado ]
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center p-8 bg-slate-50 rounded-sm border border-slate-300">
                <p className="text-xs text-slate-600 font-mono">No hay exámenes habilitados en este momento.</p>
                <p className="text-[11px] text-slate-400 mt-1">El docente debe activar el examen desde su panel de control.</p>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 text-xs text-slate-600 flex justify-between items-center">
            <span className="font-mono text-[11px] text-slate-500">Actualización en tiempo real activa</span>
            <button
              onClick={onAdminLoginClick}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
            >
              Acceso Profesores
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'name_input') {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden">
          {/* Title Bar */}
          <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
            <span className="truncate">DeBoeckExams — Registro de Estudiante</span>
            <span className="text-[10px] text-slate-300 font-mono">[Paso 1 de 2]</span>
          </div>

          {/* Subheader Banner */}
          <div className="bg-slate-50 border-b border-slate-300 px-6 py-4">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Evaluación Seleccionada
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">{currentExam?.subject.name}</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentExam?.config.type === 'integrative' ? 'Examen Integrador' :
                activeExams.find(e => e.unitId === currentExam?.config.unitId)?.unitName || 'Examen de Unidad'}
            </p>
          </div>

          <div className="p-6 bg-white space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Apellido(s) del Alumno *
                </label>
                <input
                  id="student-lastname-input"
                  type="text"
                  className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 uppercase"
                  placeholder="Ej: GÓMEZ"
                  value={studentLastName}
                  onChange={(e) => setStudentLastName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Nombre(s) del Alumno *
                </label>
                <input
                  id="student-firstname-input"
                  type="text"
                  className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  placeholder="Ej: Juan Carlos"
                  value={studentFirstName}
                  onChange={(e) => setStudentFirstName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Número de DNI (sin puntos) *
              </label>
              <input
                id="student-dni-input"
                type="text"
                inputMode="numeric"
                className="w-full bg-white border border-slate-400 rounded-sm px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                placeholder="Ej: 35123456"
                value={studentDni}
                onChange={(e) => setStudentDni(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
              />
            </div>
            <p className="text-[11px] text-slate-500 font-mono leading-tight bg-slate-50 p-2.5 rounded-sm border border-slate-200">
              Aviso: El dispositivo y los datos ingresados quedarán vinculados a la sesión de evaluación para control de integridad académica.
            </p>
          </div>

          {/* Button Bar */}
          <div className="bg-slate-100 border-t border-slate-300 px-6 py-3 flex justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setExamStep('select')}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmNameAndStart}
              disabled={!studentLastName.trim() || !studentFirstName.trim() || !studentDni.trim()}
            >
              Comenzar Examen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'taking' && currentExam) {
    // ── Delegated to ExamView (one-question-at-a-time + watermark) ──
    return (
      <ExamView
        questions={currentExam.questions}
        studentData={{
          name: studentName || `${studentLastName.trim().toUpperCase()}, ${studentFirstName.trim()}`,
          dni: studentDni,
          lastName: studentLastName.trim(),
          firstName: studentFirstName.trim()
        }}
        subjectId={currentExam.subject.id}
        subjectName={currentExam.subject.name}
        passingGrade={currentExam.config.passingGrade}
        endTimestamp={examEndTimestampRef.current}
        onFinish={(result) => {
          setFinalResult(result);
          // Rebuild reviewData from current questions + answers (ExamView saves to DB internally)
          setReviewData({
            questions: currentExam.questions,
            userAnswers: {} as Record<string, number>, // answers are internal to ExamView
          });
          setCurrentExam(null);
          setAnswers({});
          setStudentCountdown(null);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setExamStep('finished');
        }}
      />
    );
  }

  // ── Legacy taking block (kept for reference, unreachable) ──
  if (false && examStep === 'taking' && currentExam) {
    const isAllAnswered = currentExam.questions.length > 0 && currentExam.questions.every(q => {
      const ans = answers[q.id];
      if (q.questionType === 'multiple_select') {
        return Array.isArray(ans) && ans.length > 0;
      }
      return ans !== undefined;
    });

    const answeredCount = currentExam.questions.filter(q => {
      const ans = answers[q.id];
      if (q.questionType === 'multiple_select') return Array.isArray(ans) && ans.length > 0;
      return ans !== undefined;
    }).length;

    return (
      <div className="min-h-screen bg-gray-50 pb-28">
        {/* Compact sticky HUD — mobile-first, two columns */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm safe-top">
          <div className="flex items-center justify-between px-4 py-2 max-w-2xl mx-auto">
            {/* Left: subject + student */}
            <div className="min-w-0 mr-3">
              <p className="text-xs font-bold text-gray-800 truncate leading-tight">{currentExam.subject.name}</p>
              <p className="text-[11px] text-gray-400 truncate leading-tight">{studentName}</p>
            </div>
            {/* Right: timer + counter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Answer counter */}
              <div className="flex flex-col items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1">
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide leading-none">Respondidas</span>
                <span className="text-base font-bold text-emerald-700 leading-tight">{answeredCount}<span className="text-xs font-normal text-emerald-500">/{currentExam.questions.length}</span></span>
              </div>
              {/* Countdown */}
              {studentCountdown !== null && (
                <div className={`flex flex-col items-center rounded-lg px-3 py-1 border ${studentCountdown <= 300
                  ? 'bg-red-50 border-red-300 animate-pulse'
                  : 'bg-green-50 border-green-300'}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide leading-none ${studentCountdown <= 300 ? 'text-red-600' : 'text-green-700'}`}>Tiempo</span>
                  <span className={`text-base font-mono font-bold leading-tight ${studentCountdown <= 300 ? 'text-red-700' : 'text-green-700'}`}>
                    {studentCountdown <= 0 ? '00:00' : `${String(Math.floor(studentCountdown / 60)).padStart(2, '0')}:${String(studentCountdown % 60).padStart(2, '0')}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
          {currentExam.questions.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
              <p>Este examen está activo, pero el profesor no ha seleccionado ninguna pregunta para esta sesión.</p>
            </div>
          ) : (
            currentExam.questions.map((q, index) => (
              <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                <div className="flex gap-4 mb-6">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg font-bold text-gray-500 text-sm border border-gray-200">{index + 1}</span>
                  <p className="text-lg text-gray-800 font-medium leading-relaxed">{q.text}</p>
                </div>

                {/* Render options based on question type */}
                {q.questionType === 'true_false' ? (
                  <div className="flex gap-4">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = answers[q.id] === optIdx;
                      return (
                        <label key={optIdx} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="hidden"
                            checked={isSelected}
                            onChange={() => handleAnswer(q.id, optIdx)}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                ) : q.questionType === 'fill_blank' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded">
                      Tip: Usa <strong>{'{blank}'}</strong> en el enunciado donde va la palabra faltante.
                    </p>
                    <select
                      value={answers[q.id] ?? ''}
                      onChange={e => handleAnswer(q.id, Number(e.target.value))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="" disabled>Selecciona</option>
                      {q.options.map((opt, optIdx) => (
                        <option key={optIdx} value={optIdx}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ) : q.questionType === 'multiple_select' ? (
                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(optIdx);
                      return (
                        <label key={optIdx} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200 ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 ${isSelected ? 'border-emerald-500' : 'border-gray-300'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSelected}
                            onChange={() => handleAnswer(q.id, optIdx, true)}
                          />
                          <span className={`text-base ${isSelected ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  // Default: multiple_choice (radio)
                  <div className="space-y-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = answers[q.id] === optIdx;
                      return (
                        <label key={optIdx} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200 ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 ${isSelected ? 'border-emerald-500' : 'border-gray-300'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="hidden"
                            checked={isSelected}
                            onChange={() => handleAnswer(q.id, optIdx)}
                          />
                          <span className={`text-base ${isSelected ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )))}
        </div>

        {currentExam.questions.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-center shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
            <Button
              onClick={() => submitExam()}
              disabled={!isAllAnswered}
              className="w-full max-w-md py-3 text-lg shadow-xl shadow-emerald-100"
            >
              {isAllAnswered ? 'Finalizar Examen y Ver Nota' : 'Responde todas las preguntas para finalizar'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (examStep === 'finished' && finalResult) {
    const incorrectQuestions = reviewData?.questions.filter(q => {
      const userAns = reviewData.userAnswers[q.id];
      return userAns !== undefined && userAns !== q.correctOptionIndex;
    }) || [];

    return (
      <div className="min-h-screen bg-slate-200 flex flex-col items-center py-8 px-4 font-sans">
        <div className="max-w-xl w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden mb-6">
          {/* Title Bar */}
          <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
            <span className="truncate">DeBoeckExams — Acta Oficial de Evaluación</span>
            <span className="text-[10px] text-slate-300 font-mono">[Resultado Final]</span>
          </div>

          {/* Subheader / Status Banner */}
          <div className="bg-white border-b border-slate-300 p-6 text-center">
            <div className="mb-3">
              <span className={`inline-block px-3 py-1 text-xs font-mono font-bold tracking-wider uppercase border rounded-xs ${
                finalResult.passed
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                  : 'bg-red-50 text-red-800 border-red-400'
              }`}>
                {finalResult.passed ? '[ ESTADO: APROBADO ]' : '[ ESTADO: NO APROBADO ]'}
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {finalResult.subjectName}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {finalResult.unitName || (finalResult.type === 'integrative' ? 'Examen Integrador' : 'Evaluación Regular')}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Alumno: {finalResult.studentName} {finalResult.studentDni ? `(DNI: ${finalResult.studentDni})` : ''}
            </p>
          </div>

          {/* Metrics Panel */}
          <div className="p-6 bg-slate-50 space-y-3">
            <div className="bg-white border border-slate-300 rounded-sm p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Calificación Obtenida:
                </span>
                <span className={`text-2xl font-mono font-bold ${
                  finalResult.passed ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {finalResult.grade.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 10.0</span>
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5 text-xs">
                <span className="text-slate-600 uppercase tracking-wide font-medium">
                  Respuestas Correctas:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {finalResult.score} de {finalResult.totalQuestions} preguntas
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 uppercase tracking-wide font-medium">
                  Porcentaje de Efectividad:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {finalResult.percentage.toFixed(0)}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-mono text-center">
              Los resultados han sido transmitidos y guardados en la base de datos de la cátedra.
            </p>
          </div>

          {/* Action Footer */}
          <div className="bg-slate-100 border-t border-slate-300 p-4 flex flex-col items-center gap-2">
            <Button
              onClick={exitCampus}
              variant="primary"
              className="w-full justify-center"
            >
              Salir del Campus
            </Button>
            <span className="text-[11px] text-slate-500 font-mono">
              Finalizará la sesión y retornará al portal institucional.
            </span>
          </div>
        </div>

        {/* Detailed Error Review Section */}
        {incorrectQuestions.length > 0 && (
          <div className="max-w-xl w-full bg-slate-100 rounded-sm border border-slate-400 shadow-xl overflow-hidden mb-8">
            <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-semibold select-none">
              <span>Informe de Errores ({incorrectQuestions.length})</span>
              <span className="text-[10px] text-slate-300 font-mono">[Revisión Pedagógica]</span>
            </div>

            <div className="p-4 bg-white space-y-4">
              {incorrectQuestions.map((q, idx) => {
                const userOptIdx = reviewData?.userAnswers[q.id];
                return (
                  <div key={q.id} className="border border-slate-300 bg-slate-50 p-4 rounded-sm space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 text-slate-700 text-xs font-mono font-bold rounded-xs flex-shrink-0">
                        #{idx + 1}
                      </span>
                      <p className="font-semibold text-slate-900 text-sm leading-snug">
                        {q.text}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded-sm bg-red-50 border border-red-200 text-red-900">
                        <span className="font-bold text-[10px] uppercase block tracking-wider text-red-700 mb-1">
                          [ Respuesta Registrada ]:
                        </span>
                        <span>{userOptIdx !== undefined ? q.options[userOptIdx] : 'Sin responder'}</span>
                      </div>
                      <div className="p-2.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <span className="font-bold text-[10px] uppercase block tracking-wider text-emerald-700 mb-1">
                          [ Respuesta Correcta ]:
                        </span>
                        <span>{q.options[q.correctOptionIndex]}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};