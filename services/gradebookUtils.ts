import { StudentAcademicStatus } from '../types';

/**
 * Parses a combined student name string into last name and first name.
 * Handles formats: "PÉREZ, Juan Carlos", "GOMEZ JUAN", "Juan Pérez".
 */
export function parseStudentName(fullName: string): { lastName: string; firstName: string } {
  if (!fullName || !fullName.trim()) {
    return { lastName: 'SIN APELLIDO', firstName: 'Sin Nombre' };
  }

  const trimmed = fullName.trim();

  // If separated by comma: "PÉREZ, Juan" -> lastName: PÉREZ, firstName: Juan
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    return {
      lastName: parts[0].trim().toUpperCase(),
      firstName: parts.slice(1).join(',').trim() || '-'
    };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0].toUpperCase(), firstName: '-' };
  }

  // If words are in "Nombre Apellido", last word is typically lastName:
  // e.g. "Juan Carlos Gómez" -> lastName: "GÓMEZ", firstName: "Juan Carlos"
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  return { lastName, firstName };
}

/** Formats last name and first name as standard academic roster: "APELLIDO, Nombre" */
export function formatStudentName(lastName: string, firstName: string): string {
  const ln = (lastName || '').trim().toUpperCase();
  const fn = (firstName || '').trim();
  if (!ln && !fn) return 'Sin Identificar';
  if (!ln) return fn;
  if (!fn || fn === '-') return ln;
  return `${ln}, ${fn}`;
}

export interface AcademicCalculationResult {
  c1Final: number | null;
  c2Final: number | null;
  finalGrade: number | null;
  status: StudentAcademicStatus;
}

/**
 * Calculates Cuatrimestre final grades, overall grade, and academic status
 * based on DeBoeckExams institutional rules:
 * - Minimum approval grade: 4.0
 * - Promotion grade: 6.0 or higher in both 1C and 2C exams (without recuperatorio)
 * - If student takes a recuperatorio, final grade of that cuatrimestre = recuperatorio grade,
 *   and maximum condition is 'regular' (cannot promote).
 * - If student fails an exam (< 4) and doesn't take/pass recuperatorio -> 'libre'.
 * - 1C alone with grade >= 6 yields 'promocionado' until 2C is taken.
 */
export function calculateAcademicStatus(params: {
  c1Exam?: number | null;
  c1Recup?: number | null;
  c2Exam?: number | null;
  c2Recup?: number | null;
  statusOverride?: StudentAcademicStatus | null;
  isOverride?: boolean;
}): AcademicCalculationResult {
  const { c1Exam, c1Recup, c2Exam, c2Recup, statusOverride, isOverride } = params;

  // 1. Calculate 1C Final:
  // If recuperatorio was taken, it replaces the partial exam grade as the cuatrimestre final
  let c1Final: number | null = null;
  const hasC1Recup = c1Recup !== undefined && c1Recup !== null && !isNaN(c1Recup);
  const hasC1Exam = c1Exam !== undefined && c1Exam !== null && !isNaN(c1Exam);

  if (hasC1Recup) {
    c1Final = Number(c1Recup);
  } else if (hasC1Exam) {
    c1Final = Number(c1Exam);
  }

  // 2. Calculate 2C Final:
  let c2Final: number | null = null;
  const hasC2Recup = c2Recup !== undefined && c2Recup !== null && !isNaN(c2Recup);
  const hasC2Exam = c2Exam !== undefined && c2Exam !== null && !isNaN(c2Exam);

  if (hasC2Recup) {
    c2Final = Number(c2Recup);
  } else if (hasC2Exam) {
    c2Final = Number(c2Exam);
  }

  // 3. Calculate Final Grade (Promedio):
  let finalGrade: number | null = null;
  if (c1Final !== null && c2Final !== null) {
    finalGrade = Math.round(((c1Final + c2Final) / 2) * 10) / 10;
  } else if (c1Final !== null) {
    finalGrade = Math.round(c1Final * 10) / 10;
  } else if (c2Final !== null) {
    finalGrade = Math.round(c2Final * 10) / 10;
  }

  // If manually overridden by teacher, respect teacher's condition
  if (isOverride && statusOverride) {
    return { c1Final, c2Final, finalGrade, status: statusOverride };
  }

  // 4. Automatic status determination:
  const wentToRecup = hasC1Recup || hasC2Recup;

  // Failing conditions (< 4):
  if (hasC1Exam && c1Exam! < 4 && !hasC1Recup) {
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }
  if (hasC1Recup && c1Recup! < 4) {
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }
  if (hasC2Exam && c2Exam! < 4 && !hasC2Recup) {
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }
  if (hasC2Recup && c2Recup! < 4) {
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }

  // Only 1C loaded:
  if (c1Final !== null && c2Final === null) {
    if (wentToRecup) {
      return { c1Final, c2Final, finalGrade, status: 'regular' };
    }
    if (c1Exam! >= 6) {
      return { c1Final, c2Final, finalGrade, status: 'promocionado' };
    }
    if (c1Exam! >= 4) {
      return { c1Final, c2Final, finalGrade, status: 'regular' };
    }
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }

  // Both 1C and 2C loaded:
  if (c1Final !== null && c2Final !== null) {
    if (wentToRecup) {
      if (c1Final >= 4 && c2Final >= 4) {
        return { c1Final, c2Final, finalGrade, status: 'regular' };
      }
      return { c1Final, c2Final, finalGrade, status: 'libre' };
    }

    // No recup taken:
    if (c1Exam! >= 6 && c2Exam! >= 6) {
      return { c1Final, c2Final, finalGrade, status: 'promocionado' };
    }
    if (c1Exam! >= 4 && c2Exam! >= 4) {
      return { c1Final, c2Final, finalGrade, status: 'regular' };
    }
    return { c1Final, c2Final, finalGrade, status: 'libre' };
  }

  // Fallback / default
  return { c1Final, c2Final, finalGrade, status: 'regular' };
}
