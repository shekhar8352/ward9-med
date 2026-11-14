import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CLIENT_VERSION,
  canAdvance,
  isClientAllowed,
  lastWriteWins,
  SEED_ITEMS,
  SEED_TRANSITIONS,
  type Stage,
} from '@ward9/domain';
import { newId } from '../ids';
import type {
  AdmissionRow,
  AttachmentRow,
  AuditRow,
  DbState,
  DeviceRow,
  EntryRow,
  HospitalRow,
  InviteRow,
  ItemRow,
  PatientRow,
  StageTransitionRow,
  TeamRow,
  TransitionRow,
  UserRow,
} from './types';

const STORAGE_KEY = 'ward9.db.v1';
const HOSPITAL_ID = '00000000-0000-4000-8000-000000000001';

const DEMO_USERS: UserRow[] = [
  { id: 'user-admin', hospital_id: HOSPITAL_ID, name: 'Dr Admin', phone: '+919999000001', role: 'admin', active: true },
  { id: 'user-res-a', hospital_id: HOSPITAL_ID, name: 'Dr Asha', phone: '+919999000002', role: 'resident', active: true },
  { id: 'user-res-b', hospital_id: HOSPITAL_ID, name: 'Dr Bharat', phone: '+919999000003', role: 'resident', active: true },
];

function seedItems(): ItemRow[] {
  return SEED_ITEMS.map((i, idx) => ({
    ...i,
    id: `item-${i.item_key}`,
    hospital_id: HOSPITAL_ID,
    field_type: i.field_type,
    sort_order: i.sort_order ?? idx,
  }));
}

function seedTransitions(): TransitionRow[] {
  return SEED_TRANSITIONS.map((t, idx) => ({
    ...t,
    id: `tr-${idx}`,
    hospital_id: HOSPITAL_ID,
  }));
}

function emptyState(): DbState {
  const hospital: HospitalRow = {
    id: HOSPITAL_ID,
    name: 'Ward 9 Orthopaedic',
    timezone: 'Asia/Kolkata',
    visibility_mode: 'ward',
    sync_discharged_hours: 48,
    min_client_version: '1.0.0',
    grievance_contact: 'Hospital administration',
  };
  return {
    hospital,
    users: DEMO_USERS,
    devices: [],
    invites: [],
    patients: [],
    admissions: [],
    team: [],
    items: seedItems(),
    transitions: seedTransitions(),
    entries: [],
    attachments: [],
    stageTransitions: [],
    audit: [],
    syncStatus: 'offline',
    lastConflict: null,
  };
}

let state: DbState = emptyState();
let currentUserId = 'user-res-a';
let currentDeviceId = 'device-local';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState(): DbState {
  return state;
}

export function getCurrentUser(): UserRow | undefined {
  return state.users.find((u) => u.id === currentUserId);
}

export function getCurrentUserId(): string {
  return currentUserId;
}

export function getDeviceId(): string {
  return currentDeviceId;
}

export function setCurrentUser(id: string) {
  currentUserId = id;
  emit();
}

function audit(action: string, table_name: string, row_id: string | null, old_row: unknown, new_row: unknown) {
  const row: AuditRow = {
    id: newId(),
    hospital_id: HOSPITAL_ID,
    who: currentUserId,
    action,
    table_name,
    row_id,
    old_row,
    new_row,
    at: new Date().toISOString(),
  };
  state = { ...state, audit: [...state.audit, row], syncStatus: 'pending' };
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state, currentUserId, currentDeviceId }));
  } catch {
    /* ignore quota */
  }
}

export async function loadStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { state: DbState; currentUserId?: string; currentDeviceId?: string };
      state = { ...emptyState(), ...parsed.state, items: seedItems(), transitions: seedTransitions() };
      if (parsed.currentUserId) currentUserId = parsed.currentUserId;
      if (parsed.currentDeviceId) currentDeviceId = parsed.currentDeviceId;
    }
  } catch {
    state = emptyState();
  }
  if (!state.devices.some((d) => d.id === currentDeviceId)) {
    state.devices = [
      ...state.devices,
      {
        id: currentDeviceId,
        user_id: currentUserId,
        hospital_id: HOSPITAL_ID,
        device_label: 'This phone',
        expo_push_token: null,
        revoked_at: null,
        last_seen_at: new Date().toISOString(),
      },
    ];
  }
  emit();
}

