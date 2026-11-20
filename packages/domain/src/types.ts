export const STAGES = [
  'registration',
  'ward',
  'fitness',
  'pre_ot',
  'post_op',
  'discharge',
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  registration: 'Registration',
  ward: 'Admission to ward',
  fitness: 'Fitness',
  pre_ot: 'Pre-OT',
  post_op: 'Post-op',
  discharge: 'Discharge',
};

export type UserRole = 'resident' | 'consultant' | 'admin';
export type AdmissionStatus = 'active' | 'discharged' | 'cancelled';
export type AyushmanStatus = 'none' | 'applied' | 'not_applied';
export type WoundType = 'compound' | 'non_compound';
export type Sex = 'male' | 'female' | 'other';
export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';
export type FieldType =
  | 'bool'
  | 'text'
  | 'number'
  | 'enum'
  | 'multi_enum'
  | 'date'
  | 'photo'
  | 'note_photo';

export const KNOWN_FIELD_TYPES: FieldType[] = [
  'bool',
  'text',
  'number',
  'enum',
  'multi_enum',
  'date',
  'photo',
  'note_photo',
];

export const PLANNED_PROCEDURES = ['bipolar', 'THR', 'TCR', 'other', 'undecided'] as const;
export type PlannedProcedure = (typeof PLANNED_PROCEDURES)[number];

export type Condition =
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; path: string; value: unknown }
  | { op: 'contains'; path: string; value: unknown }
  | { op: 'in'; path: string; value: unknown[] }
  | { op: 'exists'; path: string }
  | { op: 'and' | 'or'; args: Condition[] }
  | { op: 'not'; arg: Condition };

export type EvalContext = {
  patient: Record<string, unknown>;
  admission: Record<string, unknown>;
  entries: Record<string, unknown>;
  today: string;
};

export type EvalOk = { ok: true; value: boolean };
export type EvalErr = { ok: false; error: string };
export type EvalResult = EvalOk | EvalErr;

export type PatientFields = {
  name?: string | null;
  age?: number | null;
  sex?: Sex | null;
  father_name?: string | null;
  address?: string | null;
  mobile?: string | null;
  past_history?: string | null;
};

export type AdmissionFields = {
  brought_by_name?: string | null;
  brought_by_relation?: string | null;
  brought_by_phone?: string | null;
  is_mlc?: boolean | null;
  ayushman_status?: AyushmanStatus | null;
  wound_type?: WoundType | null;
  planned_procedures?: string[] | null;
  surgery_date?: string | null;
  photo_consent?: boolean | null;
  current_stage?: Stage;
  status?: AdmissionStatus;
  fitness_attempt?: number;
};

export type ChecklistItem = {
  item_key: string;
  stage: Stage;
  label: string;
  field_type: string;
  required: boolean;
  applies_when: Condition | null;
  options?: unknown;
  active?: boolean;
  sort_order?: number;
};

export type ChecklistEntry = {
  item_key: string;
  value: Record<string, unknown> | unknown;
  done_by?: string;
  done_at?: string;
  updated_at?: string;
};

export type WorkflowTransition = {
  from_stage: Stage;
  to_stage: Stage;
  guard: Condition | null;
  requires_reason: boolean;
  label: string;
  completes_admission?: boolean;
};

export type AttachmentMeta = {
  id: string;
  entry_id?: string | null;
  item_key?: string | null;
  upload_status: UploadStatus;
};

export type GateResult = { can: boolean; reason: string; ruleError?: string };
