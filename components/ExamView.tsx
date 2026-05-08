import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Question, ExamResult } from '../types';
import { storageService } from '../services/storageService';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StudentData {
  name: string;
  /** DNI / national ID – shown on the watermark */
  dni: string;
}

export interface ExamViewProps {
  questions: Question[];
  studentData: StudentData;
  subjectId: string;
  subjectName: string;
  /** Called with the final ExamResult once the exam is submitted */
  onFinish: (result: ExamResult) => void;
  /** Passing grade threshold (e.g. 6) */
  passingGrade?: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Build an array of watermark stamp positions spread across the whole page */
function buildWatermarkStamps(name: string, dni: string, count = 18) {
  const stamps = [];
  const cols = 3;
  const rows = Math.ceil(count / cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = (r / rows) * 100 + (Math.random() * 4 - 2);
      const left = (c / cols) * 100 + (Math.random() * 6 - 3);
      stamps.push({ top, left, key: `${r}-${c}` });
    }
  }
  return stamps.map(s => ({
    ...s,
    line1: name.toUpperCase(),
    line2: `DNI: ${dni}`,
  }));
}

// ─────────────────────────────────────────────
// Watermark overlay — rendered ONCE, outside question card
// pointer-events: none  →  clicks pass through to interactive elements
// ─────────────────────────────────────────────