export async function resetStore(): Promise<void> {
  state = emptyState();
  await AsyncStorage.removeItem(STORAGE_KEY);
  emit();
}

function touch() {
  emit();
  void persist();
}

export function writesAllowed(): { ok: boolean; reason: string } {
  const user = getCurrentUser();
  if (!user || !user.active) return { ok: false, reason: 'Account is not active' };
  const device = state.devices.find((d) => d.id === currentDeviceId);
  if (device?.revoked_at) return { ok: false, reason: 'This device was revoked' };
  if (!isClientAllowed(state.hospital.min_client_version, CLIENT_VERSION)) {
    return { ok: false, reason: 'Update Ward Checklist' };
  }
  return { ok: true, reason: '' };
}

export function registerPatient(input: {
  name: string;
  age: number;
  sex: PatientRow['sex'];
  father_name: string;
  address: string;
  mobile?: string | null;
  past_history?: string | null;
  abha_id?: string | null;
  brought_by_name: string;
  brought_by_relation: string;
  brought_by_phone?: string | null;
  is_mlc: boolean;
  ayushman_status: AdmissionRow['ayushman_status'];
  photo_consent: boolean;
}): { patient: PatientRow; admission: AdmissionRow; duplicate: boolean } {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  const duplicate = state.patients.some((p) => {
    const sameName = p.name.trim().toLowerCase() === input.name.trim().toLowerCase();
    const mobile = (input.mobile ?? '').replace(/\D/g, '');
    const pMobile = (p.mobile ?? '').replace(/\D/g, '');
    return sameName || (mobile.length >= 8 && pMobile === mobile);
  });
  const now = new Date().toISOString();
  const patient: PatientRow = {
    id: newId(),
    hospital_id: HOSPITAL_ID,
    name: input.name,
    age: input.age,
    sex: input.sex,
    father_name: input.father_name,
    address: input.address,
    mobile: input.mobile ?? null,
    past_history: input.past_history ?? null,
    abha_id: input.abha_id ?? null,
    created_at: now,
    updated_at: now,
  };
  const admission: AdmissionRow = {
    id: newId(),
    hospital_id: HOSPITAL_ID,
    patient_id: patient.id,
    status: 'active',
    current_stage: 'registration',
    admitted_at: now,
    brought_by_name: input.brought_by_name,
    brought_by_relation: input.brought_by_relation,
    brought_by_phone: input.brought_by_phone ?? null,
    is_mlc: input.is_mlc,
    ayushman_status: input.ayushman_status,
    wound_type: null,
    planned_procedures: [],
    surgery_date: null,
    photo_consent: input.photo_consent,
    photo_consent_by: currentUserId,
    photo_consent_at: now,
    fitness_attempt: 1,
    discharged_at: null,
    cancel_reason: null,
    updated_at: now,
    updated_by: currentUserId,
    device_id: currentDeviceId,
  };
  const team: TeamRow = {
    admission_id: admission.id,
    user_id: currentUserId,
    hospital_id: HOSPITAL_ID,
    team_role: 'primary',
    assigned_at: now,
  };
  audit('INSERT', 'patients', patient.id, null, patient);
  audit('INSERT', 'admissions', admission.id, null, admission);
  state = {
    ...state,
    patients: [...state.patients, patient],
    admissions: [...state.admissions, admission],
    team: [...state.team, team],
    syncStatus: 'pending',
  };
  touch();
  return { patient, admission, duplicate };
}

export function updateAdmission(id: string, patch: Partial<AdmissionRow>) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  state = {
    ...state,
    admissions: state.admissions.map((a) =>
      a.id === id
        ? { ...a, ...patch, updated_at: new Date().toISOString(), updated_by: currentUserId, device_id: currentDeviceId }
        : a,
    ),
    syncStatus: 'pending',
  };
  const row = state.admissions.find((a) => a.id === id);
  audit('UPDATE', 'admissions', id, null, row);
  touch();
}

export function updatePatient(id: string, patch: Partial<PatientRow>) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  state = {
    ...state,
    patients: state.patients.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)),
    syncStatus: 'pending',
  };
  touch();
}

