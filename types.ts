export interface Subject {
  id: string;
  name: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password: string;
  is_approved?: boolean;
  is_super_admin?: boolean;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'multiple_select';

export interface Unit {
  id: string;
  subjectId: string;
  name: string;
}

export interface IntegrativeUnitConfig {
  unitId: string;
  unitName: string;
  randomCount: number;
  specificQuestionIds: string[];
}

export interface Question {
  id: string;
  subjectId: string;
  unitId?: string; // Optional for migration or integrative-only questions
  questionType: QuestionType;
  text: string;
  options: string[];
  correctOptionIndex: number | number[]; // Array for multiple_select
  isActive: boolean; // Active for Unit Exam
  isActiveIntegrative?: boolean; // Deprecated, kept for backwards compatibility
  topic?: string; // Optional topic/theme for organization
}

export interface ExamConfig {
  id?: string; // New PK
  subjectId: string;
  unitId?: string; // If null, it's an integrative exam (or legacy)
  type: 'unit' | 'integrative';
  isActive: boolean;
  passingGrade: number;
  integrativeConfig?: IntegrativeUnitConfig[]; // For integrative exams only
  durationMinutes?: number; // 0 or undefined = no time limit
  endTimestamp?: number; // Unix ms when the exam ends (set on activation)
}

export interface ExamResult {
  id: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: number;
  passed: boolean;
  timestamp: number;
  unitId?: string;
  unitName?: string;
  type?: 'unit' | 'integrative';
  /** JSON-serialized Record<questionId, number | number[]> — stored when exam is submitted via ExamView */
  answersJson?: string;
}

export interface AdminState {
  isAuthenticated: boolean;
}

/** Registered each time a student's browser loses focus during an active exam */
export interface AuditEvent {
  id: string;
  studentName: string;
  studentDni: string;
  subjectName: string;
  eventType: 'focus_loss' | 'visibility_hidden';
  timestamp: number; // Unix ms
}