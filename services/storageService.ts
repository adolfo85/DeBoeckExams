import { Subject, Question, ExamConfig, ExamResult, Teacher, Unit, AuditEvent, GradebookEntry, StudentAcademicStatus } from '../types';
import { calculateAcademicStatus, parseStudentName } from './gradebookUtils';
import { sql } from './db';

const STORAGE_KEYS = {
  COMPLETED_LOCAL: 'deboeck_completed_exams_device'
};

export const storageService = {
  // Migration
  migrateSchema: async () => {
    try {
      // Create units table
      await sql`
        CREATE TABLE IF NOT EXISTS units (
          id UUID PRIMARY KEY,
          subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
          name TEXT NOT NULL
        )
      `;

      // Add columns to questions
      await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_active_integrative BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic TEXT`;

      // Update exam_configs
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS id UUID`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'unit'`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS integrative_config TEXT`; // JSON config for integrative exams

      // Update results table
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS unit_id UUID`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS unit_name TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS type TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS answers_json TEXT`;

      // Timer fields for exam configs
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS end_timestamp BIGINT`;

      // Exam session names (for custom naming of exam sessions in Results view)
      await sql`
        CREATE TABLE IF NOT EXISTS exam_session_names (
          session_key TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `;

      // Audit log table (anti-leak incident tracking)
      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY,
          student_name TEXT NOT NULL,
          student_dni TEXT NOT NULL,
          subject_name TEXT NOT NULL,
          event_type TEXT NOT NULL,
          timestamp BIGINT NOT NULL
        )
      `;

      // Device tracking columns for audit_logs
      await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_id TEXT`;
      await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_fingerprint TEXT`;
      await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_info TEXT`;
      await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`;

      // Device tracking & DNI columns for results
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS student_dni TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS student_last_name TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS student_first_name TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS device_id TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS device_fingerprint TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS device_info TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS ip_address TEXT`;

      // Planilla de Exámenes (Gradebook)
      await sql`
        CREATE TABLE IF NOT EXISTS exam_gradebook (
          id UUID PRIMARY KEY,
          subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
          student_dni TEXT,
          student_last_name TEXT NOT NULL,
          student_first_name TEXT NOT NULL,
          c1_exam NUMERIC,
          c1_recup NUMERIC,
          c1_final NUMERIC,
          c2_exam NUMERIC,
          c2_recup NUMERIC,
          c2_final NUMERIC,
          final_grade NUMERIC,
          status TEXT NOT NULL DEFAULT 'regular',
          status_override BOOLEAN DEFAULT false,
          academic_year INTEGER NOT NULL DEFAULT 2026,
          notes TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        )
      `;
      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_gradebook_subject ON exam_gradebook(subject_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_gradebook_dni ON exam_gradebook(student_dni)`;
      } catch (e) {
        // ignore index creation if not supported
      }

      // Backfill IDs for exam_configs if they are null
      try {
        await sql`UPDATE exam_configs SET id = gen_random_uuid() WHERE id IS NULL`;
      } catch (e) {
        console.warn("Could not backfill IDs with gen_random_uuid, skipping:", e);
      }

      // Cleanup duplicates and add constraints
      try {
        // 1. Cleanup duplicates for Units
        await sql`
          DELETE FROM exam_configs a USING exam_configs b
          WHERE a.id < b.id 
          AND a.subject_id = b.subject_id 
          AND a.unit_id = b.unit_id 
          AND a.unit_id IS NOT NULL
        `;

        // 2. Cleanup duplicates for Integrative
        await sql`
          DELETE FROM exam_configs a USING exam_configs b
          WHERE a.id < b.id 
          AND a.subject_id = b.subject_id 
          AND a.type = 'integrative'
          AND a.unit_id IS NULL
        `;

        // 3. Add Unique Constraint for Units
        // We use a try-catch for the constraint creation as it might fail if duplicates still exist (shouldn't happen) or if it already exists
        try {
          await sql`ALTER TABLE exam_configs ADD CONSTRAINT unique_subject_unit UNIQUE (subject_id, unit_id)`;
        } catch (e) {
          // Ignore if already exists
        }

        // 4. Add Unique Index for Integrative
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_subject_integrative ON exam_configs (subject_id) WHERE type = 'integrative'`;

        // 5. DATA CONSISTENCY FIXES (New)
        // Fix records that have a unit_id but are marked as 'integrative' (should be 'unit')
        await sql`UPDATE exam_configs SET type = 'unit' WHERE unit_id IS NOT NULL AND type = 'integrative'`;

        // Remove legacy/invalid records that have NO unit_id but are marked as 'unit' (should be 'integrative' or deleted)
        // We delete them to avoid confusion, as the system will generate a new 'integrative' config if needed.
        await sql`DELETE FROM exam_configs WHERE unit_id IS NULL AND type = 'unit'`;

      } catch (e) {
        console.error("Error cleaning up duplicates or adding constraints:", e);
      }

      console.log("Schema migration completed");
    } catch (e) {
      console.error("Schema migration failed:", e);
    }
  },

  // Authentication
  register: async (name: string, email: string, password: string): Promise<Teacher> => {
    const id = crypto.randomUUID();
    // New teachers are not approved by default
    await sql`INSERT INTO teachers (id, name, email, password, is_approved, is_super_admin) VALUES (${id}, ${name}, ${email}, ${password}, false, false)`;
    return { id, name, email, password, is_approved: false, is_super_admin: false };
  },

  login: async (email: string, password: string): Promise<Teacher | null> => {
    try {
      const result = await sql`SELECT * FROM teachers WHERE email = ${email} AND password = ${password}`;
      if (result.length === 0) return null;
      const teacher = result[0] as Teacher;
      // Allow login if approved or if the user is a super admin
      if (!teacher.is_approved && !teacher.is_super_admin) {
        return null; // Will show as "incorrect credentials"
      }
      return teacher;
    } catch (e) {
      console.error("Error during login:", e);
      return null;
    }
  },

  getTeacher: async (id: string): Promise<Teacher | null> => {
    try {
      const result = await sql`SELECT * FROM teachers WHERE id = ${id}`;
      if (result.length === 0) return null;
      return result[0] as Teacher;
    } catch (e) {
      console.error("Error fetching teacher:", e);
      return null;
    }
  },

  getAllTeachers: async (): Promise<Teacher[]> => {
    try {
      const result = await sql`SELECT id, name, email, is_approved, is_super_admin FROM teachers ORDER BY name`;
      return result as Teacher[];
    } catch (e) {
      console.error("Error fetching teachers:", e);
      return [];
    }
  },

  // Admin: Get all teachers including pending approval
  getAllTeachersForAdmin: async (): Promise<Teacher[]> => {
    try {
      const result = await sql`SELECT id, name, email, is_approved, is_super_admin FROM teachers WHERE is_super_admin = false ORDER BY is_approved ASC, name ASC`;
      return result as Teacher[];
    } catch (e) {
      console.error("Error fetching teachers for admin:", e);
      return [];
    }
  },

  updateTeacherApproval: async (teacherId: string, isApproved: boolean): Promise<void> => {
    await sql`UPDATE teachers SET is_approved = ${isApproved} WHERE id = ${teacherId}`;
  },

  deleteTeacher: async (teacherId: string): Promise<void> => {
    // Delete teacher - cascade will handle subjects and related data
    await sql`DELETE FROM teachers WHERE id = ${teacherId} AND is_super_admin = false`;
  },

  // Subjects (Espacios Curriculares)
  getSubjects: async (teacherId?: string): Promise<Subject[]> => {
    try {
      let result;
      if (teacherId) {
        result = await sql`SELECT * FROM subjects WHERE teacher_id = ${teacherId}`;
      } else {
        result = await sql`SELECT * FROM subjects`;
      }
      return result as Subject[];
    } catch (e) {
      console.error("Error fetching subjects:", e);
      return [];
    }
  },

  addSubject: async (name: string, teacherId: string): Promise<Subject> => {
    const id = crypto.randomUUID();
    await sql`INSERT INTO subjects (id, name, teacher_id) VALUES (${id}, ${name}, ${teacherId})`;
    // Initialize default config (legacy support, maybe not needed if we move to units)
    // await sql`INSERT INTO exam_configs (subject_id, is_active, passing_grade) VALUES (${id}, false, 6)`;
    return { id, name };
  },

  deleteSubject: async (id: string): Promise<void> => {
    // Cascade delete handles related data automatically based on table definition
    await sql`DELETE FROM subjects WHERE id = ${id}`;
  },

  // Units
  getUnits: async (subjectId: string): Promise<Unit[]> => {
    try {
      const result = await sql`SELECT * FROM units WHERE subject_id = ${subjectId} ORDER BY name`;
      return result as Unit[];
    } catch (e) {
      console.error("Error fetching units:", e);
      return [];
    }
  },

  addUnit: async (subjectId: string, name: string): Promise<Unit> => {
    const id = crypto.randomUUID();
    await sql`INSERT INTO units (id, subject_id, name) VALUES (${id}, ${subjectId}, ${name})`;
    // Initialize default config for this unit
    const configId = crypto.randomUUID();
    await sql`INSERT INTO exam_configs (id, subject_id, unit_id, type, is_active, passing_grade) VALUES (${configId}, ${subjectId}, ${id}, 'unit', false, 6)`;
    return { id, subjectId, name };
  },

  deleteUnit: async (id: string): Promise<void> => {
    await sql`DELETE FROM units WHERE id = ${id}`;
  },

  // Questions
  getQuestions: async (subjectId: string, unitId?: string): Promise<Question[]> => {
    try {
      let result;
      if (unitId) {
        result = await sql`SELECT * FROM questions WHERE subject_id = ${subjectId} AND unit_id = ${unitId}`;
      } else {
        result = await sql`SELECT * FROM questions WHERE subject_id = ${subjectId}`;
      }

      // Map DB columns to Typescript interface
      return result.map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        unitId: row.unit_id,
        questionType: row.question_type || 'multiple_choice',
        text: row.text,
        options: Array.isArray(row.options)
          ? row.options
          : (typeof row.options === 'string' ? JSON.parse(row.options) : row.options),
        correctOptionIndex: (() => {
          const raw = row.correct_option_index;
          if (raw === null || raw === undefined) return 0;
          if (typeof raw === 'number') return raw;
          try { return JSON.parse(raw); } catch { return Number(raw); }
        })(),
        isActive: row.is_active,
        isActiveIntegrative: row.is_active_integrative,
        topic: row.topic
      }));
    } catch (e) {
      console.error("Error fetching questions:", e);
      return [];
    }
  },

  addQuestion: async (question: Omit<Question, 'id'>): Promise<Question> => {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO questions (id, subject_id, unit_id, question_type, text, options, correct_option_index, is_active, is_active_integrative, topic)
      VALUES (${id}, ${question.subjectId}, ${question.unitId}, ${question.questionType}, ${question.text}, ${JSON.stringify(question.options)}, ${JSON.stringify(question.correctOptionIndex)}, ${question.isActive}, ${question.isActiveIntegrative || false}, ${question.topic || null})
    `;
    return { ...question, id };
  },

  updateQuestion: async (question: Question): Promise<void> => {
    await sql`
      UPDATE questions 
      SET text = ${question.text}, 
      question_type = ${question.questionType},
      options = ${JSON.stringify(question.options)}, 
      correct_option_index = ${JSON.stringify(question.correctOptionIndex)},
      is_active = ${question.isActive},
      is_active_integrative = ${question.isActiveIntegrative || false},
      unit_id = ${question.unitId},
      topic = ${question.topic || null}
      WHERE id = ${question.id}
    `;
  },

  updateAllQuestionsStatus: async (subjectId: string, isActive: boolean): Promise<void> => {
    await sql`UPDATE questions SET is_active = ${isActive} WHERE subject_id = ${subjectId}`;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await sql`DELETE FROM questions WHERE id = ${id}`;
  },

  // Exam Configs
  getExamConfig: async (subjectId: string, unitId?: string): Promise<ExamConfig> => {
    try {
      let result;
      if (unitId) {
        result = await sql`SELECT * FROM exam_configs WHERE subject_id = ${subjectId} AND unit_id = ${unitId}`;
      } else {
        // Integrative exam (or legacy subject exam)
        // We look for type='integrative' OR (unit_id IS NULL AND type='unit' for legacy)
        // But let's prioritize 'integrative' type if we are moving forward.
        result = await sql`SELECT * FROM exam_configs WHERE subject_id = ${subjectId} AND (type = 'integrative' OR unit_id IS NULL) ORDER BY type DESC LIMIT 1`;
      }

      if (result.length === 0) {
        return {
          subjectId,
          unitId,
          type: unitId ? 'unit' : 'integrative',
          isActive: false,
          passingGrade: 6,
          integrativeConfig: []
        };
      }
      const row = result[0];

      // Parse integrativeConfig if present
      let integrativeConfig = undefined;
      if (row.integrative_config) {
        try {
          integrativeConfig = JSON.parse(row.integrative_config);
        } catch (e) {
          console.error('Failed to parse integrative_config:', e);
        }
      }

      return {
        id: row.id,
        subjectId: row.subject_id,
        unitId: row.unit_id,
        type: row.type as 'unit' | 'integrative',
        isActive: row.is_active,
        passingGrade: row.passing_grade,
        integrativeConfig,
        durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : 0,
        endTimestamp: row.end_timestamp ? Number(row.end_timestamp) : undefined,
      };
    } catch (e) {
      console.error("Error fetching config:", e);
      return {
        subjectId,
        unitId,
        type: unitId ? 'unit' : 'integrative',
        isActive: false,
        passingGrade: 6,
        integrativeConfig: []
      };
    }
  },

  getActiveExams: async (teacherId: string) => {
    try {
      const result = await sql`
        SELECT 
          s.id as subject_id, 
          s.name as subject_name, 
          c.unit_id, 
          u.name as unit_name, 
          c.type 
        FROM exam_configs c
        JOIN subjects s ON c.subject_id = s.id
        LEFT JOIN units u ON c.unit_id = u.id
        WHERE s.teacher_id = ${teacherId} AND c.is_active = true
      `;
      return result.map((row: any) => ({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        unitId: row.unit_id,
        unitName: row.unit_name,
        type: row.type as 'unit' | 'integrative'
      }));
    } catch (e) {
      console.error("Error fetching active exams:", e);
      return [];
    }
  },

  saveExamConfig: async (config: ExamConfig): Promise<void> => {
    // Serialize integrativeConfig if present
    const integrativeConfigJson = config.integrativeConfig ? JSON.stringify(config.integrativeConfig) : null;
    const durationMinutes = config.durationMinutes ?? 0;
    const endTimestamp = config.endTimestamp ?? null;

    if (config.unitId) {
      await sql`
        DELETE FROM exam_configs 
        WHERE subject_id = ${config.subjectId} 
          AND unit_id = ${config.unitId}
      `;
      const newId = crypto.randomUUID();
      await sql`
        INSERT INTO exam_configs (id, subject_id, unit_id, type, is_active, passing_grade, integrative_config, duration_minutes, end_timestamp)
        VALUES (${newId}, ${config.subjectId}, ${config.unitId}, ${config.type}, ${config.isActive}, ${config.passingGrade}, ${integrativeConfigJson}, ${durationMinutes}, ${endTimestamp})
      `;
    } else {
      await sql`
        DELETE FROM exam_configs 
        WHERE subject_id = ${config.subjectId} 
          AND type = 'integrative'
      `;
      const newId = crypto.randomUUID();
      await sql`
        INSERT INTO exam_configs (id, subject_id, unit_id, type, is_active, passing_grade, integrative_config, duration_minutes, end_timestamp)
        VALUES (${newId}, ${config.subjectId}, NULL, 'integrative', ${config.isActive}, ${config.passingGrade}, ${integrativeConfigJson}, ${durationMinutes}, ${endTimestamp})
      `;
    }
  },

  // Results
  saveResult: async (result: ExamResult): Promise<void> => {
    await sql`
      INSERT INTO results (
        id, subject_id, subject_name, student_name, score, total_questions, percentage, grade, passed, timestamp, unit_id, unit_name, type, answers_json,
        student_dni, device_id, device_fingerprint, device_info, ip_address
      )
      VALUES (
        ${result.id}, ${result.subjectId}, ${result.subjectName}, ${result.studentName}, ${result.score}, ${result.totalQuestions}, ${result.percentage}, ${result.grade}, ${result.passed}, ${result.timestamp}, ${result.unitId || null}, ${result.unitName || null}, ${result.type || 'integrative'}, ${result.answersJson || null},
        ${result.studentDni || null}, ${result.deviceId || null}, ${result.deviceFingerprint || null}, ${result.deviceInfo || null}, ${result.ipAddress || null}
      )
    `;
  },

  getResults: async (teacherId?: string): Promise<ExamResult[]> => {
    try {
      let result;
      if (teacherId) {
        result = await sql`
          SELECT r.* 
          FROM results r
          JOIN subjects s ON r.subject_id = s.id
          WHERE s.teacher_id = ${teacherId}
          ORDER BY r.timestamp DESC
        `;
      } else {
        result = await sql`SELECT * FROM results ORDER BY timestamp DESC`;
      }

      return result.map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        studentName: row.student_name,
        studentDni: row.student_dni || undefined,
        score: Number(row.score),
        totalQuestions: Number(row.total_questions),
        percentage: Number(row.percentage),
        grade: Number(row.grade),
        passed: row.passed,
        timestamp: Number(row.timestamp),
        unitId: row.unit_id,
        unitName: row.unit_name,
        type: row.type as 'unit' | 'integrative',
        answersJson: row.answers_json || undefined,
        deviceId: row.device_id || undefined,
        deviceFingerprint: row.device_fingerprint || undefined,
        deviceInfo: row.device_info || undefined,
        ipAddress: row.ip_address || undefined,
      }));
    } catch (e) {
      console.error("Error fetching results:", e);
      return [];
    }
  },

  getResultsBySubject: async (subjectId: string): Promise<ExamResult[]> => {
    try {
      const result = await sql`SELECT * FROM results WHERE subject_id = ${subjectId} ORDER BY timestamp DESC`;
      return result.map((row: any) => ({
        id: row.id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        studentName: row.student_name,
        studentDni: row.student_dni || undefined,
        score: Number(row.score),
        totalQuestions: Number(row.total_questions),
        percentage: Number(row.percentage),
        grade: Number(row.grade),
        passed: row.passed,
        timestamp: Number(row.timestamp),
        unitId: row.unit_id,
        unitName: row.unit_name,
        type: row.type as 'unit' | 'integrative',
        deviceId: row.device_id || undefined,
        deviceFingerprint: row.device_fingerprint || undefined,
        deviceInfo: row.device_info || undefined,
        ipAddress: row.ip_address || undefined,
      }));
    } catch (e) {
      console.error("Error fetching results:", e);
      return [];
    }
  },

  deleteResults: async (subjectId?: string): Promise<void> => {
    if (subjectId && subjectId !== 'all') {
      await sql`DELETE FROM results WHERE subject_id = ${subjectId}`;
    } else {
      await sql`DELETE FROM results`;
    }
  },

  deleteResultById: async (id: string): Promise<void> => {
    await sql`DELETE FROM results WHERE id = ${id}`;
  },

  // Exam Session Names
  getSessionName: async (sessionKey: string): Promise<string | null> => {
    try {
      const result = await sql`SELECT name FROM exam_session_names WHERE session_key = ${sessionKey}`;
      return result.length > 0 ? result[0].name as string : null;
    } catch (e) {
      return null;
    }
  },

  getAllSessionNames: async (): Promise<Record<string, string>> => {
    try {
      const result = await sql`SELECT session_key, name FROM exam_session_names`;
      return Object.fromEntries(result.map((r: any) => [r.session_key, r.name]));
    } catch (e) {
      return {};
    }
  },

  setSessionName: async (sessionKey: string, name: string): Promise<void> => {
    await sql`
      INSERT INTO exam_session_names (session_key, name) VALUES (${sessionKey}, ${name})
      ON CONFLICT (session_key) DO UPDATE SET name = ${name}
    `;
  },

  // Local Security (Prevent Retakes on same device)
  markExamCompletedLocally: (subjectId: string) => {
    // This can remain synchronous as it's device-specific logic
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_LOCAL);
    const list = stored ? JSON.parse(stored) : [];

    const now = Date.now();
    // Filter and clean up expired or old format entries
    const validList = list.filter((item: any) => {
      if (typeof item === 'string') return false; // Expire legacy strings immediately
      if (item && item.timestamp && item.id) {
        return now - item.timestamp < 10 * 60 * 1000; // 10 minutes (600,000 ms)
      }
      return false;
    });

    // Check if the current subjectId is already in the valid list
    const isAlreadyCompleted = validList.some((item: any) => item.id === subjectId);

    if (!isAlreadyCompleted) {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_LOCAL, JSON.stringify([...validList, { id: subjectId, timestamp: now }]));
    } else {
      // Just update localStorage with the cleaned valid list
      localStorage.setItem(STORAGE_KEYS.COMPLETED_LOCAL, JSON.stringify(validList));
    }
  },

  getCompletedExamsLocally: (): string[] => {
    // This can remain synchronous
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_LOCAL);
    if (!stored) return [];

    const list = JSON.parse(stored);
    const now = Date.now();

    // Filter and clean up expired entries
    const validList = list.filter((item: any) => {
      if (typeof item === 'string') return false; // Expire legacy strings immediately
      if (item && item.timestamp && item.id) {
        return now - item.timestamp < 10 * 60 * 1000; // 10 minutes (600,000 ms)
      }
      return false;
    });

    // Save the cleaned up list back to storage to keep it small
    localStorage.setItem(STORAGE_KEYS.COMPLETED_LOCAL, JSON.stringify(validList));

    // Return an array of just the IDs for easy checking in StudentView
    return validList.map((item: any) => item.id);
  },

  // ── Audit Logs ───────────────────────────────────────────────────────────
  /**
   * Records a suspicious focus-loss event from a student's exam session.
   * The table is created on first use so no manual migration is needed.
   * Uses fire-and-forget: never throws so it never disrupts the student UI.
   */
  logAuditEvent: async (event: Omit<AuditEvent, 'id'>): Promise<void> => {
    // Table is guaranteed to exist (created in migrateSchema on teacher login).
    // Silent fail — never interrupts the student exam.
    try {
      const id = crypto.randomUUID();
      await sql`
        INSERT INTO audit_logs (id, student_name, student_dni, subject_name, event_type, timestamp, device_id, device_fingerprint, device_info, ip_address)
        VALUES (
          ${id},
          ${event.studentName},
          ${event.studentDni},
          ${event.subjectName},
          ${event.eventType},
          ${event.timestamp},
          ${event.deviceId || null},
          ${event.deviceFingerprint || null},
          ${event.deviceInfo || null},
          ${event.ipAddress || null}
        )
      `;
    } catch (e) {
      console.warn('[Audit] Could not log event:', e);
    }
  },

  /**
   * Deletes all audit log records from the database.
   * Useful for freeing server space once incidents have been reviewed.
   */
  deleteAuditLogs: async (): Promise<void> => {
    try {
      await sql`DELETE FROM audit_logs`;
    } catch (e) {
      console.warn('[Audit] Could not delete logs:', e);
    }
  },

  /**
   * Fetches audit events, optionally filtered to a recent window (hours).
   * Returns newest first.
   */
  getAuditLogs: async (lastHours = 48): Promise<AuditEvent[]> => {
    try {
      const since = Date.now() - lastHours * 60 * 60 * 1000;
      const rows = await sql`
        SELECT * FROM audit_logs
        WHERE timestamp > ${since}
        ORDER BY timestamp DESC
        LIMIT 500
      `;
      return rows.map((r: any) => ({
        id: r.id,
        studentName: r.student_name,
        studentDni: r.student_dni,
        subjectName: r.subject_name,
        eventType: r.event_type as AuditEvent['eventType'],
        timestamp: Number(r.timestamp),
        deviceId: r.device_id || undefined,
        deviceFingerprint: r.device_fingerprint || undefined,
        deviceInfo: r.device_info || undefined,
        ipAddress: r.ip_address || undefined,
      }));
    } catch (e) {
      console.warn('[Audit] Could not fetch logs:', e);
      return [];
    }
  },

  // ── Planilla de Exámenes (Gradebook) ────────────────────────────────────────
  getGradebookEntries: async (subjectId: string, academicYear?: number): Promise<GradebookEntry[]> => {
    try {
      const year = academicYear || new Date().getFullYear();
      const rows = await sql`
        SELECT * FROM exam_gradebook
        WHERE subject_id = ${subjectId} AND academic_year = ${year}
        ORDER BY student_last_name ASC, student_first_name ASC
      `;
      return rows.map((r: any) => ({
        id: r.id,
        subjectId: r.subject_id,
        studentDni: r.student_dni || undefined,
        studentLastName: r.student_last_name,
        studentFirstName: r.student_first_name,
        c1Exam: r.c1_exam !== null ? Number(r.c1_exam) : null,
        c1Recup: r.c1_recup !== null ? Number(r.c1_recup) : null,
        c1Final: r.c1_final !== null ? Number(r.c1_final) : null,
        c2Exam: r.c2_exam !== null ? Number(r.c2_exam) : null,
        c2Recup: r.c2_recup !== null ? Number(r.c2_recup) : null,
        c2Final: r.c2_final !== null ? Number(r.c2_final) : null,
        finalGrade: r.final_grade !== null ? Number(r.final_grade) : null,
        status: (r.status as StudentAcademicStatus) || 'regular',
        statusOverride: Boolean(r.status_override),
        academicYear: Number(r.academic_year || 2026),
        notes: r.notes || undefined,
        createdAt: Number(r.created_at || Date.now()),
        updatedAt: Number(r.updated_at || Date.now())
      }));
    } catch (e) {
      console.error("Error fetching gradebook entries:", e);
      return [];
    }
  },

  saveGradebookEntry: async (entry: Omit<GradebookEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<GradebookEntry> => {
    const id = entry.id || crypto.randomUUID();
    const now = Date.now();
    const calc = calculateAcademicStatus({
      c1Exam: entry.c1Exam,
      c1Recup: entry.c1Recup,
      c2Exam: entry.c2Exam,
      c2Recup: entry.c2Recup,
      statusOverride: entry.status,
      isOverride: entry.statusOverride
    });

    await sql`
      INSERT INTO exam_gradebook (
        id, subject_id, student_dni, student_last_name, student_first_name,
        c1_exam, c1_recup, c1_final, c2_exam, c2_recup, c2_final,
        final_grade, status, status_override, academic_year, notes,
        created_at, updated_at
      ) VALUES (
        ${id}, ${entry.subjectId}, ${entry.studentDni || null}, ${entry.studentLastName.trim().toUpperCase()}, ${entry.studentFirstName.trim()},
        ${entry.c1Exam !== undefined ? entry.c1Exam : null}, ${entry.c1Recup !== undefined ? entry.c1Recup : null}, ${calc.c1Final},
        ${entry.c2Exam !== undefined ? entry.c2Exam : null}, ${entry.c2Recup !== undefined ? entry.c2Recup : null}, ${calc.c2Final},
        ${calc.finalGrade}, ${calc.status}, ${entry.statusOverride || false}, ${entry.academicYear || 2026}, ${entry.notes || null},
        ${now}, ${now}
      )
    `;

    return {
      id,
      subjectId: entry.subjectId,
      studentDni: entry.studentDni,
      studentLastName: entry.studentLastName.trim().toUpperCase(),
      studentFirstName: entry.studentFirstName.trim(),
      c1Exam: entry.c1Exam ?? null,
      c1Recup: entry.c1Recup ?? null,
      c1Final: calc.c1Final,
      c2Exam: entry.c2Exam ?? null,
      c2Recup: entry.c2Recup ?? null,
      c2Final: calc.c2Final,
      finalGrade: calc.finalGrade,
      status: calc.status,
      statusOverride: entry.statusOverride,
      academicYear: entry.academicYear || 2026,
      notes: entry.notes,
      createdAt: now,
      updatedAt: now
    };
  },

  updateGradebookEntry: async (id: string, updates: Partial<GradebookEntry>): Promise<void> => {
    try {
      const now = Date.now();
      const existingRows = await sql`SELECT * FROM exam_gradebook WHERE id = ${id}`;
      if (existingRows.length === 0) return;
      const existing = existingRows[0];

      const merged = {
        studentDni: updates.studentDni !== undefined ? updates.studentDni : existing.student_dni,
        studentLastName: updates.studentLastName !== undefined ? updates.studentLastName : existing.student_last_name,
        studentFirstName: updates.studentFirstName !== undefined ? updates.studentFirstName : existing.student_first_name,
        c1Exam: updates.c1Exam !== undefined ? updates.c1Exam : (existing.c1_exam !== null ? Number(existing.c1_exam) : null),
        c1Recup: updates.c1Recup !== undefined ? updates.c1Recup : (existing.c1_recup !== null ? Number(existing.c1_recup) : null),
        c2Exam: updates.c2Exam !== undefined ? updates.c2Exam : (existing.c2_exam !== null ? Number(existing.c2_exam) : null),
        c2Recup: updates.c2Recup !== undefined ? updates.c2Recup : (existing.c2_recup !== null ? Number(existing.c2_recup) : null),
        statusOverride: updates.statusOverride !== undefined ? updates.statusOverride : Boolean(existing.status_override),
        status: updates.status !== undefined ? updates.status : (existing.status as StudentAcademicStatus),
        notes: updates.notes !== undefined ? updates.notes : existing.notes
      };

      const calc = calculateAcademicStatus({
        c1Exam: merged.c1Exam,
        c1Recup: merged.c1Recup,
        c2Exam: merged.c2Exam,
        c2Recup: merged.c2Recup,
        statusOverride: merged.status,
        isOverride: merged.statusOverride
      });

      await sql`
        UPDATE exam_gradebook SET
          student_dni = ${merged.studentDni || null},
          student_last_name = ${merged.studentLastName.trim().toUpperCase()},
          student_first_name = ${merged.studentFirstName.trim()},
          c1_exam = ${merged.c1Exam},
          c1_recup = ${merged.c1Recup},
          c1_final = ${calc.c1Final},
          c2_exam = ${merged.c2Exam},
          c2_recup = ${merged.c2Recup},
          c2_final = ${calc.c2Final},
          final_grade = ${calc.finalGrade},
          status = ${calc.status},
          status_override = ${merged.statusOverride},
          notes = ${merged.notes || null},
          updated_at = ${now}
        WHERE id = ${id}
      `;
    } catch (e) {
      console.error("Error updating gradebook entry:", e);
    }
  },

  deleteGradebookEntry: async (id: string): Promise<void> => {
    try {
      await sql`DELETE FROM exam_gradebook WHERE id = ${id}`;
    } catch (e) {
      console.error("Error deleting gradebook entry:", e);
    }
  },

  importResultsToGradebook: async (
    subjectId: string,
    targetColumn: 'c1_exam' | 'c1_recup' | 'c2_exam' | 'c2_recup',
    resultsToImport: ExamResult[],
    academicYear?: number
  ): Promise<{ inserted: number; updated: number }> => {
    const year = academicYear || new Date().getFullYear();
    const existingEntries = await storageService.getGradebookEntries(subjectId, year);
    let inserted = 0;
    let updated = 0;

    for (const res of resultsToImport) {
      const dni = (res.studentDni || '').trim();
      const parsed = parseStudentName(res.studentName);
      const lastName = (res.studentLastName || parsed.lastName).trim().toUpperCase();
      const firstName = (res.studentFirstName || parsed.firstName).trim();

      // Match strategy:
      // 1. Primary: match by DNI
      // 2. Secondary: match by normalized Apellido y Nombre
      let match: GradebookEntry | undefined = undefined;
      if (dni) {
        match = existingEntries.find(e => e.studentDni && e.studentDni.trim() === dni);
      }
      if (!match) {
        const normKey = `${lastName} ${firstName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        match = existingEntries.find(e => {
          const eKey = `${e.studentLastName} ${e.studentFirstName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return eKey === normKey;
        });
      }

      const gradeValue = res.grade;

      if (match) {
        const updates: Partial<GradebookEntry> = {
          studentDni: match.studentDni || dni || undefined
        };
        if (targetColumn === 'c1_exam') updates.c1Exam = gradeValue;
        if (targetColumn === 'c1_recup') updates.c1Recup = gradeValue;
        if (targetColumn === 'c2_exam') updates.c2Exam = gradeValue;
        if (targetColumn === 'c2_recup') updates.c2Recup = gradeValue;

        await storageService.updateGradebookEntry(match.id, updates);
        Object.assign(match, updates);
        updated++;
      } else {
        const newEntryData: any = {
          subjectId,
          studentDni: dni || undefined,
          studentLastName: lastName,
          studentFirstName: firstName,
          academicYear: year,
          c1Exam: targetColumn === 'c1_exam' ? gradeValue : null,
          c1Recup: targetColumn === 'c1_recup' ? gradeValue : null,
          c2Exam: targetColumn === 'c2_exam' ? gradeValue : null,
          c2Recup: targetColumn === 'c2_recup' ? gradeValue : null,
          status: 'regular' as StudentAcademicStatus,
          statusOverride: false
        };
        const created = await storageService.saveGradebookEntry(newEntryData);
        existingEntries.push(created);
        inserted++;
      }
    }

    return { inserted, updated };
  }
};