export function upsertEntry(admissionId: string, itemKey: string, value: Record<string, unknown>) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  const admission = state.admissions.find((a) => a.id === admissionId);
  if (!admission) throw new Error('admission missing');
  const now = Date.now();
  const incoming = {
    value,
    updatedAt: now,
    deviceId: currentDeviceId,
    clientMutationId: newId(),
    doneBy: currentUserId,
  };
  const existing = state.entries.find((e) => e.admission_id === admissionId && e.item_key === itemKey);
  const result = lastWriteWins(
    existing
      ? {
          value: existing.value,
          updatedAt: Date.parse(existing.updated_at),
          deviceId: existing.device_id,
          clientMutationId: existing.client_mutation_id,
          doneBy: existing.done_by,
        }
      : null,
    incoming,
    now,
  );
  if (result.discarded) {
    audit('conflict_discarded', 'checklist_entries', existing?.id ?? null, existing, result.discarded);
    state = {
      ...state,
      lastConflict: { item_key: itemKey, keptBy: result.applied.doneBy },
      syncStatus: 'pending',
    };
    touch();
    return { discarded: true as const };
  }
  const row: EntryRow = {
    id: existing?.id ?? newId(),
    hospital_id: HOSPITAL_ID,
    admission_id: admissionId,
    item_key: itemKey,
    value: result.applied.value as Record<string, unknown>,
    done_by: result.applied.doneBy,
    done_at: new Date(result.applied.updatedAt).toISOString(),
    updated_at: new Date(result.applied.updatedAt).toISOString(),
    device_id: result.applied.deviceId,
    client_mutation_id: result.applied.clientMutationId,
  };
  audit(existing ? 'UPDATE' : 'INSERT', 'checklist_entries', row.id, existing ?? null, row);
  state = {
    ...state,
    entries: existing
      ? state.entries.map((e) => (e.id === row.id ? row : e))
      : [...state.entries, row],
    syncStatus: 'pending',
    lastConflict: null,
  };
  if (itemKey === 'procedure.plan' && Array.isArray(value.value)) {
    updateAdmission(admissionId, { planned_procedures: value.value as string[] });
    return { discarded: false as const };
  }
  touch();
  return { discarded: false as const };
}

export function applyRemoteEntry(row: EntryRow) {
  const existing = state.entries.find((e) => e.admission_id === row.admission_id && e.item_key === row.item_key);
  const result = lastWriteWins(
    existing
      ? {
          value: existing.value,
          updatedAt: Date.parse(existing.updated_at),
          deviceId: existing.device_id,
          clientMutationId: existing.client_mutation_id,
          doneBy: existing.done_by,
        }
      : null,
    {
      value: row.value,
      updatedAt: Date.parse(row.updated_at),
      deviceId: row.device_id,
      clientMutationId: row.client_mutation_id,
      doneBy: row.done_by,
    },
    Date.now(),
  );
  if (result.discarded) {
    audit('conflict_discarded', 'checklist_entries', existing?.id ?? row.id, existing ?? null, result.discarded);
    state = { ...state, lastConflict: { item_key: row.item_key, keptBy: result.applied.doneBy } };
    touch();
    return;
  }
  const next: EntryRow = {
    ...row,
    value: result.applied.value as Record<string, unknown>,
    updated_at: new Date(result.applied.updatedAt).toISOString(),
    device_id: result.applied.deviceId,
    done_by: result.applied.doneBy,
    client_mutation_id: result.applied.clientMutationId,
  };
  state = {
    ...state,
    entries: existing ? state.entries.map((e) => (e.id === existing.id ? { ...existing, ...next, id: existing.id } : e)) : [...state.entries, next],
  };
  touch();
}

export function addAttachment(input: Omit<AttachmentRow, 'hospital_id' | 'created_at'> & { created_at?: string }) {
  const row: AttachmentRow = {
    ...input,
    hospital_id: HOSPITAL_ID,
    created_at: input.created_at ?? new Date().toISOString(),
  };
  audit('INSERT', 'attachments', row.id, null, row);
  state = { ...state, attachments: [...state.attachments, row], syncStatus: 'pending' };
  touch();
  return row;
}

