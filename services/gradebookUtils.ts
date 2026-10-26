import { GradebookEntry, StudentAcademicStatus } from '../types';

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

export interface DuplicateSuggestion {
  entryA: GradebookEntry;
  entryB: GradebookEntry;
  reason: 'mismo_dni' | 'mismas_palabras' | 'apellido_coincidente';
  confidence: 'alta' | 'media';
  description: string;
}

/**
 * Checks if two names are likely the same person based on:
 * 1. Normalized exact match
 * 2. Word-set permutation (e.g. "Soria Brisa Yanina" vs "Yanina Soria Brisa")
 * 3. Subset overlap with at least 2 common words (e.g. "Valor Mauro" in "Valor Mauro Ezequiel")
 */
export function areNamesFuzzyMatch(
  lastA: string,
  firstA: string,
  lastB: string,
  firstB: string
): boolean {
  const normA = (lastA + ' ' + firstA).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const normB = (lastB + ' ' + firstB).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (normA === normB) return true;

  const wordsA = normA.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const wordsB = normB.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  if (wordsA.length < 2 || wordsB.length < 2) return false;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  // Exact set match: "Soria Brisa Yanina" vs "Yanina Soria Brisa"
  if (setA.size === setB.size && [...setA].every(w => setB.has(w))) {
    return true;
  }

  // Subset match with at least 2 common words: "Valor Mauro" in "Valor Mauro Ezequiel"
  const common = [...setA].filter(w => setB.has(w));
  if (common.length >= 2 && (common.length === setA.size || common.length === setB.size)) {
    return true;
  }

  // Same last name and first name prefix/token match
  const lA = lastA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const lB = lastB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (lA && lB && lA === lB && common.length >= 2) {
    return true;
  }

  return false;
}

/**
 * Scans an array of GradebookEntry objects and finds suggested duplicate pairs
 */
export function findSuggestedDuplicates(entries: GradebookEntry[]): DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const pairKey = [a.id, b.id].sort().join(':');
      if (seenPairs.has(pairKey)) continue;

      // 1. Same DNI (if both have DNI)
      const dniA = (a.studentDni || '').trim();
      const dniB = (b.studentDni || '').trim();
      if (dniA && dniB && dniA === dniB) {
        suggestions.push({
          entryA: a,
          entryB: b,
          reason: 'mismo_dni',
          confidence: 'alta',
          description: `Mismo DNI (${dniA}) registrado en ambas filas`
        });
        seenPairs.add(pairKey);
        continue;
      }

      // 2. Name fuzzy matching
      const wordsA = (a.studentLastName + ' ' + a.studentFirstName)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 2);
      const wordsB = (b.studentLastName + ' ' + b.studentFirstName)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 2);

      const setA = new Set(wordsA);
      const setB = new Set(wordsB);

      if (setA.size >= 2 && setB.size >= 2) {
        // Exact words inverted: "SORIA, Brisa Yanina" vs "YANINA, Soria Brisa"
        if (setA.size === setB.size && [...setA].every(w => setB.has(w))) {
          suggestions.push({
            entryA: a,
            entryB: b,
            reason: 'mismas_palabras',
            confidence: 'alta',
            description: 'Mismo alumno con Apellido/Nombre ingresado en distinto orden'
          });
          seenPairs.add(pairKey);
          continue;
        }

        // Subset overlap: "VALOR, Mauro" vs "VALOR, Mauro Ezequiel"
        const common = [...setA].filter(w => setB.has(w));
        if (common.length >= 2 && (common.length === setA.size || common.length === setB.size)) {
          suggestions.push({
            entryA: a,
            entryB: b,
            reason: 'apellido_coincidente',
            confidence: 'alta',
            description: 'Mismo apellido y coincidencia de nombre'
          });
          seenPairs.add(pairKey);
          continue;
        }
      }
    }
  }

  return suggestions;
}
