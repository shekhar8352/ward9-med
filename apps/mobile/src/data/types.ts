import type {
  AdmissionFields,
  AdmissionStatus,
  AyushmanStatus,
  ChecklistItem,
  FieldType,
  PatientFields,
  Stage,
  UploadStatus,
  UserRole,
  WorkflowTransition,
  WoundType,
  Sex,
} from '@ward9/domain';

export type UserRow = {
  id: string;
  hospital_id: string;
  name: string;
  phone: string;
  role: UserRole;
  active: boolean;
};

export type DeviceRow = {
  id: string;
  user_id: string;
  hospital_id: string;
  device_label: string | null;
  expo_push_token: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
};

export type HospitalRow = {
  id: string;
  name: string;
  timezone: string;
  visibility_mode: 'ward' | 'team';
  sync_discharged_hours: number;
  min_client_version: string;
  grievance_contact: string | null;
};

export type PatientRow = PatientFields & {
  id: string;
  hospital_id: string;
  abha_id?: string | null;
  created_at: string;
  updated_at: string;
  name: string;
  age: number;
  sex: Sex;
};

export type AdmissionRow = AdmissionFields & {
  id: string;
  hospital_id: string;
  patient_id: string;
  status: AdmissionStatus;
  current_stage: Stage;
  admitted_at: string;
  updated_at: string;
  updated_by: string | null;
  device_id: string | null;
  photo_consent_by?: string | null;
  photo_consent_at?: string | null;
  fitness_attempt: number;
  discharged_at: string | null;
  cancel_reason: string | null;
  wound_type: WoundType | null;
  ayushman_status: AyushmanStatus | null;
};

export type TeamRow = {
  admission_id: string;
  user_id: string;
  hospital_id: string;
  team_role: string;
  assigned_at: string;
};

export type ItemRow = ChecklistItem & {
  id: string;
  hospital_id: string;
  field_type: FieldType | string;
};

export type TransitionRow = WorkflowTransition & {
  id: string;
  hospital_id: string;
};

export type EntryRow = {
  id: string;
  hospital_id: string;
  admission_id: string;
  item_key: string;
  value: Record<string, unknown>;
  done_by: string;
  done_at: string;
  updated_at: string;
  device_id: string;
  client_mutation_id: string;
};

export type AttachmentRow = {
  id: string;
  hospital_id: string;
  admission_id: string;
  entry_id: string | null;
  kind: string;
  local_uri: string | null;
  storage_path: string | null;
  byte_size: number | null;
  upload_status: UploadStatus;
  uploaded_by: string;
  created_at: string;
};

export type StageTransitionRow = {
  id: string;
  hospital_id: string;
  admission_id: string;
  from_stage: Stage;
  to_stage: Stage;
  reason: string | null;
  override: boolean;
  by_user: string;
  at: string;
  device_id: string;
};

export type AuditRow = {
  id: string;
  hospital_id: string;
  who: string | null;
  action: string;
  table_name: string;
  row_id: string | null;
  old_row: unknown;
  new_row: unknown;
  at: string;
};

export type InviteRow = {
  id: string;
  hospital_id: string;
  name: string;
  phone: string;
  role: UserRole;
  accepted_at: string | null;
};

export type DbState = {
  hospital: HospitalRow;
  users: UserRow[];
  devices: DeviceRow[];
  invites: InviteRow[];
  patients: PatientRow[];
  admissions: AdmissionRow[];
  team: TeamRow[];
  items: ItemRow[];
  transitions: TransitionRow[];
  entries: EntryRow[];
  attachments: AttachmentRow[];
  stageTransitions: StageTransitionRow[];
  audit: AuditRow[];
  syncStatus: 'offline' | 'pending' | 'synced';
  lastConflict: { item_key: string; keptBy: string } | null;
};