export function updateAttachment(id: string, patch: Partial<AttachmentRow>) {
  state = {
    ...state,
    attachments: state.attachments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
  touch();
}

export function advanceStage(input: {
  admissionId: string;
  toStage: Stage;
  reason?: string;
  override?: boolean;
  surgeryDate?: string;
  completesAdmission?: boolean;
}) {
  const gate = writesAllowed();
  if (!gate.ok) throw new Error(gate.reason);
  const admission = state.admissions.find((a) => a.id === input.admissionId);
  const patient = state.patients.find((p) => p.id === admission?.patient_id);
  if (!admission || !patient) throw new Error('missing');
  const user = getCurrentUser();
  const result = canAdvance({
    fromStage: admission.current_stage,
    toStage: input.toStage,
    patient,
    admission,
    items: state.items,
    entries: state.entries.filter((e) => e.admission_id === admission.id),
    transitions: state.transitions,
    reason: input.reason,
    override: input.override,
    role: user?.role,
    completesAdmission: input.completesAdmission,
  });
  if (!result.can) throw new Error(result.reason);
  const now = new Date().toISOString();
  const tr: StageTransitionRow = {
    id: newId(),
    hospital_id: HOSPITAL_ID,
    admission_id: admission.id,
    from_stage: admission.current_stage,
    to_stage: input.toStage,
    reason: input.reason ?? null,
    override: Boolean(input.override),
    by_user: currentUserId,
    at: now,
    device_id: currentDeviceId,
  };
  let next: AdmissionRow = {
    ...admission,
    current_stage: input.toStage,
    updated_at: now,
    updated_by: currentUserId,
    device_id: currentDeviceId,
  };
  if (admission.current_stage === 'pre_ot' && input.toStage === 'fitness') {
    next.fitness_attempt = admission.fitness_attempt + 1;
  }
  if (input.toStage === 'post_op') {
    next.surgery_date = input.surgeryDate ?? admission.surgery_date;
  }
  if (input.completesAdmission) {
    next.status = 'discharged';
    next.discharged_at = now;
  }
  audit('INSERT', 'stage_transitions', tr.id, null, tr);
  audit('UPDATE', 'admissions', admission.id, admission, next);
  state = {
    ...state,
    admissions: state.admissions.map((a) => (a.id === admission.id ? next : a)),
    stageTransitions: [...state.stageTransitions, tr],
    syncStatus: 'pending',
  };
  touch();
  return next;
}

export function setTeam(admissionId: string, userIds: string[]) {
  if (userIds.length === 0) throw new Error('Keep at least one doctor on the team');
  const now = new Date().toISOString();
  const rows: TeamRow[] = userIds.map((user_id) => ({
    admission_id: admissionId,
    user_id,
    hospital_id: HOSPITAL_ID,
    team_role: 'member',
    assigned_at: now,
  }));
  state = {
    ...state,
    team: [...state.team.filter((t) => t.admission_id !== admissionId), ...rows],
  };
  touch();
}

export function inviteUser(name: string, phone: string, role: UserRow['role']) {
  const user = getCurrentUser();
  if (user?.role !== 'admin') throw new Error('Only an admin can invite doctors');
  const invite: InviteRow = { id: newId(), hospital_id: HOSPITAL_ID, name, phone, role, accepted_at: null };
  const newUser: UserRow = { id: newId(), hospital_id: HOSPITAL_ID, name, phone, role, active: true };
  state = { ...state, invites: [...state.invites, invite], users: [...state.users, newUser] };
  touch();
  return newUser;
}

export function setUserActive(userId: string, active: boolean) {
  const user = getCurrentUser();
  if (user?.role !== 'admin') throw new Error('Only an admin can change accounts');
  state = { ...state, users: state.users.map((u) => (u.id === userId ? { ...u, active } : u)) };
  touch();
}

export function revokeDevice(deviceId: string) {
  const user = getCurrentUser();
  if (user?.role !== 'admin') throw new Error('Only an admin can revoke a device');
  state = {
    ...state,
    devices: state.devices.map((d) => (d.id === deviceId ? { ...d, revoked_at: new Date().toISOString() } : d)),
  };
  touch();
}

export function cancelAdmission(admissionId: string, reason: string) {
  const user = getCurrentUser();
  if (user?.role !== 'admin') throw new Error('Only an admin can cancel an admission');
  updateAdmission(admissionId, { status: 'cancelled', cancel_reason: reason });
}

export function markSynced() {
  state = { ...state, syncStatus: 'synced' };
  emit();
}

export function markOffline() {
  state = { ...state, syncStatus: 'offline' };
  emit();
}

export function setPushToken(token: string) {
  state = {
    ...state,
    devices: state.devices.map((d) => (d.id === currentDeviceId ? { ...d, expo_push_token: token } : d)),
  };
  touch();
}

export function thisDeviceRevoked(): boolean {
  return Boolean(state.devices.find((d) => d.id === currentDeviceId)?.revoked_at);
}
