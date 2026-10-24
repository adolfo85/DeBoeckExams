import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Question, ExamResult } from '../types';
import { storageService } from '../services/storageService';
import { getDeviceProfile, getDeviceProfileSync, DeviceProfile } from '../services/deviceService';

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
  /** Unix ms when the exam ends (shared with the teacher's countdown). Undefined = no limit */
  endTimestamp?: number | null;
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
    `flex items-center p-3 rounded-sm border cursor-pointer transition-colors select-none ${
      isSelected
        ? 'border-emerald-800 bg-emerald-50 text-slate-900 font-semibold ring-1 ring-emerald-800'
        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
    }`;

  if (q.questionType === 'true_false') {
    return (
      <div className="flex gap-3">
        {q.options.map((opt, optIdx) => {
          const isSelected = answers[q.id] === optIdx;
          return (
            <label
              key={optIdx}
              className={`flex-1 flex items-center justify-center p-3 rounded-sm border cursor-pointer font-sans font-medium text-sm transition-colors select-none ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-800 text-emerald-950 font-bold ring-1 ring-emerald-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
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
        <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
          Seleccione la opción para el espacio en blanco:
        </label>
        <select
          value={answers[q.id] ?? ''}
          onChange={e => onAnswer(q.id, Number(e.target.value))}
          className="w-full p-2.5 border border-slate-400 rounded-sm bg-white text-slate-900 text-sm focus:border-emerald-700 outline-none shadow-xs"
        >
          <option value="" disabled>Seleccione una opción...</option>
          {q.options.map((opt, optIdx) => (
            <option key={optIdx} value={optIdx}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (q.questionType === 'multiple_select') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-600 font-semibold mb-2 uppercase tracking-wide">
          Selección múltiple (puede seleccionar más de una opción):
        </p>
        {q.options.map((opt, optIdx) => {
          const isSelected =
            Array.isArray(answers[q.id]) && (answers[q.id] as number[]).includes(optIdx);
          return (
            <label key={optIdx} className={commonLabelClass(isSelected)}>
              <div
                className={`w-4 h-4 rounded-xs border flex items-center justify-center mr-3 flex-shrink-0 text-xs font-black ${
                  isSelected ? 'border-emerald-800 bg-emerald-700 text-white' : 'border-slate-400 bg-white'
                }`}
              >
                {isSelected && 'X'}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={isSelected}
                onChange={() => onAnswer(q.id, optIdx, true)}
              />
              <span className="text-sm">
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
    <div className="space-y-2">
      {q.options.map((opt, optIdx) => {
        const isSelected = answers[q.id] === optIdx;
        return (
          <label key={optIdx} className={commonLabelClass(isSelected)}>
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 flex-shrink-0 ${
                isSelected ? 'border-emerald-800 bg-white' : 'border-slate-400 bg-white'
              }`}
            >
              {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-800" />}
            </div>
            <input
              type="radio"
              name={`q-${q.id}`}
              className="hidden"
              checked={isSelected}
              onChange={() => onAnswer(q.id, optIdx)}
            />
            <span className="text-sm">
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
    <div className="w-full bg-slate-200 border border-slate-300 rounded-xs h-2 overflow-hidden">
      <div
        className="h-full bg-emerald-700 transition-all duration-300"
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
  endTimestamp = null,
}) => {
  // ── State ──────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false); // triggers blank-screen

  // ── Rate-limited audit refs ─────────────────────────────────────────────
  const AUDIT_COOLDOWN_MS = 20_000;
  const AUDIT_MAX_PER_SESSION = 8;
  const auditCountRef       = useRef(0);
  const auditLastRef        = useRef(0);

  // ── Escalation refs ─────────────────────────────────────────────────────
  // exitCountRef: every real exit (no rate limit) — drives the 3-strike rule
  // isCurrentlyExitedRef: prevents blur+visibilitychange from counting twice
  const exitCountRef         = useRef(0);
  const isCurrentlyExitedRef = useRef(false);
  const [showWarning, setShowWarning]             = useState(false);
  const [shouldAutoSubmit, setShouldAutoSubmit]   = useState(false);

  // ── Device profile tracking ─────────────────────────────────────────────
  const deviceProfileRef = useRef<DeviceProfile>(getDeviceProfileSync());

  // Log exam session start with device fingerprint immediately on mount
  useEffect(() => {
    let isMounted = true;
    const initialProfile = getDeviceProfileSync();
    deviceProfileRef.current = initialProfile;

    // Log immediately so even a 1-second entrance is logged
    storageService.logAuditEvent({
      studentName: studentData.name,
      studentDni:  studentData.dni,
      subjectName,
      eventType:   'exam_start',
      timestamp:   Date.now(),
      deviceId:    initialProfile.deviceId,
      deviceFingerprint: initialProfile.fingerprint,
      deviceInfo:  initialProfile.deviceInfo,
      ipAddress:   initialProfile.ip,
    });

    // In parallel, resolve full IP and update profile ref
    getDeviceProfile().then(profile => {
      if (!isMounted) return;
      deviceProfileRef.current = profile;
    });

    return () => {
      isMounted = false;
    };
  }, [studentData.name, studentData.dni, subjectName]);

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
        deviceId:    deviceProfileRef.current?.deviceId,
        deviceFingerprint: deviceProfileRef.current?.fingerprint,
        deviceInfo:  deviceProfileRef.current?.deviceInfo,
        ipAddress:   deviceProfileRef.current?.ip,
      });
    };

    // ── Escalation handlers ───────────────────────────────────────────────
    const handleExit = (type: 'focus_loss' | 'visibility_hidden') => {
      // Guard: only count once per continuous exit (blur+visibilitychange may both fire)
      if (!isCurrentlyExitedRef.current) {
        isCurrentlyExitedRef.current = true;
        exitCountRef.current++;
        if (exitCountRef.current >= 3) {
          setShouldAutoSubmit(true); // triggers auto-submit via useEffect below
        }
      }
      setIsBlurred(true);
      tryLog(type);
    };

    const handleReturn = () => {
      if (isCurrentlyExitedRef.current) {
        isCurrentlyExitedRef.current = false;
        if (exitCountRef.current === 2) {
          setShowWarning(true); // show warning after 2nd exit
        }
      }
      setIsBlurred(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleExit('visibility_hidden');
      } else {
        handleReturn();
      }
    };

    const handleBlur  = () => handleExit('focus_loss');
    const handleFocus = () => handleReturn();

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

  // ── Auto-submit on 3rd exit ──────────────────────────────────────────────
  // Runs after render triggered by setShouldAutoSubmit(true).
  // handleSubmit reads the latest `answers` from that render → correct.
  useEffect(() => {
    if (shouldAutoSubmit && !isSubmitting) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSubmit]);

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

      // Grade on a 0–10 scale: linear from 0→passingGrade over [0%,60%],
      // then linear from passingGrade→10 over [60%,100%].
      let grade = 0;
      if (percentage < 60) {
        grade = (passingGrade * percentage) / 60;
      } else {
        grade = passingGrade + ((10 - passingGrade) * (percentage - 60)) / 40;
      }
      grade = Math.min(10, Math.round(grade * 10) / 10);

      const result: ExamResult = {
        id: crypto.randomUUID(),
        studentName: studentData.name,
        studentDni: studentData.dni,
        subjectId,
        subjectName,
        score: correctCount,
        totalQuestions: total,
        percentage,
        grade,
        passed: percentage >= 60,
        timestamp: Date.now(),
        answersJson: JSON.stringify(answers), // persists per-question answers for admin review
        deviceId: deviceProfileRef.current?.deviceId,
        deviceFingerprint: deviceProfileRef.current?.fingerprint,
        deviceInfo: deviceProfileRef.current?.deviceInfo,
        ipAddress: deviceProfileRef.current?.ip,
      };

      // ── Persist to Neon DB via storageService ──
      await storageService.saveResult(result);

      // Log exam finish event in audit log
      storageService.logAuditEvent({
        studentName: studentData.name,
        studentDni: studentData.dni,
        subjectName,
        eventType: 'exam_finish',
        timestamp: Date.now(),
        deviceId: deviceProfileRef.current?.deviceId,
        deviceFingerprint: deviceProfileRef.current?.fingerprint,
        deviceInfo: deviceProfileRef.current?.deviceInfo,
        ipAddress: deviceProfileRef.current?.ip,
      });

      onFinish(result);
    } catch (err) {
      console.error('[ExamView] Error saving result:', err);
      alert('Hubo un error al enviar el examen. Por favor intentá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Exam countdown (synced with teacher via absolute endTimestamp) ──
  const [remainingSec, setRemainingSec] = useState<number | null>(
    endTimestamp ? Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000)) : null
  );
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const timeUpFiredRef = useRef(false);

  useEffect(() => {
    if (!endTimestamp) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
      setRemainingSec(rem);
      if (rem <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        handleSubmitRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTimestamp]);

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
    <div className="min-h-screen bg-slate-200 flex flex-col font-sans">
      {/* ── Blank-screen overlay: shows instantly on every focus loss ── */}
      {isBlurred && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.85)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div style={{
            background: '#ffffff', border: '1px solid #64748b',
            maxWidth: 380, width: '100%', borderRadius: '2px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <div style={{
              background: '#334155', color: '#ffffff', padding: '0.5rem 0.85rem',
              fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              Control de Integridad — Examen en Pausa
            </div>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Ventana fuera de foco
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                Regrese a esta ventana para continuar con la evaluación.<br />
                Cada salida queda asentada en el registro de auditoría.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 2nd-exit warning modal ── */}
      {showWarning && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div style={{
            background: '#ffffff', borderRadius: '2px',
            maxWidth: 400, width: '100%',
            border: '1px solid #94a3b8',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: '#b91c1c', color: '#ffffff', padding: '0.5rem 1rem',
              fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              Advertencia del Sistema
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Actividad fuera del examen detectada
              </h3>
              <p style={{
                fontSize: '0.85rem', color: '#334155',
                lineHeight: 1.5, marginBottom: '1.25rem',
              }}>
                Se detectaron salidas de la pantalla del examen.<br />
                <strong>Al siguiente intento, el examen se bloqueará y se enviará automáticamente con las respuestas guardadas hasta este momento.</strong>
              </p>
              <button
                onClick={() => setShowWarning(false)}
                style={{
                  background: '#b91c1c', color: '#ffffff', border: '1px solid #7f1d1d',
                  borderRadius: '2px', padding: '0.55rem 1rem',
                  fontWeight: 600, fontSize: '0.8rem',
                  cursor: 'pointer', width: '100%', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-leak watermark — always on top, never blocks clicks */}
      <WatermarkOverlay studentData={studentData} />

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          {/* Subject + student row */}
          <div className="flex items-center justify-between mb-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wide truncate">{subjectName}</p>
              <p className="text-[11px] text-slate-600 font-mono truncate">ALUMNO: {studentData.name} (DNI: {studentData.dni})</p>
            </div>
            {/* Time remaining clock */}
            {remainingSec !== null && (
              <div
                id="exam-timer"
                className={`flex items-center gap-1.5 mr-2 px-3 py-1 flex-shrink-0 border font-mono font-bold text-xs uppercase tracking-wider rounded-sm ${
                  remainingSec <= 60
                    ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                    : remainingSec <= 300
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-800 border-slate-400'
                }`}
                title="Tiempo restante"
              >
                <span className="font-sans text-[10px] font-bold text-slate-500">TIEMPO:</span>
                <span>
                  {Math.floor(remainingSec / 3600) > 0 ? `${String(Math.floor(remainingSec / 3600)).padStart(2, '0')}:` : ''}
                  {String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0')}:{String(remainingSec % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {/* Answered counter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1 flex-shrink-0 rounded-sm">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                Respondidas:
              </span>
              <span className="text-xs font-bold text-slate-900 font-mono">
                {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <ProgressBar current={currentIndex} total={totalQuestions} />
        </div>
      </header>

      {/* ── Question card ── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-32">
        <div className="bg-white rounded-sm shadow-xs border border-slate-300 p-6">
          {/* Question number bar */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-sm">
              Pregunta {currentIndex + 1} de {totalQuestions}
            </span>
            {!isCurrentAnswered && (
              <span className="text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
                Aviso: Pregunta sin responder
              </span>
            )}
          </div>

          {/* Question text */}
          <p className="text-base text-slate-900 font-medium leading-relaxed mb-6 select-none">
            {currentQuestion.text}
          </p>

          {/* Options */}
          <OptionRenderer
            question={currentQuestion}
            answers={answers}
            onAnswer={handleAnswer}
          />
        </div>
      </main>

      {/* ── Fixed bottom nav bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-100 border-t border-slate-300 p-3 z-20 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Prev */}
          <button
            id="exam-prev-btn"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="px-5 py-2 rounded-sm border border-slate-400 bg-white text-slate-800 font-semibold text-xs uppercase tracking-wider hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs active:translate-y-px"
          >
            Anterior
          </button>

          {/* Next / Submit */}
          {isLastQuestion ? (
            <button
              id="exam-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider border border-emerald-900 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer active:translate-y-px"
            >
              {isSubmitting ? 'Enviando examen...' : 'Finalizar Examen'}
            </button>
          ) : (
            <button
              id="exam-next-btn"
              onClick={goNext}
              className="flex-1 py-2 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider border border-emerald-900 shadow-xs transition-colors cursor-pointer active:translate-y-px"
            >
              Siguiente
            </button>
          )}
        </div>

        {/* Numbered grid navigator */}
        <div className="max-w-3xl mx-auto flex flex-wrap gap-1 mt-2.5 justify-center">
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
                title={`Pregunta ${idx + 1}${isAnswered ? ' (Respondida)' : ''}`}
                className={`w-7 h-6 rounded-xs text-[11px] font-mono font-bold transition-colors border cursor-pointer ${
                  idx === currentIndex
                    ? 'bg-emerald-800 text-white border-emerald-950 font-bold'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
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
