import React, { useState, useEffect, useRef } from 'react';
import { storageService } from '../services/storageService';
import { Subject, Question, ExamConfig, ExamResult, Teacher } from '../types';
import { Button } from './Button';

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
  const [selectTeacherStep, setSelectTeacherStep] = useState<'selecting' | 'selected'>('selecting');

  const [currentExam, setCurrentExam] = useState<{
    subject: Subject;
    questions: Question[];
    config: ExamConfig;
  } | null>(null);

  const [studentName, setStudentName] = useState('');
  const [examStep, setExamStep] = useState<'select' | 'name_input' | 'taking' | 'finished'>('select');
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
      const allSubjects = await storageService.getSubjects(teacherId);
      setSubjects(allSubjects);

      const active: typeof activeExams = [];
      for (const s of allSubjects) {
        const intConfig = await storageService.getExamConfig(s.id);
        if (intConfig.isActive) {
          active.push({ subjectId: s.id, subjectName: s.name, type: 'integrative' });
        }
        const units = await storageService.getUnits(s.id);
        for (const u of units) {
          const uConfig = await storageService.getExamConfig(s.id, u.id);
          if (uConfig.isActive) {
            active.push({ subjectId: s.id, subjectName: s.name, unitId: u.id, unitName: u.name, type: 'unit' });
          }
        }
      }
      setActiveExams(active);
      setIsLoading(false);
    };

    loadData();

    // Poll every 30 seconds to reflect exam activation/deactivation in real time
    const interval = setInterval(async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const teacherId = urlParams.get('t');
      if (teacherId) {
        await loadTeacherExams(teacherId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleStartExam = async (exam: typeof activeExams[0]) => {
    const subject = subjects.find(s => s.id === exam.subjectId);
    if (!subject) return;

    const allQuestions = await storageService.getQuestions(exam.subjectId, exam.unitId);
    let activeQuestions: Question[] = [];

    if (exam.type === 'integrative') {
      const allSubjectQuestions = await storageService.getQuestions(exam.subjectId);
      activeQuestions = allSubjectQuestions.filter(q => q.isActiveIntegrative);
    } else {
      activeQuestions = allQuestions.filter(q => q.isActive);
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
    if (!studentName.trim()) return;
    setExamStep('taking');
  };

  // Start countdown when exam begins (reads from ref, not stale closure)
  useEffect(() => {
    if (examStep !== 'taking') return;

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

    let grade = 0;
    if (percentage < 60) {
      grade = 1 + ((passingGrade - 1) * percentage) / 60;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Teacher selection screen
  if (selectTeacherStep === 'selecting') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-emerald-500">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-emerald-900 mb-2">DeBoeckExams</h1>
            <p className="text-gray-500">Selecciona a tu Profesor</p>
          </div>

          <div className="space-y-3 mb-6">
            {availableTeachers.length > 0 ? (
              availableTeachers.map(teacher => (
                <button
                  key={teacher.id}
                  onClick={async () => {
                    setSelectedTeacher({ id: teacher.id, name: teacher.name });
                    setSelectTeacherStep('selected');
                    setIsLoading(true);

                    // Load teacher's exams
                    const allSubjects = await storageService.getSubjects(teacher.id);
                    setSubjects(allSubjects);

                    const active: typeof activeExams = [];
                    for (const s of allSubjects) {
                      // Integrative
                      const intConfig = await storageService.getExamConfig(s.id);
                      if (intConfig.isActive) {
                        active.push({ subjectId: s.id, subjectName: s.name, type: 'integrative' });
                      }
                      // Units
                      const units = await storageService.getUnits(s.id);
                      for (const u of units) {
                        const uConfig = await storageService.getExamConfig(s.id, u.id);
                        if (uConfig.isActive) {
                          active.push({ subjectId: s.id, subjectName: s.name, unitId: u.id, unitName: u.name, type: 'unit' });
                        }
                      }
                    }
                    setActiveExams(active);
                    setIsLoading(false);
                  }}
                  className="w-full text-left p-5 rounded-xl border border-gray-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all group"
                >
                  <span className="font-bold text-lg text-gray-800 group-hover:text-emerald-700">
                    {teacher.name}
                  </span>
                </button>
              ))
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400">No hay profesores disponibles.</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <button onClick={onAdminLoginClick} className="text-xs text-gray-400 hover:text-emerald-600 transition-colors">
              Acceso Profesores
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border-t-4 border-emerald-500">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-emerald-900 mb-2">DeBoeckExams</h1>
            <p className="text-gray-500">Sistema de Evaluación Online</p>
          </div>

          <div className="space-y-4 mb-10">
            {activeExams.length > 0 ? (
              activeExams.map((exam, idx) => (
                <button
                  key={`${exam.subjectId}-${exam.unitId || 'int'}-${idx}`}
                  onClick={() => handleStartExam(exam)}
                  className="w-full text-left p-5 rounded-xl border transition-all group relative overflow-hidden bg-white border-gray-200 hover:border-emerald-500 hover:shadow-md"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-lg block mb-1 text-gray-800 group-hover:text-emerald-700">
                        {exam.subjectName}
                      </span>
                      <span className="text-sm font-medium text-emerald-600">
                        {exam.type === 'integrative' ? 'Examen Integrador' : exam.unitName}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs flex items-center gap-1.5 mt-3">
                    <span className="text-gray-400 group-hover:text-emerald-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Habilitado
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400">No hay exámenes habilitados en este momento.</p>
              </div>
            )}
          </div>

          <div className="text-center">
            <button onClick={onAdminLoginClick} className="text-xs text-gray-400 hover:text-emerald-600 transition-colors">Acceso Profesores</button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'name_input') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="mb-6">
            <span className="text-emerald-600 font-bold tracking-wide text-xs uppercase">Comenzar Examen</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">{currentExam?.subject.name}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {currentExam?.config.type === 'integrative' ? 'Examen Integrador' :
                activeExams.find(e => e.unitId === currentExam?.config.unitId)?.unitName || 'Examen de Unidad'}
            </p>
          </div>

          <label className="block text-sm font-semibold text-gray-700 mb-2">Ingresa tu Nombre Completo</label>
          <input
            type="text"
            className="w-full bg-white border border-gray-300 rounded-lg p-4 text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none mb-8 placeholder-gray-400 shadow-sm"
            placeholder="Ej: Juan Pérez"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            autoFocus
          />

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setExamStep('select')} className="flex-1">Cancelar</Button>
            <Button onClick={confirmNameAndStart} disabled={!studentName.trim()} className="flex-1 shadow-lg shadow-emerald-200">Comenzar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (examStep === 'taking' && currentExam) {
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-8 text-center animate-fade-in-up border border-white ring-1 ring-black/5 mb-8">
          <div className="mb-8">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-sm ${finalResult.passed ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
              {finalResult.passed ? (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              )}
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">{finalResult.passed ? '¡Aprobado!' : 'No Aprobado'}</h2>
            <p className="text-gray-500">Examen completado: <span className="font-semibold text-gray-700">{finalResult.subjectName}</span></p>
            {finalResult.unitName && <p className="text-sm text-emerald-600 font-medium mt-1">{finalResult.unitName}</p>}
            {finalResult.type === 'integrative' && <p className="text-sm text-emerald-600 font-medium mt-1">Examen Integrador</p>}
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4">
              <span className="text-sm font-medium text-gray-500 uppercase">Nota Final</span>
              <span className={`text-3xl font-bold ${finalResult.passed ? 'text-green-600' : 'text-red-600'}`}>{finalResult.grade.toFixed(1)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500 uppercase">Aciertos</span>
              <div className="text-right">
                <span className="text-xl font-bold text-gray-800">{finalResult.score}</span>
                <span className="text-gray-400 text-sm"> / {finalResult.totalQuestions}</span>
              </div>
            </div>
            <div className="text-right mt-1">
              <span className="text-xs text-gray-400">({finalResult.percentage.toFixed(0)}% efectividad)</span>
            </div>
          </div>

          <Button onClick={exitCampus} variant="primary" className="w-full py-3 text-lg bg-emerald-700 hover:bg-emerald-800 shadow-lg">Salir del Campus</Button>
          <p className="text-xs text-gray-400 mt-4">Serás redirigido fuera de la plataforma.</p>
        </div>

        {/* Detailed Error Review Section */}
        {incorrectQuestions.length > 0 && (
          <div className="max-w-2xl w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-bold text-gray-700 mb-4 pl-2 border-l-4 border-red-400">Revisión de Errores ({incorrectQuestions.length})</h3>
            <div className="space-y-4">
              {incorrectQuestions.map((q, idx) => {
                const userOptIdx = reviewData?.userAnswers[q.id];
                return (
                  <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <p className="font-medium text-gray-800 mb-3">{q.text}</p>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-800">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        <div>
                          <span className="font-bold block text-xs uppercase opacity-75">Tu Respuesta:</span>
                          {userOptIdx !== undefined ? q.options[userOptIdx] : 'Sin responder'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-start gap-2 text-emerald-800">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        <div>
                          <span className="font-bold block text-xs uppercase opacity-75">Respuesta Correcta:</span>
                          {q.options[q.correctOptionIndex]}
                        </div>
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