const WatermarkOverlay: React.FC<{ studentData: StudentData }> = ({ studentData }) => {
  const stamps = buildWatermarkStamps(studentData.name, studentData.dni);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',       // ← VITAL: clicks go through
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {stamps.map(stamp => (
        <div
          key={stamp.key}
          style={{
            position: 'absolute',
            top: `${stamp.top}%`,
            left: `${stamp.left}%`,
            transform: 'rotate(-35deg)',
            textAlign: 'center',
            opacity: 0.10,            // subtle but visible in screenshots
            color: '#1e3a5f',
            fontFamily: 'monospace',
            fontWeight: 700,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: '0.9rem' }}>{stamp.line1}</div>
          <div style={{ fontSize: '0.75rem' }}>{stamp.line2}</div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// Option renderer (supports all question types)
// ─────────────────────────────────────────────

interface OptionRendererProps {
  question: Question;
  answers: Record<string, number | number[]>;
  onAnswer: (questionId: string, optionIndex: number, isMultipleSelect?: boolean) => void;
}

const OptionRenderer: React.FC<OptionRendererProps> = ({ question: q, answers, onAnswer }) => {
  const commonLabelClass = (isSelected: boolean) =>
    `flex items-center p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
      isSelected
        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
        : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
    }`;

  if (q.questionType === 'true_false') {
    return (
      <div className="flex gap-4">
        {q.options.map((opt, optIdx) => {
          const isSelected = answers[q.id] === optIdx;
          return (
            <label
              key={optIdx}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                className="hidden"
                checked={isSelected}
                onChange={() => onAnswer(q.id, optIdx)}
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }

  if (q.questionType === 'fill_blank') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded">
          Selecciona la opción correcta para el espacio en blanco.
        </p>
        <select
          value={answers[q.id] ?? ''}
          onChange={e => onAnswer(q.id, Number(e.target.value))}
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          <option value="" disabled>Selecciona una opción…</option>
          {q.options.map((opt, optIdx) => (
            <option key={optIdx} value={optIdx}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (q.questionType === 'multiple_select') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-purple-600 mb-2 bg-purple-50 p-2 rounded font-medium">
          Puedes seleccionar más de una opción correcta.
        </p>
        {q.options.map((opt, optIdx) => {
          const isSelected =
            Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(optIdx);
          return (
            <label key={optIdx} className={commonLabelClass(isSelected)}>
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-4 flex-shrink-0 ${
                  isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={isSelected}
                onChange={() => onAnswer(q.id, optIdx, true)}
              />
              <span className={`text-base ${isSelected ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>
                {opt}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // Default: multiple_choice (radio)
  return (
    <div className="space-y-3">
      {q.options.map((opt, optIdx) => {
        const isSelected = answers[q.id] === optIdx;
        return (
          <label key={optIdx} className={commonLabelClass(isSelected)}>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 ${
                isSelected ? 'border-emerald-500' : 'border-gray-300'
              }`}
            >
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
            </div>
            <input
              type="radio"
              name={`q-${q.id}`}
              className="hidden"
              checked={isSelected}
              onChange={() => onAnswer(q.id, optIdx)}
            />
            <span className={`text-base ${isSelected ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>
              {opt}
            </span>
          </label>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────

const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const pct = total === 0 ? 0 : Math.round(((current + 1) / total) * 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// Main ExamView component
// ─────────────────────────────────────────────

export const ExamView: React.FC<ExamViewProps> = ({
  questions,
  studentData,
  subjectId,
  subjectName,
  onFinish,
  passingGrade = 6,
}) => {
  // ── State ──────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false); // triggers blank-screen

  // ── Rate-limited audit refs ─────────────────────────────────────────────
  // Hard limits so audit logging never saturates the DB:
  //   • Max 8 events logged per exam session (per student)
  //   • Min 20 seconds between any two logged events
  // The blank-screen overlay still activates on EVERY blur (no limit there).
  const AUDIT_COOLDOWN_MS = 20_000; // 20 s between DB writes
  const AUDIT_MAX_PER_SESSION = 8;  // absolute cap per student per exam
  const auditCountRef  = useRef(0);       // events logged this session
  const auditLastRef   = useRef(0);       // timestamp of last logged event

  // ── Anti-leak: detect focus loss & log it ──
  useEffect(() => {
    /**
     * tryLog — writes to Neon only if:
     *   1. The session cap hasn't been reached (max 8)
     *   2. At least 20 s have passed since the last write
     * The setIsBlurred call is always synchronous and unrestricted.
     */
    const tryLog = (type: 'focus_loss' | 'visibility_hidden') => {
      if (auditCountRef.current >= AUDIT_MAX_PER_SESSION) return;
      const now = Date.now();
      if (now - auditLastRef.current < AUDIT_COOLDOWN_MS) return;

      auditLastRef.current = now;
      auditCountRef.current++;

      // Fire-and-forget — silent fail inside logAuditEvent
      storageService.logAuditEvent({
        studentName: studentData.name,
        studentDni:  studentData.dni,
        subjectName,
        eventType:   type,
        timestamp:   now,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsBlurred(true);
        tryLog('visibility_hidden');
      } else {
        setIsBlurred(false);
      }
    };

    const handleBlur  = () => { setIsBlurred(true);  tryLog('focus_loss'); };
    const handleFocus = () => { setIsBlurred(false); };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur',  handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur',  handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentData.name, studentData.dni, subjectName]);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // ── Answer handler ─────────────────────────
  const handleAnswer = useCallback(
    (questionId: string, optionIndex: number, isMultipleSelect = false) => {
      setAnswers(prev => {
        if (isMultipleSelect) {
          const current = Array.isArray(prev[questionId]) ? (prev[questionId] as number[]) : [];
          const newVals = current.includes(optionIndex)
            ? current.filter(i => i !== optionIndex)
            : [...current, optionIndex];
          return { ...prev, [questionId]: newVals };
        }
        return { ...prev, [questionId]: optionIndex };
      });
    },
    []
  );

  // ── Navigation ─────────────────────────────
  const goNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(i => i + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  // ── Check if current question is answered ──
  const isCurrentAnswered = (() => {
    if (!currentQuestion) return false;
    const ans = answers[currentQuestion.id];
    if (currentQuestion.questionType === 'multiple_select') {
      return Array.isArray(ans) && ans.length > 0;
    }
    return ans !== undefined;
  })();

  // ── Answered counter ───────────────────────
  const answeredCount = questions.filter(q => {
    const ans = answers[q.id];
    if (q.questionType === 'multiple_select') return Array.isArray(ans) && ans.length > 0;
    return ans !== undefined;
  }).length;

  // ── Submit ─────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // ── Calculate score ─────────────────────
      let correctCount = 0;
      questions.forEach(q => {
        const userAns = answers[q.id];
        if (Array.isArray(q.correctOptionIndex)) {
          if (
            Array.isArray(userAns) &&
            userAns.length === q.correctOptionIndex.length &&
            q.correctOptionIndex.every(idx => userAns.includes(idx))
          ) {
            correctCount++;
          }
        } else {
          if (userAns === q.correctOptionIndex) correctCount++;
        }
      });

      const total = questions.length;
      const percentage = total === 0 ? 0 : (correctCount / total) * 100;

      // Grade on a 1–10 scale using 60% as the passing threshold
      let grade = 0;
      if (percentage < 60) {
        grade = 1 + ((passingGrade - 1) * percentage) / 60;
      } else {
        grade = passingGrade + ((10 - passingGrade) * (percentage - 60)) / 40;
      }
      grade = Math.min(10, Math.round(grade * 10) / 10);

      const result: ExamResult = {
        id: crypto.randomUUID(),
        studentName: studentData.name,
        subjectId,
        subjectName,
        score: correctCount,
        totalQuestions: total,
        percentage,
        grade,
        passed: percentage >= 60,
        timestamp: Date.now(),
      };

      // ── Persist to Neon DB via storageService ──
      await storageService.saveResult(result);

      onFinish(result);
    } catch (err) {
      console.error('[ExamView] Error saving result:', err);
      alert('Hubo un error al enviar el examen. Por favor intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Empty guard ────────────────────────────
  if (totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-400">Este examen no tiene preguntas disponibles.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Blank-screen overlay: shows instantly on focus loss ── */}
      {isBlurred && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
          }}
        >
          <svg style={{ width: 56, height: 56, color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', textAlign: 'center', maxWidth: 320 }}>
            Examen en pausa
          </p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', maxWidth: 280 }}>
            Volvé a esta pantalla para continuar. Cada salida queda registrada.
          </p>
        </div>
      )}

      {/* Anti-leak watermark — always on top, never blocks clicks */}
      <WatermarkOverlay studentData={studentData} />

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Subject + student row */}
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate leading-tight">{subjectName}</p>
              <p className="text-[11px] text-gray-400 truncate leading-tight">{studentData.name}</p>
            </div>
            {/* Answered pill */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1 flex-shrink-0">
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
                Respondidas
              </span>
              <span className="text-sm font-bold text-emerald-700">
                {answeredCount}
                <span className="text-xs font-normal text-emerald-500">/{totalQuestions}</span>
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <ProgressBar current={currentIndex} total={totalQuestions} />
        </div>
      </header>

      {/* ── Question card ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-6 pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          {/* Question number badge */}
          <div className="flex items-center gap-3 mb-6">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg font-bold text-emerald-700 text-sm border border-emerald-200">
              {currentIndex + 1}
            </span>
            <span className="text-xs text-gray-400 font-medium">
              de {totalQuestions}
            </span>
          </div>

          {/* Question text */}
          <p className="text-lg text-gray-800 font-medium leading-relaxed mb-6">
            {currentQuestion.text}
          </p>

          {/* Options */}
          <OptionRenderer
            question={currentQuestion}
            answers={answers}
            onAnswer={handleAnswer}
          />

          {/* "No respondida" hint */}
          {!isCurrentAnswered && (
            <p className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠ Esta pregunta aún no tiene respuesta.
            </p>
          )}
        </div>
      </main>

      {/* ── Fixed bottom nav bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.08)] p-4 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {/* Prev */}
          <button
            id="exam-prev-btn"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          {/* Next / Submit */}
          {isLastQuestion ? (
            <button
              id="exam-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Enviando…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Finalizar Examen
                </>
              )}
            </button>
          ) : (
            <button
              id="exam-next-btn"
              onClick={goNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200 transition-all"
            >
              Siguiente
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Dot-map navigator */}
        <div className="max-w-2xl mx-auto flex flex-wrap gap-1.5 mt-3 justify-center">
          {questions.map((q, idx) => {
            const ans = answers[q.id];
            const isAnswered =
              q.questionType === 'multiple_select'
                ? Array.isArray(ans) && ans.length > 0
                : ans !== undefined;
            return (
              <button
                key={q.id}
                id={`exam-dot-${idx}`}
                onClick={() => setCurrentIndex(idx)}
                title={`Pregunta ${idx + 1}${isAnswered ? ' ✓' : ''}`}
                className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all border ${
                  idx === currentIndex
                    ? 'bg-emerald-600 text-white border-emerald-600 scale-110'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
