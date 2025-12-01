import { Subject, Question, ExamConfig, ExamResult, Teacher, Unit } from '../types';
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

      // Update exam_configs
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS id UUID`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE CASCADE`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'unit'`;
      await sql`ALTER TABLE exam_configs ADD COLUMN IF NOT EXISTS integrative_config TEXT`; // JSON config for integrative exams

      // Update results table
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS unit_id UUID`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS unit_name TEXT`;
      await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS type TEXT`;

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
        options: row.options,
        correctOptionIndex: row.correct_option_index,
        isActive: row.is_active,
        isActiveIntegrative: row.is_active_integrative
      }));
    } catch (e) {
      console.error("Error fetching questions:", e);
      return [];
    }
  },

  addQuestion: async (question: Omit<Question, 'id'>): Promise<Question> => {
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO questions (id, subject_id, unit_id, question_type, text, options, correct_option_index, is_active, is_active_integrative)
      VALUES (${id}, ${question.subjectId}, ${question.unitId}, ${question.questionType}, ${question.text}, ${JSON.stringify(question.options)}, ${JSON.stringify(question.correctOptionIndex)}, ${question.isActive}, ${question.isActiveIntegrative || false})
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
      unit_id = ${question.unitId}
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
        integrativeConfig
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

  saveExamConfig: async (config: ExamConfig): Promise<void> => {
    const id = config.id || crypto.randomUUID();

    // Serialize integrativeConfig if present
    const integrativeConfigJson = config.integrativeConfig ? JSON.stringify(config.integrativeConfig) : null;

    // Explicitly set unit_id to NULL for integrative exams
    const unitIdValue = config.unitId || null;

    // Upsert using ON CONFLICT
    if (config.unitId) {
      // Unit exam - use the unique constraint on (subject_id, unit_id)
      await sql`
        INSERT INTO exam_configs (id, subject_id, unit_id, type, is_active, passing_grade, integrative_config)
        VALUES (${id}, ${config.subjectId}, ${unitIdValue}, ${config.type}, ${config.isActive}, ${config.passingGrade}, ${integrativeConfigJson})
        ON CONFLICT (subject_id, unit_id) 
        DO UPDATE SET 
          is_active = EXCLUDED.is_active,
          passing_grade = EXCLUDED.passing_grade,
          integrative_config = EXCLUDED.integrative_config,
          type = EXCLUDED.type
      `;
    } else {
      // Integrative exam - use a different approach since partial unique index doesn't work well with ON CONFLICT
      // First try to update, if no rows affected, then insert
      const updateResult = await sql`
        UPDATE exam_configs 
        SET is_active = ${config.isActive},
            passing_grade = ${config.passingGrade},
            integrative_config = ${integrativeConfigJson}
        WHERE subject_id = ${config.subjectId} 
          AND type = 'integrative'
          AND unit_id IS NULL
      `;

      // If no rows were updated, insert a new one
      if (updateResult.length === 0) {
        await sql`
          INSERT INTO exam_configs (id, subject_id, unit_id, type, is_active, passing_grade, integrative_config)
          VALUES (${id}, ${config.subjectId}, NULL, 'integrative', ${config.isActive}, ${config.passingGrade}, ${integrativeConfigJson})
        `;
      }
    }
  },

  // Results
  saveResult: async (result: ExamResult): Promise<void> => {
    await sql`
      INSERT INTO results (id, subject_id, subject_name, student_name, score, total_questions, percentage, grade, passed, timestamp, unit_id, unit_name, type)
      VALUES (${result.id}, ${result.subjectId}, ${result.subjectName}, ${result.studentName}, ${result.score}, ${result.totalQuestions}, ${result.percentage}, ${result.grade}, ${result.passed}, ${result.timestamp}, ${result.unitId || null}, ${result.unitName || null}, ${result.type || 'integrative'})
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
        score: Number(row.score),
        totalQuestions: Number(row.total_questions),
        percentage: Number(row.percentage),
        grade: Number(row.grade),
        passed: row.passed,
        timestamp: Number(row.timestamp), // Ensure number
        unitId: row.unit_id,
        unitName: row.unit_name,
        type: row.type as 'unit' | 'integrative'
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
        score: Number(row.score),
        totalQuestions: Number(row.total_questions),
        percentage: Number(row.percentage),
        grade: Number(row.grade),
        passed: row.passed,
        timestamp: Number(row.timestamp),
        unitId: row.unit_id,
        unitName: row.unit_name,
        type: row.type as 'unit' | 'integrative'
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

  // Local Security (Prevent Retakes on same device)
  markExamCompletedLocally: (subjectId: string) => {
    // This can remain synchronous as it's device-specific logic
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_LOCAL);
    const list = stored ? JSON.parse(stored) : [];
    if (!list.includes(subjectId)) {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_LOCAL, JSON.stringify([...list, subjectId]));
    }
  },

  getCompletedExamsLocally: (): string[] => {
    // This can remain synchronous
    const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_LOCAL);
    return stored ? JSON.parse(stored) : [];
  }
};